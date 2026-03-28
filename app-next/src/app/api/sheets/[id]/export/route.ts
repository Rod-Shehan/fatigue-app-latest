import { NextResponse } from "next/server";
import type { jsPDF } from "jspdf";
import { getSessionForSheetAccess, canAccessSheet } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prepareRoadsidePdfExtras } from "@/lib/roadside-pdf-extras";
import { ROADSIDE_PDF_DISCLAIMER } from "@/lib/roadside-pdf";
import { PRODUCT_NAME_EXPORT, TAGLINE_DRIVER } from "@/lib/branding";
import { jurisdictionDisplayLabel, parseJurisdictionCode } from "@/lib/jurisdiction";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import { halfHourSlotsToRanges, minuteBooleansToRanges } from "@/lib/coverage/grid-to-ranges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TOTAL_MIN = 24 * 60;
const GREY_TEXT = [30, 30, 30] as [number, number, number];
const GREY_LABEL = [80, 80, 80] as [number, number, number];
const GREY_LIGHT = [240, 240, 240] as [number, number, number];
// Darker fills so recorded time is more obvious on print/PDF viewers.
const GREY_WORK = [35, 35, 35] as [number, number, number];
const GREY_BREAK = [90, 90, 90] as [number, number, number];
const GREY_NON_WORK = [180, 180, 180] as [number, number, number];

type SegmentType = "work" | "break" | "non_work";
type TimelineSegment = { startMin: number; endMin: number; type: SegmentType };
const ROW_LABELS = ["Work", "Break", "Non-Work"] as const;

function getDateStr(weekStarting: string | null, dayIndex: number): string {
  if (!weekStarting) return "—";
  const [y, m, d] = weekStarting.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + dayIndex);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${yy}`;
}

function perthDayStartUtcMs(ymd: string): number {
  // Interpret "ymd" as midnight in Australia/Perth (UTC+8), expressed in UTC ms.
  // Using an explicit offset avoids server timezone differences.
  const ms = Date.parse(`${ymd}T00:00:00+08:00`);
  return Number.isFinite(ms) ? ms : Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00+08:00`);
}

function perthDayEndUtcMs(ymd: string): number {
  return perthDayStartUtcMs(ymd) + 24 * 60 * 60 * 1000 - 1;
}

function getEffectiveDayEndMinutes(dateStr: string, todayStr: string): number {
  if (dateStr > todayStr) return 0;
  if (dateStr < todayStr) return TOTAL_MIN;
  // For "today", cap at the current local time in Australia/Perth so the PDF
  // matches what drivers see in-app.
  const { hour, minute } = getPerthNowParts();
  return Math.min(TOTAL_MIN, hour * 60 + minute);
}

function getPerthNowParts(): { ymd: string; hour: number; minute: number } {
  // Avoid relying on runtime timezone databases (some server environments fall back to UTC).
  // Perth is always UTC+8 (no daylight saving), so compute it explicitly from UTC.
  const PERTH_OFFSET_MIN = 8 * 60;
  // Date.now()/getTime() are already milliseconds since epoch (UTC).
  const perth = new Date(Date.now() + PERTH_OFFSET_MIN * 60_000);
  const y = perth.getUTCFullYear();
  const m = perth.getUTCMonth() + 1;
  const d = perth.getUTCDate();
  const hour = perth.getUTCHours();
  const minute = perth.getUTCMinutes();
  const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { ymd, hour, minute };
}

function rangesToGaps(
  ranges: { startMin: number; endMin: number }[],
  totalMin: number
): { startMin: number; endMin: number }[] {
  if (ranges.length === 0) return [{ startMin: 0, endMin: totalMin }];
  const sorted = [...ranges].sort((a, b) => a.startMin - b.startMin);
  const merged: { startMin: number; endMin: number }[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.startMin <= last.endMin) last.endMin = Math.max(last.endMin, r.endMin);
    else merged.push({ startMin: r.startMin, endMin: r.endMin });
  }
  const gaps: { startMin: number; endMin: number }[] = [];
  let pos = 0;
  for (const r of merged) {
    if (r.startMin > pos) gaps.push({ startMin: pos, endMin: r.startMin });
    pos = Math.max(pos, r.endMin);
  }
  if (pos < totalMin) gaps.push({ startMin: pos, endMin: totalMin });
  return gaps;
}

function buildSegmentsFromEvents(
  events: { time: string; type: string }[] | undefined,
  dateStr: string,
  effectiveEndMin: number
): { work_time: { startMin: number; endMin: number }[]; breaks: { startMin: number; endMin: number }[]; non_work: { startMin: number; endMin: number }[] } {
  const segments = {
    work_time: [] as { startMin: number; endMin: number }[],
    breaks: [] as { startMin: number; endMin: number }[],
    non_work: [] as { startMin: number; endMin: number }[],
  };
  const dayStart = perthDayStartUtcMs(dateStr);
  const dayEnd = perthDayEndUtcMs(dateStr);
  if (!events?.length) {
    if (effectiveEndMin > 0) segments.non_work = [{ startMin: 0, endMin: effectiveEndMin }];
    return segments;
  }
  const MIN_BREAK_BLOCK_MINUTES = 10;
  const workOrBreakRanges: { startMin: number; endMin: number }[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type === "stop") continue;
    const end = events[i + 1] ? new Date(events[i + 1].time).getTime() : Date.now();
    const clampedEnd = Math.min(end, dayEnd);
    const start = new Date(ev.time).getTime();
    const clampedStart = Math.max(start, dayStart);
    if (clampedStart >= clampedEnd) continue;
    let startMin = Math.floor((clampedStart - dayStart) / 60000);
    let endMin = Math.min(effectiveEndMin, Math.ceil((clampedEnd - dayStart) / 60000));
    if (startMin >= endMin) continue;
    const durationMinutes = endMin - startMin;
    const treatBreakAsWork = ev.type === "break" && durationMinutes < MIN_BREAK_BLOCK_MINUTES;
    if (ev.type === "work" || treatBreakAsWork) {
      segments.work_time.push({ startMin, endMin });
      workOrBreakRanges.push({ startMin, endMin });
    } else if (ev.type === "break") {
      segments.breaks.push({ startMin, endMin });
      workOrBreakRanges.push({ startMin, endMin });
    }
  }
  if (effectiveEndMin > 0) segments.non_work = rangesToGaps(workOrBreakRanges, effectiveEndMin);
  return segments;
}

