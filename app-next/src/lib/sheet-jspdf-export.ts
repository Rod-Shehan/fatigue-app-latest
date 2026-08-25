import type { jsPDF } from "jspdf";
import { PRODUCT_NAME_EXPORT, TAGLINE_DRIVER } from "@/lib/branding";
import { ROADSIDE_PDF_DISCLAIMER } from "@/lib/roadside-pdf";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import { halfHourSlotsToRanges, minuteBooleansToRanges } from "@/lib/coverage/grid-to-ranges";
import { getPerthNowParts, perthDayEndUtcMs, perthDayStartUtcMs } from "@/lib/perth-now";
import { sheetHasLegacyDriverEventTags } from "@/lib/sheet-ownership";
import {
  paintForPdfDay,
  renderWorkSafeDaySheetHtml,
  drawWorkSafeDaySheetJsPdf,
  workSafeSegmentTypeLabel,
  WORKSAFE_PDF_DAY_CSS,
} from "@/lib/worksafe-day-sheet/pdf-render";
import {
  collectWeekTruckRegs,
  drawWeeklyTripSheetFooterJsPdf,
  drawWeeklyTripSheetHeaderJsPdf,
  renderWeeklyTripSheetFooterHtml,
  renderWeeklyTripSheetHeaderHtml,
  WEEKLY_TRIP_SHEET_PDF_CSS,
} from "@/lib/worksafe-day-sheet/weekly-trip-sheet";
import { checklistMatrixFromDays } from "@/lib/worksafe-day-sheet/trip-checklist";
import { sanitizePdfPlainText } from "@/lib/pdf-plain-text";
import type { WorkSafeTrack } from "@/lib/worksafe-day-sheet/types";
import { deriveDaysWithRollover } from "@/lib/event-rollover";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TOTAL_MIN = 24 * 60;

function padPdfDays<T>(days: Array<T | null | undefined> | undefined): T[] {
  const list = (Array.isArray(days) ? days : [])
    .slice(0, 7)
    .map((d) => (d && typeof d === "object" ? d : ({} as T)));
  while (list.length < 7) list.push({} as T);
  return list;
}

type SegmentType = WorkSafeTrack;
type TimelineSegment = { startMin: number; endMin: number; type: SegmentType };

