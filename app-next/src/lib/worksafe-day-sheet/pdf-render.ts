/**
 * WorkSafe day-sheet rendering for weekly / roadside PDF (HTML + jsPDF).
 * Presentation only — uses buildWorkSafeDayPaint (same model as driver UI).
 */

import type { jsPDF } from "jspdf";
import { buildWorkSafeDayPaint } from "./build-day-paint";
import {
  WORKSAFE_TRACK_LABELS,
  type WorkSafeDayPaint,
  type WorkSafeTrack,
} from "./types";
import { formatHoursStatistic } from "@/lib/hours";

const TRACKS: WorkSafeTrack[] = ["work", "break", "non_work"];
const MINUTES_PER_DAY = 1440;
const SVG_W = 720;
const LANE_H = 28;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTotal(minutes: number): string {
  if (minutes <= 0) return "—";
  return formatHoursStatistic(minutes / 60);
}

function trackY(track: WorkSafeTrack, laneH: number): number {
  return TRACKS.indexOf(track) * laneH + laneH / 2;
}

function buildStepPath(
  segments: WorkSafeDayPaint["segments"],
  chartW: number,
  laneH: number
): string {
  if (segments.length === 0) return "";
  const xOf = (m: number) => (m / MINUTES_PER_DAY) * chartW;
  let d = "";
  let prev: (typeof segments)[0] | null = null;
  for (const seg of segments) {
    const y = trackY(seg.track, laneH);
    const x0 = xOf(seg.startMin);
    const x1 = xOf(seg.endMin);
    if (!prev || prev.endMin !== seg.startMin) {
      d += `M${x0.toFixed(2)} ${y.toFixed(2)} `;
    } else if (prev.track !== seg.track) {
      d += `V${y.toFixed(2)} `;
    }
    d += `H${x1.toFixed(2)} `;
    prev = seg;
  }
  return d.trim();
}

export type PdfDayInput = {
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  events?: { time: string; type: string }[];
  truck_rego?: string | null;
  start_location?: string | null;
  destination?: string | null;
  start_kms?: number | null;
  end_kms?: number | null;
};

/** Build paint for one PDF day; pass paintedUntilMinute from Perth-aware helper. */
export function paintForPdfDay(
  day: PdfDayInput,
  dateStr: string,
  todayStr: string,
  paintedUntilMinute: number
): WorkSafeDayPaint {
  return buildWorkSafeDayPaint({
    dateStr,
    todayStr,
    events: day.events,
    work_time: day.work_time,
    breaks: day.breaks,
    non_work: day.non_work,
    paintedUntilMinute,
  });
}

export function workSafeTrackLabelShort(track: WorkSafeTrack): string {
  if (track === "break") return "BREAKS";
  if (track === "non_work") return "NON WORK";
  return "WORK TIME";
}

export function workSafeSegmentTypeLabel(track: WorkSafeTrack): string {
  return WORKSAFE_TRACK_LABELS[track];
}

/**
 * Inner HTML for one WorkSafe paper day tile (bars replaced by step line).
 * Caller wraps in section.dayCard / layout.
 */