function getDaySegments(
  day: { work_time?: boolean[]; breaks?: boolean[]; non_work?: boolean[]; events?: { time: string; type: string }[] },
  dateStr: string,
  todayStr: string
): { work_time: { startMin: number; endMin: number }[]; breaks: { startMin: number; endMin: number }[]; non_work: { startMin: number; endMin: number }[] } {
  const effectiveEndMin = getEffectiveDayEndMinutes(dateStr, todayStr);
  const events = day?.events || [];
  const slotBased = day?.work_time != null && day?.breaks != null && day?.non_work != null;
  const isMinuteCoverage = slotBased && (day.work_time?.length ?? 0) >= MINUTES_PER_DAY;
  if (isMinuteCoverage) {
    return {
      work_time: minuteBooleansToRanges(day.work_time!.map((w, i) => w && !day.breaks![i]), TOTAL_MIN),
      breaks: minuteBooleansToRanges(day.breaks, TOTAL_MIN),
      non_work: minuteBooleansToRanges(day.non_work, effectiveEndMin),
    };
  }
  if (events.length > 0) {
    return buildSegmentsFromEvents(events, dateStr, effectiveEndMin);
  }
  if (slotBased) {
    return {
      work_time: halfHourSlotsToRanges(day.work_time!.map((w, i) => w && !day.breaks![i]), TOTAL_MIN),
      breaks: halfHourSlotsToRanges(day.breaks, TOTAL_MIN),
      non_work: halfHourSlotsToRanges(day.non_work, effectiveEndMin),
    };
  }
  return buildSegmentsFromEvents(undefined, dateStr, effectiveEndMin);
}

function getTotalMinutes(segs: { startMin: number; endMin: number }[]): number {
  return segs.reduce((sum, s) => sum + (s.endMin - s.startMin), 0);
}

