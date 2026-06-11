/**
 * Seed 5 demo long-haul drivers with WA Reg 184E-compliant shift patterns so the
 * manager fleet risk pulse + individual risk graph have realistic data to display.
 *
 * Patterns are built to satisfy:
 *  - Reg 184E(1)(a): every work leg <= ~4.9h, followed by a >=20 min break
 *    (we use 20-30 min breaks, so the >=10 min continuous requirement holds too)
 *  - Reg 184E(1)(b): 14-day work total well under 168h (~120-135h)
 *  - Reg 184E(2)(a): >=27h non-work per 72h with 3x >=7h blocks, gaps <= 17h
 *    (daily on-duty span is <= ~13.5h, overnight rest >= 10h)
 *  - Reg 184E(2)(b)(i): one full 24h non-work day per driver per week
 *    (2x 24h rest in any 14-day window across the two seeded weeks)
 *
 * Seeds the PREVIOUS week (full history for the TPMA 14-day lookback) and the
 * CURRENT week (including remaining planned days, so the prospective part of
 * the risk curve has data). Daily start times / leg lengths are jittered with a
 * deterministic per-driver-per-date RNG, so re-running the script is idempotent.
 *
 * Usage (PowerShell, from app-next):
 *   npx tsx scripts/seed-demo-drivers.ts            # seed/refresh demo sheets
 *   npx tsx scripts/seed-demo-drivers.ts --clean    # remove demo sheets + FRMS runs
 *
 * DATABASE_URL is read from .env.local / .env automatically. To also compute
 * TPMA risk runs (recommended so the fleet heatmap is populated immediately):
 *   $env:FRMS_ENGINE="hybrid"
 *   $env:FRMS_PYTHON_URL="http://127.0.0.1:8000"   # or the Railway URL
 *   $env:FRMS_PYTHON_API_KEY="<key>"
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Minimal .env loader (no dotenv dependency). Shell env vars always win;
// .env.local wins over .env (matching Next.js precedence).
{
  const shellKeys = new Set(Object.keys(process.env));
  const fromFile = new Set<string>();
  for (const file of [".env.local", ".env"]) {
    const p = join(process.cwd(), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      if (shellKeys.has(key) || fromFile.has(key)) continue;
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
      fromFile.add(key);
    }
  }
}

import { PrismaClient } from "@prisma/client";
import {
  isFrmsEngineEnabled,
  loadDriverWeekMap,
  runFrmsAndPersist,
} from "../src/lib/frms/orchestrator";
import {
  getPreviousWeekSunday,
  getSheetDayDateString,
  getThisWeekSunday,
} from "../src/lib/weeks";

const MINUTES_PER_DAY = 1440;
const LATEST_END_MIN = 23 * 60 + 45; // shifts must finish by 23:45 (no midnight carry)
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Segment = { type: "work" | "break" | "non_work"; durMin: number };

type LatLng = [number, number];

type DemoDriver = {
  name: string;
  rego: string;
  route: [string, string]; // [home base, destination]
  /** Approximate highway polyline home base -> destination (for GPS on events). */
  waypoints: LatLng[];
  shiftLabel: "A" | "B";
  /** Day index (0=Sun) with a full 24h non-work day — Reg 184E(2)(b)(i). */
  restDayIdx: number;
  /** Nominal shift start, minutes from Perth midnight. */
  startMin: number;
  /** Alternating work legs and breaks/non-work, nominal durations in minutes. */
  segments: Segment[];
};