export function renderWorkSafeDaySheetHtml(opts: {
  paint: WorkSafeDayPaint;
  dayName: string;
  dateLabel: string;
  driverName?: string;
  day: PdfDayInput;
}): string {
  const { paint, dayName, dateLabel, driverName, day } = opts;
  const dayShort = dayName.slice(0, 3).toUpperCase();
  const dateShort = dateLabel.includes("/")
    ? dateLabel.split("/").slice(0, 2).join("/")
    : dateLabel;
  const chartH = TRACKS.length * LANE_H;
  const stepPath = buildStepPath(paint.segments, SVG_W, LANE_H);
  const hourMarks = Array.from({ length: 25 }, (_, h) => h);
  const quarterMarks = Array.from({ length: 96 }, (_, i) => i * 15);

  const rego = (day.truck_rego ?? "").trim();
  const startKm = day.start_kms != null && !Number.isNaN(Number(day.start_kms)) ? String(day.start_kms) : "";
  const endKm = day.end_kms != null && !Number.isNaN(Number(day.end_kms)) ? String(day.end_kms) : "";
  const from = (day.start_location ?? "").trim();
  const to = (day.destination ?? "").trim();

  const metaBits: string[] = [];
  if (driverName?.trim()) metaBits.push(`Driver ${escapeHtml(driverName.trim())}`);
  if (rego) metaBits.push(`Rego <span class="mono">${escapeHtml(rego)}</span>`);
  if (startKm) metaBits.push(`Start km <span class="mono">${escapeHtml(startKm)}</span>`);
  if (endKm) metaBits.push(`End km <span class="mono">${escapeHtml(endKm)}</span>`);

  const gridLines = quarterMarks
    .map((m) => {
      const isHour = m % 60 === 0;
      const x = (m / MINUTES_PER_DAY) * SVG_W;
      return `<line x1="${x}" y1="0" x2="${x}" y2="${chartH}" stroke="${isHour ? "rgba(68,64,60,0.45)" : "rgba(68,64,60,0.18)"}" stroke-width="${isHour ? 1 : 0.5}"/>`;
    })
    .join("");

  const laneRects = TRACKS.map(
    (_, i) =>
      `<rect x="0" y="${i * LANE_H}" width="${SVG_W}" height="${LANE_H}" fill="${i % 2 === 0 ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.03)"}"/>`
  ).join("");

  const laneDividers = TRACKS.slice(1)
    .map(
      (_, i) =>
        `<line x1="0" y1="${(i + 1) * LANE_H}" x2="${SVG_W}" y2="${(i + 1) * LANE_H}" stroke="rgba(68,64,60,0.55)" stroke-width="1"/>`
    )
    .join("");

  const rowLabels = TRACKS.map(
    (track) =>
      `<div class="wsRowLabel" title="${escapeHtml(WORKSAFE_TRACK_LABELS[track])}">${escapeHtml(WORKSAFE_TRACK_LABELS[track])}</div>`
  ).join("");

  const totals = TRACKS.map(
    (track) => `<div class="wsTotal">${escapeHtml(formatTotal(paint.totalsMinutes[track]))}</div>`
  ).join("");

  const hourLabels = hourMarks
    .map((h) => {
      const label = h === 24 ? "24.00" : `${h}.00`;
      return `<span class="wsHour" style="left:${(h / 24) * 100}%">${label}</span>`;
    })
    .join("");

  const locFrom =
    from && paint.segments.some((s) => s.track === "work")
      ? `<span class="wsLoc wsLocFrom">${escapeHtml(from)}</span>`
      : "";
  const locTo = to ? `<span class="wsLoc wsLocTo">${escapeHtml(to)}</span>` : "";

  return `
    <div class="wsSheet">
      <div class="wsMeta">${metaBits.join(" · ") || "WorkSafe WA fatigue day record"}</div>
      <div class="wsBody">
        <div class="wsDayCol">
          <div class="wsDayCap">Day</div>
          <div class="wsDayVal">${escapeHtml(dayShort)}</div>
          <div class="wsDayCap">Date</div>
          <div class="wsDateVal">${escapeHtml(dateShort)}</div>
        </div>
        <div class="wsMain">
          <div class="wsHours">
            <div class="wsLabelSpacer"></div>
            <div class="wsHourBar">${hourLabels}</div>
            <div class="wsTotalCap">Total</div>
          </div>
          <div class="wsRows">
            <div class="wsLabels">${rowLabels}</div>
            <div class="wsChart">
              <svg width="100%" height="${chartH}" viewBox="0 0 ${SVG_W} ${chartH}" preserveAspectRatio="none" aria-hidden="true">
                ${laneRects}${gridLines}${laneDividers}
                ${
                  stepPath
                    ? `<path d="${stepPath}" fill="none" stroke="#1c1917" stroke-width="2.25" stroke-linejoin="miter" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`
                    : ""
                }
              </svg>
              ${locFrom}${locTo}
            </div>
            <div class="wsTotals">${totals}</div>
          </div>
        </div>
      </div>
    </div>`;
}