function formatDeclared24hRestsForPdf(sheet: {
  last_24h_rest_1?: string | null;
  last_24h_rest_2?: string | null;
  last_24h_rest_3?: string | null;
  last_24h_rest_4?: string | null;
}): string {
  const parts = [
    sheet.last_24h_rest_1,
    sheet.last_24h_rest_2,
    sheet.last_24h_rest_3,
    sheet.last_24h_rest_4,
  ]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

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

function getEffectiveDayEndMinutes(dateStr: string, todayStr: string): number {
  if (dateStr > todayStr) return 0;
  if (dateStr < todayStr) return TOTAL_MIN;
  // For "today", cap at the current local time in Australia/Perth so the PDF
  // matches what drivers see in-app.
  const { hour, minute } = getPerthNowParts();
  return Math.min(TOTAL_MIN, hour * 60 + minute);
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
    const startMin = Math.floor((clampedStart - dayStart) / 60000);
    const endMin = Math.min(effectiveEndMin, Math.ceil((clampedEnd - dayStart) / 60000));
    if (startMin >= endMin) continue;
    const durationMinutes = endMin - startMin;
    const treatBreakAsWork = ev.type === "break" && durationMinutes < MIN_BREAK_BLOCK_MINUTES;
    if (ev.type === "work" || treatBreakAsWork) {
      segments.work_time.push({ startMin, endMin });
      workOrBreakRanges.push({ startMin, endMin });
    } else if (ev.type === "break" || ev.type === "other_work") {
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
  return workSafeSegmentTypeLabel(type);
}

function escapeHtml(s: string) {
  return sanitizePdfPlainText(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

export type RoadsidePdfPayload = {
  driverName: string;
  weekStarting: string;
  jurisdictionLabel: string;
  violations: { day: string; message: string }[];
  warnings: { day: string; message: string }[];
  evidence?: {
    gpsCoveragePct: number;
    gpsKm: number | null;
    odometerKm: number | null;
    movingDuringRestCount: number;
    flags: { severity: "info" | "warning"; message: string }[];
  };
  disclaimer: string;
  qrDataUrl?: string;
};

/** `full` = unused Circadia extras. `tripSheetOnly` = week Export PDF and roadside produce. */
export type SheetPdfLayout = "full" | "tripSheetOnly";

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
  const ev = r.evidence
    ? `<div class="roadEvidence">
        <h3>Plausibility & evidence</h3>
        <div class="roadEvidenceGrid">
          <div><strong>GPS coverage</strong><br/>${r.evidence.gpsCoveragePct}%</div>
          <div><strong>GPS km</strong><br/>${r.evidence.gpsKm == null ? "—" : `${r.evidence.gpsKm} km`}</div>
          <div><strong>Odometer km</strong><br/>${r.evidence.odometerKm == null ? "—" : `${r.evidence.odometerKm} km`}</div>
        </div>
        <p class="roadEvidenceNote"><strong>Possible movement during rest:</strong> ${r.evidence.movingDuringRestCount}</p>
        ${
          r.evidence.flags.length
            ? `<ul class="roadList">${r.evidence.flags
                .slice(0, 6)
                .map((f) => `<li>${escapeHtml(f.message)}</li>`)
                .join("")}</ul>`
            : `<p class="roadEmpty">No evidence flags</p>`
        }
      </div>`
    : "";
  return `
  <section class="roadside">
    <h2>Roadside compliance summary</h2>
    <p class="roadMeta"><strong>Driver:</strong> ${escapeHtml(r.driverName)} &nbsp;|&nbsp; <strong>Week starting:</strong> ${escapeHtml(r.weekStarting)} &nbsp;|&nbsp; <strong>Rules:</strong> ${escapeHtml(r.jurisdictionLabel)}</p>
    <p class="roadCounts"><strong>Violations:</strong> ${r.violations.length} &nbsp;&nbsp; <strong>Warnings:</strong> ${r.warnings.length}</p>
    ${ev}
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
    week_starting: string;
    jurisdiction_label: string;
    last_24h_break: string | null;
    last_24h_rest_1?: string | null;
    last_24h_rest_2?: string | null;
    last_24h_rest_3?: string | null;
    last_24h_rest_4?: string | null;
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
  const dayList = padPdfDays(sheet.days);
  const showLegacyDriverCol = sheetHasLegacyDriverEventTags(sheet);

  const metaRows: { label: string; value: string }[] = [
    { label: "Driver", value: primaryName },
    ...(secondName ? [{ label: "Relief driver", value: secondName }] as const : []),
    { label: "Driver type", value: sheet.driver_type === "two_up" ? "Two-up" : "Solo" },
    { label: "Week starting", value: sheet.week_starting || "—" },
    { label: "Rules (jurisdiction)", value: sheet.jurisdiction_label || "—" },
    {
      label: "Last 24h continuous rest (date)",
      value: (sheet.last_24h_break || "").trim() || "—",
    },
    {
      label: "Declared 24h non-work rests",
      value: formatDeclared24hRestsForPdf(sheet),
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
      const startLoc = (day as { start_location?: string }).start_location ?? "";
      const dest = (day as { destination?: string }).destination ?? "";
      const startKms = (day as { start_kms?: number | null }).start_kms;
      const endKms = (day as { end_kms?: number | null }).end_kms;
      const cardBits: string[] = [];
      if (rego) cardBits.push(`Rego: ${rego}`);
      if (startLoc) cardBits.push(`Start: ${startLoc}`);
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

      let bodyHtml: string;
      if (hasEvents) {
        const rows = events!
          .filter((ev) => ev && ev.time)
          .map((ev) => {
            const typeLabel = logEventTypeLabel(ev.type || "");
            let driverCol = "—";
            if (showLegacyDriverCol && ev.driver === "second") {
              driverCol = secondName || "Second driver";
            } else if (showLegacyDriverCol && ev.driver === "primary") {
              driverCol = primaryName;
            } else if (showLegacyDriverCol) {
              driverCol = "—";
            }
            let loc = "—";
            if (ev.lat != null && ev.lng != null && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
              loc = `${ev.lat.toFixed(5)}, ${ev.lng.toFixed(5)}`;
              if (ev.accuracy != null && Number.isFinite(ev.accuracy)) {
                loc += ` (±${Math.round(ev.accuracy)} m)`;
              }
            }
            const cells = showLegacyDriverCol
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
        const thead = showLegacyDriverCol
          ? "<tr><th>Time (Australia/Perth)</th><th>Type</th><th>Driver (legacy)</th><th>Location</th></tr>"
          : "<tr><th>Time (Australia/Perth)</th><th>Type</th><th>Location</th></tr>";
        const emptyColspan = showLegacyDriverCol ? 4 : 3;
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
          <p class="shiftSource">Time blocks from the WorkSafe day sheet (work / breaks / non-work) for this day — use when no event log is stored.</p>
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
    <p class="shiftIntro">Plain record of driver-entered data for this weekly sheet: identification, day cards, then either logged events (tap log) or time blocks from the WorkSafe day sheet. Times are shown in Australia/Perth unless otherwise noted.</p>
    <table class="shiftMeta">
      <tbody>${metaHtml}</tbody>
    </table>
    ${dayBlocks}
  </section>`;
}

export function renderPdfHtml(opts: {
  sheet: {
    driver_name: string;
    second_driver: string | null;
    driver_type: string;
    week_starting: string;
    jurisdiction_label: string;
    last_24h_break: string | null;
    last_24h_rest_1?: string | null;
    last_24h_rest_2?: string | null;
    last_24h_rest_3?: string | null;
    last_24h_rest_4?: string | null;
    status: string;
    signed_at: string | null;
    signature?: string | null;
    operator_legal_name?: string | null;
    driver_licence_number?: string | null;
    driver_medical_expiry?: string | null;
    driver_licence_expiry?: string | null;
    days: Array<{
      work_time?: boolean[];
      breaks?: boolean[];
      non_work?: boolean[];
      date?: string;
      truck_rego?: string;
      start_location?: string;
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
  layout?: SheetPdfLayout;
}) {
  const { sheet, todayStr, generatedAtLabel, roadside } = opts;
  const tripSheetOnly = opts.layout === "tripSheetOnly";
  const dayList = padPdfDays(sheet.days);
  const paintDays = deriveDaysWithRollover(dayList, sheet.week_starting, { todayStr });
  const driverName = (sheet.driver_name || "").trim();
  const truckRegs = collectWeekTruckRegs(paintDays);
  let weekWorkMinutes = 0;

  const dayCards = paintDays.map((day, idx) => {
    const dayName = DAY_NAMES[idx] ?? `Day ${idx + 1}`;
    const dateLabel = getDateStr(sheet.week_starting, idx);
    const isoDate = (day as { date?: string }).date || getIsoDate(sheet.week_starting, idx);
    const paintedUntil = getEffectiveDayEndMinutes(isoDate, todayStr);
    const paint = paintForPdfDay(day, isoDate, todayStr, paintedUntil);
    weekWorkMinutes += paint.totalsMinutes.work;

    const sheetHtml = renderWorkSafeDaySheetHtml({
      paint,
      dayName,
      dateLabel,
      driverName,
      day: {
        truck_rego: (day as { truck_rego?: string }).truck_rego,
        start_location: (day as { start_location?: string }).start_location,
        destination: (day as { destination?: string }).destination,
        start_kms: (day as { start_kms?: number }).start_kms,
        end_kms: (day as { end_kms?: number }).end_kms,
      },
    });

    return `
        <section class="dayCard">
          ${sheetHtml}
        </section>
      `;
  });

  const tripChrome = {
    weekStarting: sheet.week_starting,
    driverName,
    truckRegs,
    weekWorkMinutes,
    signature: sheet.signature ?? null,
    signedAt: sheet.signed_at,
    operatorLegalName: sheet.operator_legal_name ?? null,
    licenceNumber: sheet.driver_licence_number ?? null,
    medicalExpiryYmd: sheet.driver_medical_expiry ?? null,
    licenceExpiryYmd: sheet.driver_licence_expiry ?? null,
    checklistTicks: checklistMatrixFromDays(dayList),
  };

  const footerHtml = renderWeeklyTripSheetFooterHtml(tripChrome);
  // Keep signature/footer on the same page as the last day tile (legal + space).
  const leadingDays = dayCards.slice(0, -1).join("");
  const lastDay = dayCards[dayCards.length - 1] ?? "";
  const tripDaysAndFooter = `
        ${leadingDays}
        <div class="wtsLastWithFooter">
          ${lastDay}
          ${footerHtml}
        </div>`;

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
        .dayCard { margin: ${tripSheetOnly ? "1px" : "3px"} 0; padding: 0; border: none; background: transparent; break-inside: avoid; page-break-inside: avoid; }
        .wtsWeekBody { margin: ${tripSheetOnly ? "0" : "10px 0 0"}; break-before: ${tripSheetOnly ? "auto" : "page"}; page-break-before: ${tripSheetOnly ? "auto" : "always"}; }
        .wtsWeekBody .wtsHeaderBlock { break-after: avoid; page-break-after: avoid; }
        .wtsLastWithFooter { break-inside: avoid; page-break-inside: avoid; }
        .wtsWeekBody .wtsFooterBlock { break-before: avoid; page-break-before: avoid; margin-top: 8px; }
        ${WORKSAFE_PDF_DAY_CSS}
        ${WEEKLY_TRIP_SHEET_PDF_CSS}
        ${tripSheetOnly ? ".wtsChrome { margin: 4px 0; } .wtsOffice, .wtsSig { min-height: 40px; }" : ""}
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .roadside { margin: 12px 0 16px; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; break-inside: avoid; }
        .roadside h2 { font-size: 15px; font-weight: 800; margin: 0 0 8px; color: #0f172a; }
        .roadside h3 { font-size: 11px; font-weight: 800; margin: 0 0 4px; color: #334155; }
        .roadMeta { font-size: 10px; color: #334155; margin: 0 0 6px; line-height: 1.35; }
        .roadCounts { font-size: 11px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
        .roadEvidence { margin: 8px 0 10px; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; }
        .roadEvidenceGrid { display: flex; gap: 10px; font-size: 9.5px; color: #334155; }
        .roadEvidenceGrid > div { flex: 1; min-width: 0; }
        .roadEvidenceNote { margin: 6px 0 0; font-size: 9.5px; color: #334155; }
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
      ${
        tripSheetOnly
          ? ""
          : `<div class="header">
        <div class="headerRow">
          <div>
            <div class="title">${PRODUCT_NAME_EXPORT}</div>
            <div class="subtitle">${TAGLINE_DRIVER}${
              sheet.operator_legal_name?.trim()
                ? ` · ${escapeHtml(sheet.operator_legal_name.trim())}`
                : ""
            }</div>
          </div>
          <div class="generated">Generated: ${escapeHtml(generatedAtLabel)}</div>
        </div>
      </div>
      ${roadside ? buildRoadsideSectionHtml(roadside) : ""}`
      }
      <div class="wtsWeekBody">
        ${renderWeeklyTripSheetHeaderHtml(tripChrome)}
        ${tripDaysAndFooter}
      </div>
      ${tripSheetOnly ? "" : buildShiftLogHtml({ sheet, todayStr })}
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
  const meta = `Driver: ${sanitizePdfPlainText(roadside.driverName)}  |  Week: ${sanitizePdfPlainText(roadside.weekStarting)}  |  Rules: ${sanitizePdfPlainText(roadside.jurisdictionLabel)}`;
  const metaLines = doc.splitTextToSize(meta, colW);
  doc.text(metaLines, margin, y);
  y += metaLines.length * 3.6 + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Violations: ${roadside.violations.length}    Warnings: ${roadside.warnings.length}`, margin, y);
  y += 5;

  if (roadside.evidence) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text("Plausibility & evidence", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(70, 70, 70);
    const e = roadside.evidence;
    doc.text(`GPS coverage: ${e.gpsCoveragePct}%`, margin, y);
    y += 3.8;
    doc.text(
      `GPS km: ${e.gpsKm == null ? "—" : `${e.gpsKm} km`}    Odometer km: ${e.odometerKm == null ? "—" : `${e.odometerKm} km`}`,
      margin,
      y
    );
    y += 3.8;
    doc.text(`Possible movement during rest: ${e.movingDuringRestCount}`, margin, y);
    y += 5;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text("Violations", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const vText = roadside.violations
    .slice(0, 12)
    .map((v) => `- ${sanitizePdfPlainText(v.day)}: ${sanitizePdfPlainText(v.message)}`)
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
    .map((w) => `- ${sanitizePdfPlainText(w.day)}: ${sanitizePdfPlainText(w.message)}`)
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
    week_starting: string;
    jurisdiction_label: string;
    last_24h_break: string | null;
    last_24h_rest_1?: string | null;
    last_24h_rest_2?: string | null;
    last_24h_rest_3?: string | null;
    last_24h_rest_4?: string | null;
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
    "Plain record of driver-entered data for this weekly sheet: identification, day cards, then logged events or time blocks from the WorkSafe day sheet. Times in Australia/Perth unless noted.",
    colW
  );
  doc.text(intro, margin, y);
  y += intro.length * 3.5 + 6;

  const metaBits: string[] = [
    `Primary driver: ${sheet.driver_name || "—"}`,
    ...(sheet.second_driver?.trim() ? [`Relief driver: ${sheet.second_driver.trim()}`] : []),
    `Driver type: ${sheet.driver_type === "two_up" ? "Two-up" : "Solo"}`,
    `Week starting: ${sheet.week_starting || "—"}`,
    `Rules: ${sheet.jurisdiction_label || "—"}`,
    `Last 24h rest (date): ${(sheet.last_24h_break || "").trim() || "—"}`,
    `Declared 24h non-work rests: ${formatDeclared24hRestsForPdf(sheet)}`,
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
  const showLegacyDriverCol = sheetHasLegacyDriverEventTags(sheet);
  const dayList = padPdfDays(sheet.days);

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
        if (showLegacyDriverCol) {
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
        const line = showLegacyDriverCol
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
        "Time blocks from the WorkSafe day sheet for this day (no event log stored).",
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

export type SheetJsPdfInput = {
  sheet: {
    driver_name: string;
    second_driver: string | null;
    driver_type: string;
    week_starting: string;
    days: Array<Record<string, unknown>>;
    status: string;
    signature: string | null;
    signed_at: string | null;
    jurisdiction_label: string;
    last_24h_break: string | null;
    last_24h_rest_1?: string | null;
    last_24h_rest_2?: string | null;
    last_24h_rest_3?: string | null;
    last_24h_rest_4?: string | null;
    operator_legal_name?: string | null;
    driver_licence_number?: string | null;
    driver_medical_expiry?: string | null;
    driver_licence_expiry?: string | null;
  };
  roadsidePayload?: RoadsidePdfPayload;
  todayStr: string;
  generatedAtLabel: string;
  layout?: SheetPdfLayout;
};

/** jsPDF export (used when Chromium is unavailable, e.g. Vercel serverless). */
export async function buildSingleSheetJsPdfBuffer(input: SheetJsPdfInput): Promise<ArrayBuffer> {
  const { sheet, roadsidePayload, todayStr, generatedAtLabel } = input;
  const tripSheetOnly = input.layout === "tripSheetOnly";
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 14;
  const colW = pageW - margin * 2;
  let y = tripSheetOnly ? 12 : 30;

  if (!tripSheetOnly) {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(PRODUCT_NAME_EXPORT, margin, 11);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(TAGLINE_DRIVER, margin, 18);
    doc.text(`Generated: ${generatedAtLabel}`, pageW - margin, 18, { align: "right" });
  }

  if (!tripSheetOnly && roadsidePayload) {
    y = renderRoadsideJsPDF(doc, margin, colW, y, roadsidePayload);
  }

  const dayList = padPdfDays(sheet.days);
  const paintDays = deriveDaysWithRollover(dayList, sheet.week_starting, { todayStr });
  const truckRegs = collectWeekTruckRegs(paintDays);
  let weekWorkMinutes = 0;

  // Start Weekly Trip Sheet body on a fresh page when compliance already filled the first page.
  if (!tripSheetOnly && y > 55) {
    doc.addPage();
    y = 16;
  }

  y = drawWeeklyTripSheetHeaderJsPdf(doc, {
    x: margin,
    y,
    width: colW,
    weekStarting: sheet.week_starting,
    driverName: sheet.driver_name,
    truckRegs,
    operatorLegalName: sheet.operator_legal_name ?? null,
    licenceNumber: sheet.driver_licence_number ?? null,
    medicalExpiryYmd: sheet.driver_medical_expiry ?? null,
    licenceExpiryYmd: sheet.driver_licence_expiry ?? null,
    checklistTicks: checklistMatrixFromDays(dayList),
  });

  const FOOTER_BUDGET_MM = 40;
  const TILE_BUDGET_MM = 24; // ~20mm tile + half gap after 20% taller lanes

  paintDays.forEach((day, idx) => {
    const isLastDay = idx === dayList.length - 1;
    // Reserve footer space when placing the last day so signature stays on the same page.
    const needMm = TILE_BUDGET_MM + (isLastDay ? FOOTER_BUDGET_MM : 0);
    if (y + needMm > 285) {
      if (!tripSheetOnly) {
        doc.addPage();
        y = 16;
      }
    }
    const dayName = DAY_NAMES[idx] ?? `Day ${idx + 1}`;
    const dateStr = getDateStr(sheet.week_starting, idx);
    const isoDate = (day as { date?: string }).date || getIsoDate(sheet.week_starting, idx);
    const paintedUntil = getEffectiveDayEndMinutes(isoDate, todayStr);
    const paint = paintForPdfDay(
      day as {
        work_time?: boolean[];
        breaks?: boolean[];
        non_work?: boolean[];
        events?: { time: string; type: string }[];
      },
      isoDate,
      todayStr,
      paintedUntil
    );
    weekWorkMinutes += paint.totalsMinutes.work;

    const dayWithKms = day as {
      truck_rego?: string;
      start_location?: string;
      destination?: string;
      start_kms?: number;
      end_kms?: number;
    };

    y = drawWorkSafeDaySheetJsPdf(doc, {
      paint,
      x: margin,
      y,
      width: colW,
      dayName,
      dateLabel: dateStr,
      day: {
        truck_rego: dayWithKms.truck_rego ?? "",
        start_location: dayWithKms.start_location ?? "",
        destination: dayWithKms.destination ?? "",
        start_kms: dayWithKms.start_kms ?? null,
        end_kms: dayWithKms.end_kms ?? null,
      },
    });
    y += 1;
  });

  y = drawWeeklyTripSheetFooterJsPdf(doc, {
    x: margin,
    y,
    width: colW,
    weekWorkMinutes,
    signature: sheet.signature,
    signedAt: sheet.signed_at,
  });

  if (!tripSheetOnly) {
    y = renderShiftLogJsPDF(doc, margin, colW, sheet, todayStr);
  }

  return doc.output("arraybuffer");
}