/** Fictional roster. All legs <= 290 min nominal (jitter capped so legs stay < 5h). */
const ROSTER: DemoDriver[] = [
  {
    // Early linehaul, Perth <-> Kalgoorlie. ~11.5h work, 04:30 start.
    name: "Mick Harland",
    rego: "1GVL 482",
    route: ["Perth", "Kalgoorlie"],
    // Great Eastern Hwy: Midland, Northam, Cunderdin, Merredin, Southern Cross, Coolgardie.
    waypoints: [
      [-31.95, 115.86],
      [-31.89, 116.01],
      [-31.65, 116.66],
      [-31.65, 117.23],
      [-31.48, 118.28],
      [-31.23, 119.33],
      [-30.95, 121.16],
      [-30.75, 121.47],
    ],
    shiftLabel: "A",
    restDayIdx: 6,
    startMin: 4 * 60 + 30,
    segments: [
      { type: "work", durMin: 280 },
      { type: "break", durMin: 30 },
      { type: "work", durMin: 270 },
      { type: "break", durMin: 30 },
      { type: "work", durMin: 140 },
    ],
  },
  {
    // Day freight, Perth <-> Geraldton. ~10.75h work, 06:30 start.
    name: "Priya Nathan",
    rego: "1HTQ 903",
    route: ["Perth", "Geraldton"],
    // Brand Hwy: Muchea, Regans Ford, Badgingarra, Eneabba, Dongara.
    waypoints: [
      [-31.95, 115.86],
      [-31.58, 115.98],
      [-30.98, 115.7],
      [-30.39, 115.49],
      [-29.82, 115.27],
      [-29.25, 114.93],
      [-28.77, 114.61],
    ],
    shiftLabel: "A",
    restDayIdx: 0,
    startMin: 6 * 60 + 30,
    segments: [
      { type: "work", durMin: 270 },
      { type: "break", durMin: 30 },
      { type: "work", durMin: 255 },
      { type: "break", durMin: 30 },
      { type: "work", durMin: 120 },
    ],
  },
  {
    // Afternoon/evening run, Perth <-> Meekatharra. Finishes ~23:45 (pattern B,
    // late circadian exposure -> highest TPMA risk in the demo fleet).
    name: "Wayne Corrigan",
    rego: "1KCD 117",
    route: ["Perth", "Meekatharra"],
    // Great Northern Hwy: Bullsbrook, New Norcia, Dalwallinu, Wubin, Paynes Find, Mt Magnet, Cue.
    waypoints: [
      [-31.95, 115.86],
      [-31.67, 116.03],
      [-30.97, 116.21],
      [-30.28, 116.66],
      [-30.11, 116.63],
      [-29.27, 117.68],
      [-28.06, 117.85],
      [-27.42, 117.9],
      [-26.59, 118.5],
    ],
    shiftLabel: "B",
    restDayIdx: 3,
    startMin: 12 * 60 + 30,
    segments: [
      { type: "work", durMin: 270 },
      { type: "break", durMin: 30 },
      { type: "work", durMin: 270 },
      { type: "break", durMin: 30 },
      { type: "work", durMin: 70 },
    ],
  },
  {
    // Split shift, Perth <-> Bunbury (two short tours, long midday non-work).
    name: "Sofia Reiner",
    rego: "1MPW 264",
    route: ["Perth", "Bunbury"],
    // Kwinana Fwy / Forrest Hwy: Kwinana, Pinjarra, Harvey — out and back (split shift).
    waypoints: [
      [-31.95, 115.86],
      [-32.25, 115.81],
      [-32.63, 115.87],
      [-33.08, 115.9],
      [-33.33, 115.64],
      [-33.08, 115.9],
      [-32.63, 115.87],
      [-32.25, 115.81],
      [-31.95, 115.86],
    ],
    shiftLabel: "A",
    restDayIdx: 4,
    startMin: 5 * 60,
    segments: [
      { type: "work", durMin: 130 },
      { type: "break", durMin: 20 },
      { type: "work", durMin: 120 },
      { type: "non_work", durMin: 320 },
      { type: "work", durMin: 150 },
      { type: "break", durMin: 30 },
      { type: "work", durMin: 150 },
    ],
  },
  {
    // Heavy schedule, Perth <-> Newman legs. ~12h work, 05:15 start.
    name: "Dean Okafor",
    rego: "1PRX 558",
    route: ["Perth", "Newman"],
    // Great Northern Hwy: Wubin, Mt Magnet, Meekatharra, Kumarina.
    waypoints: [
      [-31.95, 115.86],
      [-30.11, 116.63],
      [-28.06, 117.85],
      [-26.59, 118.5],
      [-24.72, 119.6],
      [-23.36, 119.73],
    ],
    shiftLabel: "A",
    restDayIdx: 1,
    startMin: 5 * 60 + 15,
    segments: [
      { type: "work", durMin: 280 },
      { type: "break", durMin: 30 },
      { type: "work", durMin: 280 },
      { type: "break", durMin: 30 },
      { type: "work", durMin: 150 },
    ],
  },
];

export const DEMO_DRIVER_NAMES = ROSTER.map((d) => d.name);

/* ---------------------------------- RNG ---------------------------------- */

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer jitter in [-range, +range]. */
function jitter(rng: () => number, range: number): number {
  return Math.round((rng() * 2 - 1) * range);
}

/* ------------------------------ GPS helpers ------------------------------ */

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Cumulative km at each waypoint. */
function cumulativeKm(points: LatLng[]): number[] {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversineKm(points[i - 1], points[i]));
  }
  return cum;
}

/** Point at `fraction` (0..1) of the polyline's total length. */
function pointAlongRoute(points: LatLng[], cum: number[], fraction: number): LatLng {
  const target = Math.min(1, Math.max(0, fraction)) * cum[cum.length - 1];
  for (let i = 1; i < points.length; i++) {
    if (target <= cum[i]) {
      const segLen = cum[i] - cum[i - 1];
      const t = segLen > 0 ? (target - cum[i - 1]) / segLen : 0;
      return [
        points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t,
        points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t,
      ];
    }
  }
  return points[points.length - 1];
}

