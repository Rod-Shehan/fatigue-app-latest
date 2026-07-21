/**
 * Event Tracker data: read GPS-bearing diary events from shared Neon FatigueSheet
 * (app-next table). Command does not own this model — query via $queryRaw only.
 */

import { prisma } from "@/lib/prisma";
import { normalizeHistory1m, type History1mPoint } from "@/lib/geo-history-1m";
import type { MapEvent } from "@/lib/map-event-types";

export type { MapEvent };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_EVENTS = 500;

type DayData = {
  day_label?: string;
  events?: Array<{
    time: string;
    type: string;
    lat?: number;
    lng?: number;
    accuracy?: number;
    history_1m?: History1mPoint[];
  }>;
};

type SheetRow = {
  id: string;
  driverName: string;
  weekStarting: string;
  days: string;
};

function parseDays(daysJson: string): DayData[] {
  try {
    const parsed = JSON.parse(daysJson);
    return Array.isArray(parsed) ? (parsed as DayData[]) : [];
  } catch {
    return [];
  }
}

function resolveGpsMovementTrailEnabled(policyEnabled: boolean): boolean {
  const raw = (
    process.env.GPS_MOVEMENT_TRAIL_ENABLED ??
    process.env.NEXT_PUBLIC_GPS_MOVEMENT_TRAIL_ENABLED ??
    ""
  )
    .trim()
    .toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  if (raw === "true" || raw === "1" || raw === "on") return true;
  return policyEnabled;
}

async function isGpsMovementTrailEnabled(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ gpsMovementTrailEnabled: boolean }>>`
      SELECT "gpsMovementTrailEnabled"
      FROM "SystemPolicy"
      WHERE id = 'default'
      LIMIT 1
    `;
    return resolveGpsMovementTrailEnabled(rows[0]?.gpsMovementTrailEnabled === true);
  } catch {
    return resolveGpsMovementTrailEnabled(false);
  }
}

export async function fetchMapSheetMeta(): Promise<
  Array<{ week_starting: string; driver_name: string }>
> {
  const rows = await prisma.$queryRaw<Array<{ weekStarting: string; driverName: string }>>`
    SELECT DISTINCT "weekStarting", "driverName"
    FROM "FatigueSheet"
    ORDER BY "weekStarting" DESC
    LIMIT 500
  `;
  return rows.map((r) => ({
    week_starting: r.weekStarting,
    driver_name: r.driverName,
  }));
}

export async function fetchMapEvents(opts: {
  weekStarting?: string;
  driverName?: string;
}): Promise<{ events: MapEvent[]; gpsMovementTrailEnabled: boolean }> {
  const trailEnabled = await isGpsMovementTrailEnabled();
  const { weekStarting, driverName } = opts;

  let sheets: SheetRow[];
  if (weekStarting && driverName) {
    sheets = await prisma.$queryRaw<SheetRow[]>`
      SELECT id, "driverName", "weekStarting", days
      FROM "FatigueSheet"
      WHERE "weekStarting" = ${weekStarting} AND "driverName" = ${driverName}
      ORDER BY "createdAt" DESC
    `;
  } else if (weekStarting) {
    sheets = await prisma.$queryRaw<SheetRow[]>`
      SELECT id, "driverName", "weekStarting", days
      FROM "FatigueSheet"
      WHERE "weekStarting" = ${weekStarting}
      ORDER BY "createdAt" DESC
    `;
  } else if (driverName) {
    sheets = await prisma.$queryRaw<SheetRow[]>`
      SELECT id, "driverName", "weekStarting", days
      FROM "FatigueSheet"
      WHERE "driverName" = ${driverName}
      ORDER BY "weekStarting" DESC, "createdAt" DESC
      LIMIT 100
    `;
  } else {
    sheets = await prisma.$queryRaw<SheetRow[]>`
      SELECT id, "driverName", "weekStarting", days
      FROM "FatigueSheet"
      ORDER BY "weekStarting" DESC, "createdAt" DESC
      LIMIT 100
    `;
  }

  const events: MapEvent[] = [];
  for (const sheet of sheets) {
    const days = parseDays(sheet.days);
    const driver_name = sheet.driverName || "Unknown";
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const day_label = day.day_label ?? DAY_LABELS[i] ?? `Day ${i}`;
      for (const ev of day.events ?? []) {
        if (
          ev.lat != null &&
          ev.lng != null &&
          typeof ev.lat === "number" &&
          typeof ev.lng === "number"
        ) {
          const history_1m = trailEnabled ? normalizeHistory1m(ev.history_1m) : [];
          events.push({
            lat: ev.lat,
            lng: ev.lng,
            type: ev.type ?? "work",
            time: ev.time,
            driver_name,
            sheetId: sheet.id,
            week_starting: sheet.weekStarting,
            day_label,
            accuracy: ev.accuracy,
            ...(history_1m.length > 0 ? { history_1m } : {}),
          });
          if (events.length >= MAX_EVENTS) break;
        }
      }
      if (events.length >= MAX_EVENTS) break;
    }
    if (events.length >= MAX_EVENTS) break;
  }

  return { events, gpsMovementTrailEnabled: trailEnabled };
}