/** CSS for WorkSafe day tiles (inject into PDF HTML head). */
export const WORKSAFE_PDF_DAY_CSS = `
  .wsSheet { background:#f7f3e8; border:1px solid #a8a29e; border-radius:3px; color:#1c1917; break-inside:avoid; }
  .wsMeta { font-size:9px; padding:4px 8px; border-bottom:1px solid #a8a29e; color:#44403c; }
  .wsBody { display:flex; }
  .wsDayCol { width:48px; flex-shrink:0; border-right:1px solid #a8a29e; background:rgba(0,0,0,0.04); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:6px 2px; text-align:center; }
  .wsDayCap { font-size:7px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#78716c; }
  .wsDayVal { font-size:12px; font-weight:800; line-height:1.1; }
  .wsDateVal { font-size:10px; font-family:ui-monospace,monospace; font-weight:700; }
  .wsMain { flex:1; min-width:0; }
  .wsHours { display:flex; height:16px; border-bottom:1px solid #d6d3d1; }
  .wsLabelSpacer { width:92px; flex-shrink:0; }
  .wsHourBar { position:relative; flex:1; }
  .wsHour { position:absolute; top:2px; transform:translateX(-50%); font-size:7px; font-family:ui-monospace,monospace; color:#57534e; }
  .wsTotalCap { width:42px; flex-shrink:0; font-size:7px; font-weight:800; text-transform:uppercase; color:#78716c; display:flex; align-items:center; justify-content:center; }
  .wsRows { display:flex; }
  .wsLabels { width:92px; flex-shrink:0; border-right:1px solid #d6d3d1; }
  .wsRowLabel { height:${LANE_H}px; display:flex; align-items:center; justify-content:flex-end; padding:0 6px; font-size:7.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.02em; text-align:right; line-height:1.15; border-bottom:1px solid #e7e5e4; color:#292524; }
  .wsRowLabel:last-child { border-bottom:0; }
  .wsChart { position:relative; flex:1; min-width:0; }
  .wsTotals { width:42px; flex-shrink:0; border-left:1px solid #a8a29e; }
  .wsTotal { height:${LANE_H}px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; font-family:ui-monospace,monospace; border-bottom:1px solid #e7e5e4; }
  .wsTotal:last-child { border-bottom:0; }
  .wsLoc { position:absolute; top:${LANE_H + 3}px; font-size:7px; color:#57534e; max-width:28%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .wsLocFrom { left:2%; }
  .wsLocTo { right:2%; text-align:right; }
`;

/**
 * Draw WorkSafe step-line day chart in jsPDF. Returns y after the chart (mm).
 */