/* ------------------------------ day building ------------------------------ */

function minToIso(dateStr: string, minute: number): string {
  const hh = String(Math.floor(minute / 60)).padStart(2, "0");
  const mm = String(minute % 60).padStart(2, "0");
  return `${dateStr}T${hh}:${mm}:00+08:00`; // Perth local time
}

type SeededDay = {
  day_label: string;
  date: string;
  truck_rego?: string;
  start_location?: string;
  destination?: string;
  start_kms?: number | null;
  end_kms?: number | null;
  shift_label: "A" | "B" | "";
  route_confirmed?: boolean;
  work_time: boolean[];
  breaks: boolean[];
  non_work: boolean[];
  events: Array<{ time: string; type: string; lat?: number; lng?: number; accuracy?: number }>;
};

function restDay(dateStr: string, dayIdx: number): SeededDay {
  return {
    day_label: DAY_LABELS[dayIdx],
    date: dateStr,
    shift_label: "",
    work_time: Array(MINUTES_PER_DAY).fill(false),
    breaks: Array(MINUTES_PER_DAY).fill(false),
    non_work: Array(MINUTES_PER_DAY).fill(true),
    events: [],
  };
}

function workDay(driver: DemoDriver, dateStr: string, dayIdx: number): SeededDay {
  const rng = mulberry32(hashSeed(`${driver.name}|${dateStr}`));

  const startMin = Math.max(4 * 60, driver.startMin + jitter(rng, 25));
  // Jitter work legs only; keep breaks at nominal length (>= 20 min, <= 30 min so
  // they stay classified as "break", not non-work). Cap legs at 295 min (< 5h).
  const segments: Segment[] = driver.segments.map((seg) =>
    seg.type === "work"
      ? { type: "work", durMin: Math.min(295, Math.max(45, seg.durMin + jitter(rng, 15))) }
      : { ...seg }
  );

  // Clamp so the shift ends by 23:45 (no midnight carry-over in demo data).
  let total = segments.reduce((sum, s) => sum + s.durMin, 0);
  for (let i = segments.length - 1; i >= 0 && startMin + total > LATEST_END_MIN; i--) {
    if (segments[i].type !== "work") continue;
    const overshoot = startMin + total - LATEST_END_MIN;
    const trim = Math.min(overshoot, segments[i].durMin - 45);
    segments[i].durMin -= trim;
    total -= trim;
  }

  const work_time = Array(MINUTES_PER_DAY).fill(false);
  const breaks = Array(MINUTES_PER_DAY).fill(false);
  const non_work = Array(MINUTES_PER_DAY).fill(false);
  const events: SeededDay["events"] = [];

  // GPS: place each event along the route polyline by fraction of work time
  // completed. Outbound runs home->dest, return days run the polyline in
  // reverse. Only events logged in the past get coordinates (a planned future
  // event has no GPS fix yet) — re-run the seed to extend map coverage.
  const totalWorkMin = segments.reduce((s, seg) => s + (seg.type === "work" ? seg.durMin : 0), 0);
  const routePoints = dayIdx % 2 === 0 ? driver.waypoints : [...driver.waypoints].reverse();
  const routeCum = cumulativeKm(routePoints);
  const nowMs = Date.now();
  const geoFor = (iso: string, workMinSoFar: number) => {
    if (Date.parse(iso) > nowMs) return {};
    const [lat, lng] = pointAlongRoute(routePoints, routeCum, workMinSoFar / totalWorkMin);
    return {
      lat: Number((lat + (rng() - 0.5) * 0.006).toFixed(5)),
      lng: Number((lng + (rng() - 0.5) * 0.006).toFixed(5)),
      accuracy: Math.round(8 + rng() * 22),
    };
  };

  let cursor = startMin;
  let workMinutes = 0;
  for (const seg of segments) {
    const iso = minToIso(dateStr, cursor);
    events.push({ time: iso, type: seg.type, ...geoFor(iso, workMinutes) });
    for (let m = cursor; m < Math.min(cursor + seg.durMin, MINUTES_PER_DAY); m++) {
      if (seg.type === "work") work_time[m] = true;
      else if (seg.type === "break") breaks[m] = true;
      else non_work[m] = true;
    }
    if (seg.type === "work") workMinutes += seg.durMin;
    cursor += seg.durMin;
  }
  const stopIso = minToIso(dateStr, Math.min(cursor, LATEST_END_MIN));
  events.push({ time: stopIso, type: "stop", ...geoFor(stopIso, workMinutes) });

  // Everything outside the shift is non-work (overnight rest).
  for (let m = 0; m < MINUTES_PER_DAY; m++) {
    if (!work_time[m] && !breaks[m]) non_work[m] = true;
  }

  // Outbound on even days, return leg on odd days. ~82 km/h average.
  const outbound = dayIdx % 2 === 0;
  const [home, dest] = driver.route;
  const startKms = 100000 + Math.floor(rng() * 60000);
  const distance = Math.round(workMinutes * (1.30 + rng() * 0.12));

  return {
    day_label: DAY_LABELS[dayIdx],
    date: dateStr,
    truck_rego: driver.rego,
    start_location: outbound ? home : dest,
    destination: outbound ? dest : home,
    start_kms: startKms,
    end_kms: startKms + distance,
    shift_label: driver.shiftLabel,
    route_confirmed: true,
    work_time,
    breaks,
    non_work,
    events,
  };
}

