/**
 * WorkSafe day-sheet rendering for weekly / roadside PDF (HTML + jsPDF).
 * Paper tick-grid layout — same presentation as WorkSafeDaySheet UI.
 */

import type { jsPDF } from "jspdf";
import { buildWorkSafeDayPaint } from "./build-day-paint";
import {
  WORKSAFE_TRACK_LABELS,
  type WorkSafeDayPaint,
  type WorkSafeTrack,
} from "./types";
import {
  quarterTracksFromPaint,
  WORKSAFE_HOUR_LABELS,
  WORKSAFE_QUARTERS_PER_DAY,
  WORKSAFE_TRACKS,
} from "./quarter-grid";
import { formatHoursStatistic } from "@/lib/hours";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTotal(minutes: number): string {
  if (minutes <= 0) return "";
  return formatHoursStatistic(minutes / 60);
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
 * Inner HTML for one WorkSafe paper day tile (15-min tick grid).
 */
export function renderWorkSafeDaySheetHtml(opts: {
  paint: WorkSafeDayPaint;
  dayName: string;
  dateLabel: string;
  driverName?: string;
  day: PdfDayInput;
}): string {
  const { paint, dayName, day } = opts;
  void opts.dateLabel;
  void opts.driverName;
  const dayUpper = dayName.toUpperCase();
  const quarters = quarterTracksFromPaint(paint);
  const startKm =
    day.start_kms != null && !Number.isNaN(Number(day.start_kms)) ? String(day.start_kms) : "";
  const endKm = day.end_kms != null && !Number.isNaN(Number(day.end_kms)) ? String(day.end_kms) : "";
  const from = (day.start_location ?? "").trim();
  const to = (day.destination ?? "").trim();

  const hourCells = WORKSAFE_HOUR_LABELS.map(
    (label, h) =>
      `<div class="wsHourCell${h % 2 === 0 ? " alt" : ""}">${escapeHtml(label)}</div>`
  ).join("");

  const rows = WORKSAFE_TRACKS.map((track, rowIdx) => {
    const cells = Array.from({ length: WORKSAFE_QUARTERS_PER_DAY }, (_, q) => {
      const filled = quarters[q] === track;
      const hourEdge = q % 4 === 0;
      return `<div class="wsQ${filled ? " fill" : ""}${hourEdge ? " hour" : ""}"></div>`;
    }).join("");
    return `<div class="wsRow${rowIdx < WORKSAFE_TRACKS.length - 1 ? " sep" : ""}">
      <div class="wsRowLabel">${escapeHtml(WORKSAFE_TRACK_LABELS[track])}</div>
      <div class="wsQuarters">${cells}</div>
      <div class="wsTotal">${escapeHtml(formatTotal(paint.totalsMinutes[track]))}</div>
    </div>`;
  }).join("");

  return `
    <div class="wsSheet">
      <div class="wsMetaRow">
        <div class="wsMetaCell"><span class="wsMetaLab">Odometer Start</span><span class="wsMetaVal mono">${escapeHtml(startKm)}</span></div>
        <div class="wsMetaCell"><span class="wsMetaLab">Start Location</span><span class="wsMetaVal">${escapeHtml(from)}</span></div>
        <div class="wsMetaCell"><span class="wsMetaLab">Finish Location</span><span class="wsMetaVal">${escapeHtml(to)}</span></div>
        <div class="wsMetaCell"><span class="wsMetaLab">Odometer Finish</span><span class="wsMetaVal mono">${escapeHtml(endKm)}</span></div>
      </div>
      <div class="wsHourRow">
        <div class="wsDayName">${escapeHtml(dayUpper)}</div>
        <div class="wsHours">${hourCells}</div>
        <div class="wsTotalCap">Total</div>
      </div>
      ${rows}
    </div>`;
}

/** CSS for WorkSafe day tiles (inject into PDF HTML head). */
export const WORKSAFE_PDF_DAY_CSS = `
  .wsSheet { background:#fff; border:1px solid #000; color:#000; break-inside:avoid; }
  .wsMetaRow { display:flex; border-bottom:1px solid #000; font-size:8px; }
  .wsMetaCell { flex:1; display:flex; min-width:0; border-right:1px solid #000; min-height:22px; }
  .wsMetaCell:last-child { border-right:0; }
  .wsMetaLab { background:#e7e5e4; font-weight:700; padding:3px 4px; flex-shrink:0; display:flex; align-items:center; }
  .wsMetaVal { padding:3px 4px; flex:1; display:flex; align-items:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .wsHourRow { display:flex; border-bottom:1px solid #000; }
  .wsDayName { width:78px; flex-shrink:0; border-right:1px solid #000; padding:3px 4px; font-size:9px; font-weight:800; text-decoration:underline; }
  .wsHours { display:flex; flex:1; min-width:0; }
  .wsHourCell { flex:1; text-align:center; font-size:6.5px; font-family:ui-monospace,monospace; padding:2px 0; border-right:1px solid #000; }
  .wsHourCell.alt { background:#e7e5e4; }
  .wsTotalCap { width:36px; flex-shrink:0; background:#e7e5e4; font-size:7px; font-weight:800; display:flex; align-items:center; justify-content:center; }
  .wsRow { display:flex; }
  .wsRow.sep { border-bottom:1px solid #000; }
  .wsRowLabel { width:78px; flex-shrink:0; border-right:1px solid #000; padding:2px 4px; font-size:6.5px; font-weight:700; display:flex; align-items:center; line-height:1.15; }
  .wsQuarters { display:flex; flex:1; min-width:0; height:18px; }
  .wsQ { flex:1; border-right:1px solid #d6d3d1; box-sizing:border-box; }
  .wsQ.hour { border-right-color:#000; }
  .wsQ.fill { background:#1c1917; }
  .wsTotal { width:36px; flex-shrink:0; border-left:1px solid #000; font-size:8px; font-weight:800; font-family:ui-monospace,monospace; display:flex; align-items:center; justify-content:center; }
  .mono { font-family:ui-monospace,monospace; }
`;

/**
 * Draw WorkSafe paper tick-grid day chart in jsPDF. Returns y after the chart (mm).
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
    day?: PdfDayInput;
    metaLine?: string;
  }
): number {
  const { paint, x, width, dayName } = opts;
  const day = opts.day ?? {};
  let y = opts.y;
  const ink: [number, number, number] = [0, 0, 0];
  const grey: [number, number, number] = [231, 229, 228];
  const labelW = 26;
  const totalW = 12;
  const chartW = width - labelW - totalW;
  const laneH = 5.5;
  const metaH = 6;
  const hourH = 4;
  const tileH = metaH + hourH + WORKSAFE_TRACKS.length * laneH;

  doc.setDrawColor(...ink);
  doc.setLineWidth(0.25);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, width, tileH, "FD");

  const startKm =
    day.start_kms != null && !Number.isNaN(Number(day.start_kms)) ? String(day.start_kms) : "";
  const endKm = day.end_kms != null && !Number.isNaN(Number(day.end_kms)) ? String(day.end_kms) : "";
  const from = (day.start_location ?? "").trim();
  const to = (day.destination ?? "").trim();
  const metaParts = [
    { lab: "Odo Start", val: startKm },
    { lab: "Start Loc", val: from },
    { lab: "Finish Loc", val: to },
    { lab: "Odo Finish", val: endKm },
  ];
  const metaCellW = width / 4;
  metaParts.forEach((p, i) => {
    const mx = x + i * metaCellW;
    doc.setFillColor(...grey);
    doc.rect(mx, y, 16, metaH, "F");
    doc.setDrawColor(...ink);
    doc.rect(mx, y, metaCellW, metaH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.setTextColor(...ink);
    doc.text(p.lab, mx + 0.8, y + 3.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    const clipped = doc.splitTextToSize(p.val || "", metaCellW - 18);
    doc.text(String(clipped[0] ?? ""), mx + 16.5, y + 3.8);
  });
  y += metaH;

  // Day name + hour headers + Total
  doc.setDrawColor(...ink);
  doc.rect(x, y, labelW, hourH, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(dayName.toUpperCase(), x + 1, y + 2.9);
  const hourW = chartW / 24;
  WORKSAFE_HOUR_LABELS.forEach((label, h) => {
    const hx = x + labelW + h * hourW;
    if (h % 2 === 0) {
      doc.setFillColor(...grey);
      doc.rect(hx, y, hourW, hourH, "F");
    }
    doc.setDrawColor(...ink);
    doc.rect(hx, y, hourW, hourH, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.5);
    doc.text(label.replace(".00", ""), hx + hourW / 2, y + 2.8, { align: "center" });
  });
  doc.setFillColor(...grey);
  doc.rect(x + labelW + chartW, y, totalW, hourH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5);
  doc.text("Total", x + labelW + chartW + totalW / 2, y + 2.8, { align: "center" });
  y += hourH;

  const quarters = quarterTracksFromPaint(paint);
  const qW = chartW / WORKSAFE_QUARTERS_PER_DAY;

  WORKSAFE_TRACKS.forEach((track, rowIdx) => {
    const ly = y + rowIdx * laneH;
    doc.setDrawColor(...ink);
    doc.rect(x, ly, labelW, laneH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.8);
    doc.setTextColor(...ink);
    const labelLines = doc.splitTextToSize(WORKSAFE_TRACK_LABELS[track], labelW - 1.5);
    doc.text(labelLines, x + 0.6, ly + 2.2);

    for (let q = 0; q < WORKSAFE_QUARTERS_PER_DAY; q++) {
      const qx = x + labelW + q * qW;
      if (quarters[q] === track) {
        doc.setFillColor(28, 25, 23);
        doc.rect(qx, ly, qW, laneH, "F");
      }
      doc.setDrawColor(q % 4 === 0 ? 0 : 180, q % 4 === 0 ? 0 : 180, q % 4 === 0 ? 0 : 180);
      doc.setLineWidth(0.1);
      doc.rect(qx, ly, qW, laneH, "S");
    }
    doc.setDrawColor(...ink);
    doc.setLineWidth(0.25);
    doc.rect(x + labelW, ly, chartW, laneH, "S");
    doc.rect(x + labelW + chartW, ly, totalW, laneH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    const tot = formatTotal(paint.totalsMinutes[track]);
    if (tot) doc.text(tot, x + labelW + chartW + totalW / 2, ly + laneH * 0.7, { align: "center" });
  });

  return opts.y + tileH + 1.5;
}