export function drawWorkSafeDaySheetJsPdf(
  doc: jsPDF,
  opts: {
    paint: WorkSafeDayPaint;
    x: number;
    y: number;
    width: number;
    dayName: string;
    dateLabel: string;
    metaLine?: string;
  }
): number {
  const { paint, x, width, dayName, dateLabel, metaLine } = opts;
  let y = opts.y;
  const labelW = 28;
  const totalW = 14;
  const chartW = width - labelW - totalW;
  const laneH = 5.2;
  const chartH = TRACKS.length * laneH;
  const ink: [number, number, number] = [28, 25, 23];
  const paper: [number, number, number] = [247, 243, 232];
  const rule: [number, number, number] = [168, 162, 158];

  const tileH = 7 + (metaLine ? 4 : 0) + 4 + chartH + 2;
  doc.setFillColor(...paper);
  doc.setDrawColor(...rule);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, tileH, "FD");

  // Day / date strip
  doc.setFillColor(231, 229, 228);
  doc.rect(x, y, 12, tileH, "F");
  doc.setDrawColor(...rule);
  doc.line(x + 12, y, x + 12, y + tileH);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.text("DAY", x + 6, y + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text(dayName.slice(0, 3).toUpperCase(), x + 6, y + 10, { align: "center" });
  doc.setFontSize(5.5);
  doc.text("DATE", x + 6, y + 15, { align: "center" });
  doc.setFontSize(7);
  const dateShort = dateLabel.includes("/") ? dateLabel.split("/").slice(0, 2).join("/") : dateLabel;
  doc.text(dateShort, x + 6, y + 20, { align: "center" });

  const innerX = x + 12;
  const innerW = width - 12;
  let cy = y + 3;

  if (metaLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(68, 64, 60);
    const clipped = doc.splitTextToSize(metaLine, innerW - 4);
    doc.text(String(clipped[0] ?? ""), innerX + 2, cy + 2);
    cy += 4;
  }

  const chartLeft = innerX + labelW;
  // Hour labels
  doc.setFontSize(5.5);
  doc.setTextColor(87, 83, 78);
  for (let h = 0; h <= 24; h += 2) {
    const hx = chartLeft + (h / 24) * chartW;
    doc.text(h === 24 ? "24" : String(h), hx, cy + 2.5, { align: "center" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5);
  doc.text("TOTAL", innerX + labelW + chartW + totalW / 2, cy + 2.5, { align: "center" });
  cy += 4;

  const chartTop = cy;

  // Lanes + grid
  for (let i = 0; i < TRACKS.length; i++) {
    const ly = chartTop + i * laneH;
    doc.setFillColor(i % 2 === 0 ? 255 : 242, i % 2 === 0 ? 255 : 240, i % 2 === 0 ? 252 : 236);
    doc.rect(chartLeft, ly, chartW, laneH, "F");
  }
  for (let h = 0; h <= 24; h++) {
    const hx = chartLeft + (h / 24) * chartW;
    const strong = h % 2 === 0;
    doc.setDrawColor(strong ? 120 : 190, strong ? 113 : 184, strong ? 109 : 176);
    doc.setLineWidth(strong ? 0.2 : 0.1);
    doc.line(hx, chartTop, hx, chartTop + chartH);
  }
  doc.setDrawColor(...rule);
  doc.setLineWidth(0.25);
  for (let i = 1; i < TRACKS.length; i++) {
    const ly = chartTop + i * laneH;
    doc.line(chartLeft, ly, chartLeft + chartW, ly);
  }
  doc.rect(chartLeft, chartTop, chartW, chartH, "S");

  // Row labels + totals
  TRACKS.forEach((track, i) => {
    const ly = chartTop + i * laneH + laneH * 0.72;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...ink);
    doc.text(workSafeTrackLabelShort(track), innerX + labelW - 1, ly, { align: "right" });
    doc.setFontSize(7.5);
    doc.text(formatTotal(paint.totalsMinutes[track]), chartLeft + chartW + totalW / 2, ly, {
      align: "center",
    });
  });

  // Step line
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.55);
  const xOf = (m: number) => chartLeft + (m / MINUTES_PER_DAY) * chartW;
  let prev: WorkSafeDayPaint["segments"][0] | null = null;
  for (const seg of paint.segments) {
    const ty = chartTop + trackY(seg.track, laneH);
    const x0 = xOf(seg.startMin);
    const x1 = xOf(seg.endMin);
    if (prev && prev.endMin === seg.startMin && prev.track !== seg.track) {
      const py = chartTop + trackY(prev.track, laneH);
      doc.line(x0, py, x0, ty);
    }
    doc.line(x0, ty, x1, ty);
    prev = seg;
  }

  return y + tileH + 1;
}