function formatHours(minutes: number): string {
  if (minutes === 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function formatDuration(mins: number): string {
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function segmentsToTimeline(segments: {
  work_time: { startMin: number; endMin: number }[];
  breaks: { startMin: number; endMin: number }[];
  non_work: { startMin: number; endMin: number }[];
}): TimelineSegment[] {
  const all: TimelineSegment[] = [
    ...segments.work_time.map((s) => ({ ...s, type: "work" as const })),
    ...segments.breaks.map((s) => ({ ...s, type: "break" as const })),
    ...segments.non_work.map((s) => ({ ...s, type: "non_work" as const })),
  ]
    .filter((s) => s.endMin > s.startMin)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Merge touching segments of the same type to keep the table concise.
  const merged: TimelineSegment[] = [];
  for (const s of all) {
    const last = merged[merged.length - 1];
    if (last && last.type === s.type && s.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, s.endMin);
    } else if (last && last.type === s.type && s.startMin === last.endMin) {
      last.endMin = s.endMin;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

function segmentLabel(type: SegmentType): string {
  if (type === "work") return "Work";
  if (type === "break") return "Break";
  return "Non-Work";
}

function segmentFill(type: SegmentType): [number, number, number] {
  if (type === "work") return GREY_WORK;
  if (type === "break") return GREY_BREAK;
  return GREY_NON_WORK;
}

function cssRgb([r, g, b]: [number, number, number]) {
  return `rgb(${r},${g},${b})`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Display stored ISO timestamps in Australia/Perth for the shift log. */
function formatTimestampPerth(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("en-AU", { timeZone: "Australia/Perth" });
}

function logEventTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t === "work") return "Work";
  if (t === "break") return "Break";
  if (t === "stop") return "End shift";
  if (t === "non_work") return "Non-work";
  return type;
}

type RoadsidePdfPayload = {
  driverName: string;
  weekStarting: string;
  jurisdictionLabel: string;
  violations: { day: string; message: string }[];
  warnings: { day: string; message: string }[];
  disclaimer: string;
  qrDataUrl?: string;
};

function buildRoadsideSectionHtml(r: RoadsidePdfPayload): string {
  const vList = r.violations
    .slice(0, 14)
    .map((x) => `<li><strong>${escapeHtml(x.day)}</strong>: ${escapeHtml(x.message)}</li>`)
    .join("");
  const wList = r.warnings
    .slice(0, 14)
    .map((x) => `<li><strong>${escapeHtml(x.day)}</strong>: ${escapeHtml(x.message)}</li>`)
    .join("");
  const moreV =
    r.violations.length > 14 ? `<p class="roadMore">… and ${r.violations.length - 14} more</p>` : "";
  const moreW =
    r.warnings.length > 14 ? `<p class="roadMore">… and ${r.warnings.length - 14} more</p>` : "";
  const qr = r.qrDataUrl
    ? `<div class="qrWrap"><img class="qrImg" src="${r.qrDataUrl}" alt="QR code" /><div class="qrCap">Read-only snapshot (link expires)</div></div>`
    : "";
  return `
  <section class="roadside">
    <h2>Roadside compliance summary</h2>
    <p class="roadMeta"><strong>Driver:</strong> ${escapeHtml(r.driverName)} &nbsp;|&nbsp; <strong>Week starting:</strong> ${escapeHtml(r.weekStarting)} &nbsp;|&nbsp; <strong>Rules:</strong> ${escapeHtml(r.jurisdictionLabel)}</p>
    <p class="roadCounts"><strong>Violations:</strong> ${r.violations.length} &nbsp;&nbsp; <strong>Warnings:</strong> ${r.warnings.length}</p>
    <div class="roadCols">
      <div class="roadCol">
        <h3>Violations</h3>
        <ul class="roadList">${vList || `<li class="roadEmpty">None</li>`}</ul>
        ${moreV}
      </div>
      <div class="roadCol">
        <h3>Warnings</h3>
        <ul class="roadList">${wList || `<li class="roadEmpty">None</li>`}</ul>
        ${moreW}
      </div>
    </div>
    ${qr}
    <p class="roadDisclaimer">${escapeHtml(r.disclaimer)}</p>
  </section>`;
}

function buildShiftLogHtml(opts: {
  sheet: {
    driver_name: string;
    second_driver: string | null;
    driver_type: string;
    destination: string | null;
    week_starting: string;
    jurisdiction_label: string;
    last_24h_break: string | null;
    status: string;
    signed_at: string | null;
    days: Array<{
      work_time?: boolean[];
      breaks?: boolean[];
      non_work?: boolean[];
      date?: string;
      truck_rego?: string;
      destination?: string;
      start_kms?: number;
      end_kms?: number;
      assume_idle_from?: string;
      events?: Array<{
        time: string;
        type: string;
        lat?: number;
        lng?: number;
        accuracy?: number;
        driver?: "primary" | "second";
      }>;
    }>;
  };
  todayStr: string;
}): string {
  const { sheet, todayStr } = opts;
  const primaryName = (sheet.driver_name || "").trim() || "—";
  const secondName = (sheet.second_driver || "").trim();
  const dayList = (sheet.days || []).slice(0, 7);
  while (dayList.length < 7) dayList.push({});

  const metaRows: { label: string; value: string }[] = [
    { label: "Primary driver", value: primaryName },
    ...(secondName ? [{ label: "Second driver", value: secondName }] as const : []),
    { label: "Driver type", value: sheet.driver_type === "two_up" ? "Two-up" : "Solo" },
    { label: "Week starting", value: sheet.week_starting || "—" },
    { label: "Rules (jurisdiction)", value: sheet.jurisdiction_label || "—" },
    { label: "Destination (sheet)", value: (sheet.destination || "").trim() || "—" },
    {
      label: "Last 24h continuous rest (date)",
      value: (sheet.last_24h_break || "").trim() || "—",
    },
    { label: "Sheet status", value: sheet.status === "completed" ? "Completed" : "Draft" },
    ...(sheet.signed_at
      ? ([
          {
            label: "Signed (Australia/Perth)",
            value: formatTimestampPerth(sheet.signed_at),
          },
        ] as const)
      : []),
  ];

  const metaHtml = metaRows
    .map(
      (r) =>
        `<tr><th scope="row">${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`
    )
    .join("");

  const dayBlocks = dayList
    .map((day, idx) => {
      const dayName = DAY_NAMES[idx] ?? `Day ${idx + 1}`;
      const dateLabel = getDateStr(sheet.week_starting, idx);
      const isoDate = (day as { date?: string }).date || getIsoDate(sheet.week_starting, idx);
      const heading = `${dayName} — ${dateLabel}`;

      const rego = (day as { truck_rego?: string }).truck_rego ?? "";
      const dest = (day as { destination?: string }).destination ?? "";
      const startKms = (day as { start_kms?: number | null }).start_kms;
      const endKms = (day as { end_kms?: number | null }).end_kms;
      const cardBits: string[] = [];
      if (rego) cardBits.push(`Rego: ${rego}`);
      if (dest) cardBits.push(`Destination: ${dest}`);
      if (startKms != null && !Number.isNaN(Number(startKms))) cardBits.push(`Start odometer: ${startKms} km`);
      if (endKms != null && !Number.isNaN(Number(endKms))) cardBits.push(`End odometer: ${endKms} km`);
      const cardLine =
        cardBits.length > 0 ? cardBits.join(" · ") : "No vehicle/route fields entered for this day.";

      const assumeIdle = (day as { assume_idle_from?: string }).assume_idle_from;
      const assumeLine = assumeIdle?.trim()
        ? `<p class="shiftAssume"><strong>Assume non-work from:</strong> ${escapeHtml(formatTimestampPerth(assumeIdle))}</p>`
        : "";

      const events = (day as {
        events?: Array<{
          time: string;
          type: string;
          lat?: number;
          lng?: number;
          accuracy?: number;
          driver?: string;
        }>;
      }).events;
      const hasEvents = Array.isArray(events) && events.length > 0;

      const isTwoUp = sheet.driver_type === "two_up";
      let bodyHtml: string;
      if (hasEvents) {
        const rows = events!
          .filter((ev) => ev && ev.time)
          .map((ev) => {
            const typeLabel = logEventTypeLabel(ev.type || "");
            let driverCol = "—";
            if (isTwoUp && ev.driver === "second") {
              driverCol = secondName || "Second driver";
            } else if (isTwoUp && ev.driver === "primary") {
              driverCol = primaryName;
            } else if (isTwoUp) {
              driverCol = "—";
            }
            let loc = "—";
            if (ev.lat != null && ev.lng != null && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
              loc = `${ev.lat.toFixed(5)}, ${ev.lng.toFixed(5)}`;
              if (ev.accuracy != null && Number.isFinite(ev.accuracy)) {
                loc += ` (±${Math.round(ev.accuracy)} m)`;
              }
            }
            const cells = isTwoUp
              ? `<td class="mono">${escapeHtml(formatTimestampPerth(ev.time))}</td>
              <td>${escapeHtml(typeLabel)}</td>
              <td>${escapeHtml(driverCol)}</td>
              <td class="mono">${escapeHtml(loc)}</td>`
              : `<td class="mono">${escapeHtml(formatTimestampPerth(ev.time))}</td>
              <td>${escapeHtml(typeLabel)}</td>
              <td class="mono">${escapeHtml(loc)}</td>`;
            return `<tr>${cells}</tr>`;
          })
          .join("");
        const thead = isTwoUp
          ? "<tr><th>Time (Australia/Perth)</th><th>Type</th><th>Driver (two-up)</th><th>Location</th></tr>"
          : "<tr><th>Time (Australia/Perth)</th><th>Type</th><th>Location</th></tr>";
        const emptyColspan = isTwoUp ? 4 : 3;
        bodyHtml = `
          <p class="shiftSource">Logged events (exact times and types as recorded in the app).</p>
          <table class="shiftEventTable">
            <thead>${thead}</thead>
            <tbody>${rows || `<tr><td colspan="${emptyColspan}" class="empty">No events</td></tr>`}</tbody>
          </table>`;
      } else {
        const segments = getDaySegments(day, isoDate, todayStr);
        const timeline = segmentsToTimeline(segments);
        const rows = timeline.map((seg) => {
          return `<tr>
            <td class="mono">${escapeHtml(minToHHMM(seg.startMin))}</td>
            <td class="mono">${escapeHtml(minToHHMM(seg.endMin))}</td>
            <td class="mono">${escapeHtml(formatDuration(seg.endMin - seg.startMin))}</td>
            <td>${escapeHtml(segmentLabel(seg.type))}</td>
          </tr>`;
        }).join("");
        bodyHtml = `
          <p class="shiftSource">Time blocks derived from the diary grid (work / break / non-work) for this day — use when no event log is stored.</p>
          <table class="shiftEventTable">
            <thead><tr><th>Start</th><th>End</th><th>Duration</th><th>Type</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4" class="empty">No time recorded</td></tr>`}</tbody>
          </table>`;
      }

      return `
        <section class="shiftDay">
          <h4>${escapeHtml(heading)}</h4>
          <p class="shiftCard">${escapeHtml(cardLine)}</p>
          ${assumeLine}
          ${bodyHtml}
        </section>`;
    })
    .join("");

  return `
  <section class="shiftLog">
    <h2>SHIFT LOG (Appendix)</h2>
    <p class="shiftIntro">Plain record of driver-entered data for this weekly sheet: identification, day cards, then either logged events (tap log) or time blocks from the diary grid. Times are shown in Australia/Perth unless otherwise noted.</p>
    <table class="shiftMeta">
      <tbody>${metaHtml}</tbody>
    </table>
    ${dayBlocks}
  </section>`;
}

function renderPdfHtml(opts: {
  sheet: {
    driver_name: string;
    second_driver: string | null;
    driver_type: string;
    destination: string | null;
    week_starting: string;
    jurisdiction_label: string;
    last_24h_break: string | null;
    status: string;
    signed_at: string | null;
    days: Array<{
      work_time?: boolean[];
      breaks?: boolean[];
      non_work?: boolean[];
      date?: string;
      truck_rego?: string;
      destination?: string;
      start_kms?: number;
      end_kms?: number;
      assume_idle_from?: string;
      events?: Array<{
        time: string;
        type: string;
        lat?: number;
        lng?: number;
        accuracy?: number;
        driver?: "primary" | "second";
      }>;
    }>;
  };
  todayStr: string;
  generatedAtLabel: string;
  roadside?: RoadsidePdfPayload;
}) {
  const { sheet, todayStr, generatedAtLabel, roadside } = opts;
  const dayList = (sheet.days || []).slice(0, 7);
  while (dayList.length < 7) dayList.push({});

  const hourLabels = Array.from({ length: 13 }, (_, i) => i * 2);
  const rows = [
    { key: "work_time" as const, label: "Work", fill: cssRgb(GREY_WORK), hatch: false },
    { key: "breaks" as const, label: "Break", fill: cssRgb(GREY_BREAK), hatch: true },
    { key: "non_work" as const, label: "Non-Work", fill: cssRgb(GREY_NON_WORK), hatch: false },
  ];

  const dayBlocks = dayList
    .map((day, idx) => {
      const dayName = DAY_NAMES[idx] ?? `Day ${idx + 1}`;
      const dateLabel = getDateStr(sheet.week_starting, idx);
      const isoDate = (day as { date?: string }).date || getIsoDate(sheet.week_starting, idx);
      const segments = getDaySegments(day, isoDate, todayStr);
      const timeline = segmentsToTimeline(segments);
      const maxRows = 8;

      const totals = {
        work: formatHours(getTotalMinutes(segments.work_time)),
        break: formatHours(getTotalMinutes(segments.breaks)),
        nonWork: formatHours(getTotalMinutes(segments.non_work)),
      };

      const barsHtml = rows
        .map((r) => {
          const segs = segments[r.key];
          const segDivs = segs
            .filter((s) => s.endMin > s.startMin)
            .map((s) => {
              const left = (s.startMin / TOTAL_MIN) * 100;
              const width = ((s.endMin - s.startMin) / TOTAL_MIN) * 100;
              const style = `left:${left}%;width:${Math.max(0.2, width)}%;background:${r.fill};`;
              return `<div class="seg${r.hatch ? " hatch" : ""}" style="${style}"></div>`;
            })
            .join("");

          return `
            <div class="barRow">
              <div class="rowLabel">${escapeHtml(r.label)}</div>
              <div class="bar">
                ${segDivs}
                <div class="grid">
                  ${Array.from({ length: 25 }, (_, h) => {
                    const strong = h % 2 === 0;
                    return `<div class="gridLine ${strong ? "strong" : ""}" style="left:${(h / 24) * 100}%"></div>`;
                  }).join("")}
                </div>
              </div>
              <div class="rowTotal">${escapeHtml(formatHours(getTotalMinutes(segs)))}</div>
            </div>
          `;
        })
        .join("");

      const tableRows = timeline.slice(0, maxRows).map((seg) => {
        return `<tr>
          <td class="mono">${escapeHtml(minToHHMM(seg.startMin))}</td>
          <td class="mono">${escapeHtml(minToHHMM(seg.endMin))}</td>
          <td class="mono">${escapeHtml(formatDuration(seg.endMin - seg.startMin))}</td>
          <td>${escapeHtml(segmentLabel(seg.type))}</td>
          <td class="notes"></td>
        </tr>`;
      }).join("");

      const more = timeline.length > maxRows ? `<div class="more">(+${timeline.length - maxRows} more segments)</div>` : "";

      return `
        <section class="dayCard">
          <div class="dayHead">
            <div class="dayBadge">${escapeHtml(dayName.charAt(0))}</div>
            <div class="dayTitles">
              <div class="dayName">${escapeHtml(dayName)}</div>
              <div class="dayDate">${escapeHtml(dateLabel)}</div>
            </div>
          </div>
          <div class="hours">
            <div class="hoursSpacer"></div>
            <div class="hoursBar">
              ${hourLabels.map((h) => `<div class="hourLabel" style="left:${(h / 24) * 100}%">${pad2(h)}</div>`).join("")}
            </div>
            <div class="hoursTotal"></div>
          </div>
          ${barsHtml}
          <div class="totals">Work: ${escapeHtml(totals.work)} &nbsp;&nbsp; Break: ${escapeHtml(totals.break)} &nbsp;&nbsp; Non-Work: ${escapeHtml(totals.nonWork)}</div>
          <table class="segTable">
            <thead><tr><th>Start</th><th>End</th><th>Dur</th><th>Type</th><th>Notes</th></tr></thead>
            <tbody>${tableRows || `<tr><td colspan="5" class="empty">No segments</td></tr>`}</tbody>
          </table>
          ${more}
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1e293b; }
        .header { background: #0f172a; color: white; padding: 12px 14px; border-radius: 10px; }
        .headerRow { display:flex; justify-content:space-between; align-items:flex-end; gap: 10px; }
        .title { font-weight: 800; font-size: 18px; letter-spacing: 0.02em; }
        .subtitle { font-size: 11px; opacity: 0.9; margin-top: 2px; }
        .generated { font-size: 10px; opacity: 0.9; text-align:right; white-space:nowrap; }
        .dayCard { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 10px 8px; margin: 10px 0; break-inside: avoid; }
        .dayHead { display:flex; align-items:flex-start; gap: 10px; }
        .dayBadge { width: 18px; height: 18px; background:#1f2937; color:white; font-weight:800; font-size: 11px; display:flex; align-items:center; justify-content:center; border-radius: 4px; margin-top: 1px; }
        .dayName { font-weight: 800; font-size: 14px; }
        .dayDate { font-size: 11px; color: #6b7280; margin-top: 1px; }
        .hours { display:flex; align-items:flex-end; gap: 8px; margin-top: 6px; }
        .hoursSpacer { width: 92px; }
        .hoursBar { position: relative; height: 16px; flex: 1; }
        .hourLabel { position:absolute; transform: translateX(-50%); top: 0; font-size: 9px; color:#6b7280; }
        .hoursTotal { width: 46px; }
        .barRow { display:flex; align-items:center; gap: 8px; margin-top: 4px; }
        .rowLabel { width: 92px; font-size: 11px; color: #374151; text-align:right; }
        .rowTotal { width: 46px; font-size: 11px; font-weight: 700; color: #111827; }
        .bar { position: relative; height: 12px; flex: 1; border: 1px solid #9ca3af; border-radius: 2px; overflow: hidden;
               background: repeating-linear-gradient(90deg, #ffffff 0, #ffffff 8.333%, #f3f4f6 8.333%, #f3f4f6 16.666%); }
        .seg { position:absolute; top:0; bottom:0; }
        .seg.hatch { background-image: repeating-linear-gradient(135deg, rgba(0,0,0,0.15) 0 1px, rgba(0,0,0,0) 1px 4px); }
        .grid { position:absolute; inset:0; pointer-events:none; }
        .gridLine { position:absolute; top:0; bottom:0; width: 0; border-left: 1px solid rgba(156,163,175,0.35); }
        .gridLine.strong { border-left-color: rgba(75,85,99,0.6); }
        .totals { margin: 6px 0 6px 100px; font-size: 11px; font-weight: 700; color:#111827; }
        .segTable { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 4px; }
        .segTable thead th { text-align:left; padding: 4px 6px; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; color:#6b7280; font-weight: 800; }
        .segTable tbody td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }
        .segTable tbody tr:nth-child(even) td { background: #fafafa; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .empty { color:#9ca3af; font-style: italic; }
        .more { font-size: 10px; color:#6b7280; margin-left: 100px; margin-top: 2px; }
        .roadside { margin: 12px 0 16px; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; break-inside: avoid; }
        .roadside h2 { font-size: 15px; font-weight: 800; margin: 0 0 8px; color: #0f172a; }
        .roadside h3 { font-size: 11px; font-weight: 800; margin: 0 0 4px; color: #334155; }
        .roadMeta { font-size: 10px; color: #334155; margin: 0 0 6px; line-height: 1.35; }
        .roadCounts { font-size: 11px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
        .roadCols { display: flex; gap: 12px; align-items: flex-start; }
        .roadCol { flex: 1; min-width: 0; }
        .roadList { margin: 0; padding-left: 14px; font-size: 9.5px; color: #1e293b; }
        .roadList li { margin-bottom: 2px; }
        .roadEmpty { color: #94a3b8; font-style: italic; list-style: none; margin-left: -14px; }
        .roadMore { font-size: 9px; color: #64748b; margin: 4px 0 0; }
        .qrWrap { display: flex; flex-direction: column; align-items: flex-start; margin-top: 10px; gap: 4px; }
        .qrImg { width: 120px; height: 120px; image-rendering: pixelated; }
        .qrCap { font-size: 9px; color: #64748b; }
        .roadDisclaimer { font-size: 8.5px; color: #475569; margin: 10px 0 0; line-height: 1.35; }
        .shiftLog { margin-top: 18px; page-break-before: always; break-inside: auto; }
        .shiftLog h2 { font-size: 15px; font-weight: 800; margin: 0 0 8px; color: #0f172a; }
        .shiftIntro { font-size: 9.5px; color: #64748b; margin: 0 0 12px; line-height: 1.45; }
        .shiftMeta { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 14px; }
        .shiftMeta th { text-align: left; width: 42%; padding: 4px 8px 4px 0; color: #475569; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
        .shiftMeta td { padding: 4px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
        .shiftDay { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin: 0 0 10px; break-inside: avoid; background: #fafafa; }
        .shiftDay h4 { font-size: 12px; font-weight: 800; margin: 0 0 6px; color: #0f172a; }
        .shiftCard { font-size: 10px; color: #334155; margin: 0 0 8px; line-height: 1.4; }
        .shiftAssume { font-size: 9.5px; color: #92400e; margin: 0 0 8px; }
        .shiftSource { font-size: 9.5px; color: #64748b; margin: 0 0 6px; line-height: 1.35; }
        .shiftEventTable { width: 100%; border-collapse: collapse; font-size: 9.5px; }
        .shiftEventTable thead th { text-align: left; padding: 5px 6px; border-bottom: 1px solid #cbd5e1; color: #475569; font-weight: 800; background: #f1f5f9; }
        .shiftEventTable tbody td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .shiftEventTable tbody tr:nth-child(even) td { background: #fff; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="headerRow">
          <div>
            <div class="title">${PRODUCT_NAME_EXPORT}</div>
            <div class="subtitle">${TAGLINE_DRIVER}</div>
          </div>
          <div class="generated">Generated: ${escapeHtml(generatedAtLabel)}</div>
        </div>
      </div>
      ${roadside ? buildRoadsideSectionHtml(roadside) : ""}
      ${dayBlocks}
      ${buildShiftLogHtml({ sheet, todayStr })}
    </body>
  </html>`;
}

function getIsoDate(weekStarting: string | null, dayIndex: number): string {
  if (!weekStarting) return new Date().toISOString().slice(0, 10);
  const [y, m, d] = weekStarting.split("-").map(Number);
  const date = new Date(y, m - 1, d + dayIndex);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** jsPDF fallback: roadside block below title header. */
function renderRoadsideJsPDF(
  doc: jsPDF,
  margin: number,
  colW: number,
  yStart: number,
  roadside: RoadsidePdfPayload
): number {
  let y = yStart;
  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Roadside compliance summary", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const meta = `Driver: ${roadside.driverName}  |  Week: ${roadside.weekStarting}  |  Rules: ${roadside.jurisdictionLabel}`;
  const metaLines = doc.splitTextToSize(meta, colW);
  doc.text(metaLines, margin, y);
  y += metaLines.length * 3.6 + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Violations: ${roadside.violations.length}    Warnings: ${roadside.warnings.length}`, margin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text("Violations", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const vText = roadside.violations
    .slice(0, 12)
    .map((v) => `• ${v.day}: ${v.message}`)
    .join("\n");
  const vLines = doc.splitTextToSize(vText || "(none)", colW);
  doc.text(vLines, margin, y);
  y += vLines.length * 3.2 + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Warnings", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const wText = roadside.warnings
    .slice(0, 12)
    .map((w) => `• ${w.day}: ${w.message}`)
    .join("\n");
  const wLines = doc.splitTextToSize(wText || "(none)", colW);
  doc.text(wLines, margin, y);
  y += wLines.length * 3.2 + 4;
  if (roadside.qrDataUrl?.startsWith("data:image/png;base64,")) {
    const b64 = roadside.qrDataUrl.replace(/^data:image\/png;base64,/, "");
    if (y > 220) {
      doc.addPage();
      y = 20;
    }
    try {
      doc.addImage(b64, "PNG", margin, y, 28, 28);
    } catch {
      /* ignore */
    }
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("Read-only snapshot (link expires)", margin, y + 32);
    y += 38;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(70, 70, 70);
  const disc = doc.splitTextToSize(roadside.disclaimer, colW);
  doc.text(disc, margin, y);
  y += disc.length * 3.5 + 8;
  return y;
}

/** jsPDF fallback: shift log appendix (same intent as `buildShiftLogHtml`). Always begins on a new page. */
function renderShiftLogJsPDF(
  doc: jsPDF,
  margin: number,
  colW: number,
  sheet: {
    driver_name: string;
    second_driver: string | null;
    driver_type: string;
    destination: string | null;
    week_starting: string;
    jurisdiction_label: string;
    last_24h_break: string | null;
    status: string;
    signed_at: string | null;
    days: Array<Record<string, unknown>>;
  },
  todayStr: string
): number {
  doc.addPage();
  let y = 18;
  const pageBreak = () => {
    doc.addPage();
    y = 16;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text("SHIFT LOG (Appendix)", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const intro = doc.splitTextToSize(
    "Plain record of driver-entered data for this weekly sheet: identification, day cards, then logged events or time blocks from the grid. Times in Australia/Perth unless noted.",
    colW
  );
  doc.text(intro, margin, y);
  y += intro.length * 3.5 + 6;

  const metaBits: string[] = [
    `Primary driver: ${sheet.driver_name || "—"}`,
    ...(sheet.second_driver?.trim() ? [`Second driver: ${sheet.second_driver.trim()}`] : []),
    `Driver type: ${sheet.driver_type === "two_up" ? "Two-up" : "Solo"}`,
    `Week starting: ${sheet.week_starting || "—"}`,
    `Rules: ${sheet.jurisdiction_label || "—"}`,
    `Destination (sheet): ${(sheet.destination || "").trim() || "—"}`,
    `Last 24h rest (date): ${(sheet.last_24h_break || "").trim() || "—"}`,
    `Status: ${sheet.status === "completed" ? "Completed" : "Draft"}`,
    ...(sheet.signed_at ? [`Signed: ${formatTimestampPerth(sheet.signed_at)}`] : []),
  ];
  doc.setTextColor(50, 50, 50);
  for (const bit of metaBits) {
    const wrapped = doc.splitTextToSize(bit, colW);
    if (y + wrapped.length * 3.6 > 275) pageBreak();
    doc.text(wrapped, margin, y);
    y += wrapped.length * 3.6 + 0.5;
  }
  y += 4;

  const primaryName = (sheet.driver_name || "").trim() || "—";
  const secondName = (sheet.second_driver || "").trim();
  const isTwoUp = sheet.driver_type === "two_up";
  const dayList = (sheet.days || []).slice(0, 7);
  while (dayList.length < 7) dayList.push({});

  for (let idx = 0; idx < 7; idx++) {
    const day = dayList[idx];
    const dayName = DAY_NAMES[idx] ?? `Day ${idx + 1}`;
    const dateLabel = getDateStr(sheet.week_starting, idx);
    const isoDate =
      (typeof (day as { date?: string }).date === "string" && (day as { date?: string }).date) ||
      getIsoDate(sheet.week_starting, idx);

    if (y > 235) pageBreak();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(`${dayName} — ${dateLabel}`, margin, y);
    y += 5;

    const rego = String((day as { truck_rego?: string }).truck_rego ?? "");
    const dest = String((day as { destination?: string }).destination ?? "");
    const sk = (day as { start_kms?: number | null }).start_kms;
    const ek = (day as { end_kms?: number | null }).end_kms;
    const cardBits: string[] = [];
    if (rego) cardBits.push(`Rego: ${rego}`);
    if (dest) cardBits.push(`Destination: ${dest}`);
    if (sk != null && !Number.isNaN(Number(sk))) cardBits.push(`Start odometer: ${sk} km`);
    if (ek != null && !Number.isNaN(Number(ek))) cardBits.push(`End odometer: ${ek} km`);
    const cardLine =
      cardBits.length > 0 ? cardBits.join(" · ") : "No vehicle/route fields entered for this day.";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    const cardWrapped = doc.splitTextToSize(cardLine, colW);
    doc.text(cardWrapped, margin, y);
    y += cardWrapped.length * 3.5 + 2;

    const assumeIdle = (day as { assume_idle_from?: string }).assume_idle_from;
    if (assumeIdle?.trim()) {
      doc.setTextColor(120, 60, 10);
      const a = doc.splitTextToSize(
        `Assume non-work from: ${formatTimestampPerth(assumeIdle.trim())}`,
        colW
      );
      doc.text(a, margin, y);
      y += a.length * 3.5 + 2;
      doc.setTextColor(50, 50, 50);
    }

    const events = (day as { events?: Array<Record<string, unknown>> }).events;
    const evList = Array.isArray(events) ? events : [];
    const hasEvents = evList.some((ev) => ev && typeof (ev as { time?: string }).time === "string");

    if (hasEvents) {
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      const src = doc.splitTextToSize("Logged events (as recorded in the app).", colW);
      doc.text(src, margin, y);
      y += src.length * 3.2 + 2;
      doc.setTextColor(30, 30, 30);
      for (const ev of evList) {
        const time = (ev as { time?: string }).time;
        if (!time) continue;
        const typeLabel = logEventTypeLabel(String((ev as { type?: string }).type ?? ""));
        let driverCol = "—";
        if (isTwoUp) {
          if ((ev as { driver?: string }).driver === "second") driverCol = secondName || "Second";
          else if ((ev as { driver?: string }).driver === "primary") driverCol = primaryName;
        }
        let loc = "—";
        const lat = (ev as { lat?: number }).lat;
        const lng = (ev as { lng?: number }).lng;
        const acc = (ev as { accuracy?: number }).accuracy;
        if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
          loc = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          if (acc != null && Number.isFinite(acc)) loc += ` (±${Math.round(acc)} m)`;
        }
        const line = isTwoUp
          ? `${formatTimestampPerth(time)}  |  ${typeLabel}  |  ${driverCol}  |  ${loc}`
          : `${formatTimestampPerth(time)}  |  ${typeLabel}  |  ${loc}`;
        const wrapped = doc.splitTextToSize(line, colW);
        if (y + wrapped.length * 3.2 > 278) pageBreak();
        doc.setFontSize(7.5);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 3.2 + 0.5;
      }
    } else {
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      const src = doc.splitTextToSize(
        "Time blocks derived from the diary grid for this day (no event log stored).",
        colW
      );
      doc.text(src, margin, y);
      y += src.length * 3.2 + 2;
      doc.setTextColor(30, 30, 30);
      const segments = getDaySegments(
        day as { work_time?: boolean[]; breaks?: boolean[]; non_work?: boolean[]; events?: { time: string; type: string }[] },
        isoDate,
        todayStr
      );
      const timeline = segmentsToTimeline(segments);
      const cap = 60;
      const slice = timeline.slice(0, cap);
      for (const seg of slice) {
        const row = `${minToHHMM(seg.startMin)} – ${minToHHMM(seg.endMin)}  |  ${formatDuration(seg.endMin - seg.startMin)}  |  ${segmentLabel(seg.type)}`;
        if (y > 278) pageBreak();
        doc.setFontSize(7.5);
        doc.text(row, margin, y);
        y += 3.5;
      }
      if (timeline.length > cap) {
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(`(+${timeline.length - cap} more segments)`, margin, y);
        y += 4;
        doc.setTextColor(30, 30, 30);
      }
    }

    y += 4;
  }

  return y;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const row = await prisma.fatigueSheet.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    if (!canAccessSheet(row, access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let days: Array<{
        work_time?: boolean[];
        breaks?: boolean[];
        non_work?: boolean[];
        date?: string;
        truck_rego?: string;
        destination?: string;
        start_kms?: number;
        end_kms?: number;
        assume_idle_from?: string;
        events?: Array<{
          time: string;
          type: string;
          lat?: number;
          lng?: number;
          accuracy?: number;
          driver?: "primary" | "second";
        }>;
      }>;
    try {
      const parsed = row.days ? JSON.parse(row.days) : [];
      days = Array.isArray(parsed) ? parsed : [];
    } catch {
      days = [];
    }

    const jurisdictionLabel = jurisdictionDisplayLabel(parseJurisdictionCode(row.jurisdictionCode));

    const sheet = {
      driver_name: row.driverName,
      second_driver: row.secondDriver,
      driver_type: row.driverType,
      destination: row.destination,
      week_starting: row.weekStarting,
      days,
      status: row.status,
      signature: row.signature,
      signed_at: row.signedAt?.toISOString() ?? null,
      jurisdiction_label: jurisdictionLabel,
      last_24h_break: row.last24hBreak,
    };

    const roadsideExtras = await prepareRoadsidePdfExtras(prisma, row, id);
    const rv = roadsideExtras.results.filter((r) => r.type === "violation");
    const rw = roadsideExtras.results.filter((r) => r.type === "warning");
    const roadsidePayload: RoadsidePdfPayload = {
      driverName: row.driverName,
      weekStarting: row.weekStarting,
      jurisdictionLabel: roadsideExtras.jurisdictionLabel,
      violations: rv.map((v) => ({ day: v.day, message: v.message })),
      warnings: rw.map((w) => ({ day: w.day, message: w.message })),
      disclaimer: ROADSIDE_PDF_DISCLAIMER,
      qrDataUrl: roadsideExtras.qrDataUrl,
    };

    // Prefer server-side Chromium PDF (WYSIWYG). Fallback to jsPDF if Chromium isn't available.
    try {
      const [{ default: chromium }, puppeteer] = await Promise.all([
        import("@sparticuz/chromium"),
        import("puppeteer-core"),
      ]);

      const executablePath = await chromium.executablePath();
      if (!executablePath) throw new Error("Chromium executablePath not available");

      const todayStr = getPerthNowParts().ymd;
      const generatedAtLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" });
      const html = renderPdfHtml({
        sheet: {
          driver_name: row.driverName,
          second_driver: row.secondDriver,
          driver_type: row.driverType,
          destination: row.destination,
          week_starting: row.weekStarting,
          days,
          jurisdiction_label: jurisdictionLabel,
          last_24h_break: row.last24hBreak,
          status: row.status,
          signed_at: row.signedAt?.toISOString() ?? null,
        },
        todayStr,
        generatedAtLabel,
        roadside: roadsidePayload,
      });

      const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath,
        headless: true,
      });

      try {
        const page = await browser.newPage();
        // Force the browser engine timezone to Perth (helps any incidental Date formatting in HTML).
        try {
          const maybe = page as unknown as { emulateTimezone?: (tz: string) => Promise<void> };
          if (typeof maybe.emulateTimezone === "function") {
            await maybe.emulateTimezone("Australia/Perth");
          }
        } catch {
          /* ignore */
        }
        await page.setContent(html, { waitUntil: "load" });
        const pdfBytes = await page.pdf({
          format: "A4",
          printBackground: true,
          preferCSSPageSize: true,
        });

        const timeStamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "");
        const safeName = (row.driverName || "unknown").replace(/[\s"\r\n\\]+/g, "-").replace(/[^\w\-.]/g, "") || "sheet";
        const filename = `fatigue-sheet-${safeName}-${timeStamp}.pdf`;
        return new NextResponse(Buffer.from(pdfBytes), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "private, no-store, max-age=0, must-revalidate",
            Pragma: "no-cache",
          },
        });
      } finally {
        await browser.close();
      }
    } catch (e) {
      // Fall back to jsPDF path below.
    }

    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 14;
    const colW = pageW - margin * 2;
    const todayStr = getPerthNowParts().ymd;
    let y = 30;
    const labelW = 22;
    const subtotalW = 16;
    const barW = colW - labelW - subtotalW - 4;
    const barLeft = margin + labelW;
    const tilePadding = 3;
    const tickH = 4;
    const rowH = 3;
    const rowGap = 1.2;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(PRODUCT_NAME_EXPORT, margin, 11);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(TAGLINE_DRIVER, margin, 18);
    doc.text(
      `Generated: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" })}`,
      pageW - margin,
      18,
      { align: "right" }
    );

    y = renderRoadsideJsPDF(doc, margin, colW, y, roadsidePayload);

    const dayList = (sheet.days || []).slice(0, 7);
    while (dayList.length < 7) dayList.push({});

    dayList.forEach((day, idx) => {
      if (y > 258) {
        doc.addPage();
        y = 20;
      }
      const dayName = DAY_NAMES[idx] ?? `Day ${idx + 1}`;
      const dateStr = getDateStr(sheet.week_starting, idx);
      const isoDate = (day as { date?: string }).date || getIsoDate(sheet.week_starting, idx);
      const segments = getDaySegments(day, isoDate, todayStr);
      const timeline = segmentsToTimeline(segments);

      // Header (day + meta) + hour labels + 3-row bars + table header + up to N rows.
      const maxRows = 8;
      const rowCount = Math.min(maxRows, timeline.length);
      const tableRowH = 4.2;
      const tableH = 5.5 + rowCount * tableRowH + 2;
      const barsH = 3 * rowH + 2 * rowGap;
      const tileContentH = 10 + 6 + tickH + 1 + barsH + 2 + tableH + 4;
      const tileH = tileContentH + tilePadding * 2;
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(...GREY_LIGHT);
      doc.rect(margin, y - tilePadding, colW, tileH, "FD");
      y += 2;

      doc.setFillColor(30, 30, 30);
      doc.rect(margin + 2, y - 3.5, 5, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(dayName.charAt(0), margin + 4.5, y + 0.2, { align: "center" });
      doc.setTextColor(...GREY_TEXT);
      doc.setFontSize(10);
      doc.text(dayName, margin + 10, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GREY_LABEL);
      doc.text(dateStr, margin + 10, y + 5);
      const dayWithKms = day as { truck_rego?: string; destination?: string; start_kms?: number; end_kms?: number };
      const rego = dayWithKms.truck_rego ?? "";
      const dest = dayWithKms.destination ?? "";
      const startKms = dayWithKms.start_kms ?? null;
      const endKms = dayWithKms.end_kms ?? null;
      const kmsTotal = startKms != null && endKms != null ? Math.max(0, endKms - startKms) : null;
      const metaParts: string[] = [];
      if (rego) metaParts.push(`Rego: ${rego}`);
      if (dest) metaParts.push(dest);
      if (startKms != null) metaParts.push(`Start: ${startKms} km`);
      if (endKms != null) metaParts.push(`End: ${endKms} km`);
      if (kmsTotal != null) metaParts.push(`Total: ${kmsTotal} km`);
      if (metaParts.length) {
        doc.setFontSize(8);
        doc.text(metaParts.join("  •  "), margin + 2, y + 10);
      }
      y += 10 + 6;

      doc.setFontSize(7);
      doc.setTextColor(...GREY_LABEL);
      for (let h = 0; h <= 24; h += 2) {
        const x = barLeft + (h / 24) * barW;
        doc.text(String(h).padStart(2, "0"), x, y + tickH * 0.7, { align: "center" });
      }
      y += tickH + 1;

      // 3-row time bars (original style, higher contrast)
      const rowsCfg = [
        { label: ROW_LABELS[0], segs: segments.work_time, fill: GREY_WORK },
        { label: ROW_LABELS[1], segs: segments.breaks, fill: GREY_BREAK, hatch: true },
        { label: ROW_LABELS[2], segs: segments.non_work, fill: GREY_NON_WORK },
      ] as const;

      rowsCfg.forEach((r, ri) => {
        const totalMins = getTotalMinutes(r.segs);

        // Row label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...GREY_TEXT);
        doc.text(r.label, margin + labelW - 1, y + rowH * 0.7, { align: "right" });

        // Background with hour banding
        for (let h = 0; h < 24; h++) {
          const x = barLeft + (h / 24) * barW;
          const w = barW / 24;
          const isAlt = h % 2 === 0;
          doc.setFillColor(isAlt ? 250 : 238, isAlt ? 250 : 238, isAlt ? 250 : 238);
          doc.rect(x, y, w, rowH, "F");
        }

        // Hour grid lines (strong on 2-hour, light on 1-hour)
        for (let h = 0; h <= 24; h++) {
          const x = barLeft + (h / 24) * barW;
          const strong = h % 2 === 0;
          doc.setDrawColor(strong ? 160 : 205, strong ? 160 : 205, strong ? 160 : 205);
          doc.setLineWidth(strong ? 0.25 : 0.12);
          doc.line(x, y, x, y + rowH);
        }

        // Segments fill
        doc.setLineWidth(0.2);
        r.segs.forEach((seg) => {
          const left = (seg.startMin / TOTAL_MIN) * barW;
          const w = Math.max(0.7, ((seg.endMin - seg.startMin) / TOTAL_MIN) * barW);
          doc.setFillColor(...r.fill);
          doc.rect(barLeft + left, y, w, rowH, "F");
          if ("hatch" in r && r.hatch) {
            doc.setDrawColor(60, 60, 60);
            doc.setLineWidth(0.1);
            const x0 = barLeft + left;
            const x1 = x0 + w;
            for (let lx = x0 - rowH; lx < x1 + rowH; lx += 2.4) {
              doc.line(lx, y + rowH, lx + rowH, y);
            }
          }
        });

        // Strong outline
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.35);
        doc.rect(barLeft, y, barW, rowH, "S");

        // Subtotal at right
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...GREY_TEXT);
        doc.text(formatHours(totalMins), barLeft + barW + 2, y + rowH * 0.7);

        y += rowH + (ri === 2 ? 2 : rowGap);
      });

      // Segment list table (audit-proof detail)
      const tableLeft = margin + 2;
      const tableW = colW - 4;
      const colStartW = 18;
      const colEndW = 18;
      const colDurW = 18;
      const colTypeW = 22;
      const colNotesW = tableW - (colStartW + colEndW + colDurW + colTypeW);

      doc.setDrawColor(210, 210, 210);
      doc.setFillColor(250, 250, 250);
      doc.rect(tableLeft, y, tableW, 5.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY_LABEL);
      const thY = y + 3.8;
      doc.text("Start", tableLeft + 1.5, thY);
      doc.text("End", tableLeft + colStartW + 1.5, thY);
      doc.text("Dur", tableLeft + colStartW + colEndW + 1.5, thY);
      doc.text("Type", tableLeft + colStartW + colEndW + colDurW + 1.5, thY);
      doc.text("Notes", tableLeft + colStartW + colEndW + colDurW + colTypeW + 1.5, thY);
      y += 5.5;

      const rows = timeline.slice(0, maxRows);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      rows.forEach((seg, i) => {
        const rowY = y + i * tableRowH;
        const isAlt = i % 2 === 0;
        doc.setFillColor(isAlt ? 255 : 252, isAlt ? 255 : 252, isAlt ? 255 : 252);
        doc.rect(tableLeft, rowY, tableW, tableRowH, "F");
        doc.setDrawColor(230, 230, 230);
        doc.line(tableLeft, rowY + tableRowH, tableLeft + tableW, rowY + tableRowH);

        doc.setTextColor(...GREY_TEXT);
        doc.text(minToHHMM(seg.startMin), tableLeft + 1.5, rowY + 3);
        doc.text(minToHHMM(seg.endMin), tableLeft + colStartW + 1.5, rowY + 3);
        doc.text(formatDuration(seg.endMin - seg.startMin), tableLeft + colStartW + colEndW + 1.5, rowY + 3);
        doc.text(segmentLabel(seg.type), tableLeft + colStartW + colEndW + colDurW + 1.5, rowY + 3);

        // Notes: kept for future (e.g., GPS, rego, destination, or compliance markers).
        const note =
          seg.type === "break"
            ? "Break recorded"
            : seg.type === "work"
              ? "Work recorded"
              : "";
        const clipped = doc.splitTextToSize(note, colNotesW - 3);
        if (clipped?.[0]) {
          doc.setTextColor(...GREY_LABEL);
          doc.text(String(clipped[0]), tableLeft + colStartW + colEndW + colDurW + colTypeW + 1.5, rowY + 3);
        }
      });
      y += rows.length * tableRowH + 2;

      if (timeline.length > maxRows) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...GREY_LABEL);
        doc.text(`(+${timeline.length - maxRows} more segments)`, margin + 2, y + 2.5);
        y += 4;
      }

      y += tilePadding + 4;
    });

    y = renderShiftLogJsPDF(doc, margin, colW, sheet, todayStr);

    y += 4;
    if (sheet.signature) {
      if (y > 220) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(...GREY_TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("DRIVER SIGNATURE", margin, y);
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, 80, 30);
      try {
        doc.addImage(sheet.signature, "PNG", margin + 1, y + 1, 78, 28);
      } catch {
        /* skip if image fails */
      }
      if (sheet.signed_at) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GREY_LABEL);
        doc.text(
          `Signed: ${new Date(sheet.signed_at).toLocaleString("en-AU", { timeZone: "Australia/Perth" })}`,
          margin,
          y + 34
        );
      }
    }

    const pdfBytes = doc.output("arraybuffer");
    const timeStamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "");
    // Sanitize filename to prevent header injection (quotes, newlines, control chars)
    const safeName = (sheet.driver_name || "unknown")
      .replace(/[\s"\r\n\\]+/g, "-")
      .replace(/[^\w\-.]/g, "") || "sheet";
    const filename = `fatigue-sheet-${safeName}-${timeStamp}.pdf`;
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Prevent stale PDFs being reused by browser/proxies/CDNs.
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