function buildWeekDays(driver: DemoDriver, weekStarting: string): SeededDay[] {
  const days: SeededDay[] = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = getSheetDayDateString(weekStarting, i);
    days.push(i === driver.restDayIdx ? restDay(dateStr, i) : workDay(driver, dateStr, i));
  }
  return days;
}

/* --------------------------------- main ---------------------------------- */

async function seed(prisma: PrismaClient): Promise<void> {
  const thisWeek = getThisWeekSunday();
  const prevWeek = getPreviousWeekSunday(thisWeek);
  const todayYmd = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

  for (const driver of ROSTER) {
    for (const weekStarting of [prevWeek, thisWeek]) {
      const days = buildWeekDays(driver, weekStarting);

      // Most recent completed 24h rest day on or before today.
      const restDates = [prevWeek, thisWeek]
        .map((w) => getSheetDayDateString(w, driver.restDayIdx))
        .filter((d) => d <= todayYmd);
      const last24hBreak = restDates[restDates.length - 1];

      const data = {
        jurisdictionCode: "WA_OSH_3132",
        driverName: driver.name,
        driverType: "solo",
        weekStarting,
        last24hBreak: last24hBreak ?? null,
        days: JSON.stringify(days),
        status: "draft",
      };

      const existing = await prisma.fatigueSheet.findFirst({
        where: { driverName: driver.name, weekStarting },
        select: { id: true },
      });
      if (existing) {
        await prisma.fatigueSheet.update({ where: { id: existing.id }, data });
        console.log(`updated  ${driver.name}  week ${weekStarting}`);
      } else {
        await prisma.fatigueSheet.create({ data });
        console.log(`created  ${driver.name}  week ${weekStarting}`);
      }
    }
  }
}

async function computeFrmsRuns(prisma: PrismaClient): Promise<void> {
  if (!isFrmsEngineEnabled() || !process.env.FRMS_PYTHON_URL || !process.env.FRMS_PYTHON_API_KEY) {
    console.log(
      "\nFRMS env not set (FRMS_ENGINE/FRMS_PYTHON_URL/FRMS_PYTHON_API_KEY) — skipping TPMA runs."
    );
    console.log("The heatmap will populate when the manager page first loads each driver.");
    return;
  }

  const thisWeek = getThisWeekSunday();
  console.log("\nComputing TPMA risk runs…");
  for (const driver of ROSTER) {
    try {
      const weekMap = await loadDriverWeekMap(prisma, driver.name);
      const result = await runFrmsAndPersist(prisma, {
        driverName: driver.name,
        weekStarting: thisWeek,
        weekMap,
        jurisdictionCode: "WA_OSH_3132",
        driverType: "solo",
      });
      console.log(`  ${driver.name}: ${result.status} (run ${result.runId ?? "n/a"})`);
    } catch (e) {
      console.error(`  ${driver.name}: FAILED —`, e instanceof Error ? e.message : e);
    }
  }
}

async function clean(prisma: PrismaClient): Promise<void> {
  const runs = await prisma.frmsProfileRun.deleteMany({
    where: { driverName: { in: DEMO_DRIVER_NAMES } },
  });
  const sheets = await prisma.fatigueSheet.deleteMany({
    where: { driverName: { in: DEMO_DRIVER_NAMES } },
  });
  console.log(`Removed ${sheets.count} demo sheets and ${runs.count} FRMS runs (snapshots cascade).`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set (checked shell env, .env.local, .env)");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    if (process.argv.includes("--clean")) {
      await clean(prisma);
      return;
    }
    await seed(prisma);
    await computeFrmsRuns(prisma);

    const runCount = await prisma.frmsProfileRun.count({
      where: { driverName: { in: DEMO_DRIVER_NAMES }, status: "ready" },
    });
    console.log(`\nDone. Ready FRMS runs for demo drivers: ${runCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
