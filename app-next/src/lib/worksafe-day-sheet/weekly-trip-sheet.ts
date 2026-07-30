/**
 * Weekly Trip Sheet chrome for week PDF (header, checklist strip, footer).
 * Checklist ticks come from day JSON when set; empty boxes when unset (never fabricated).
 * @see docs/product/weekly-trip-sheet-pdf-project-scope.md
 */

import type { jsPDF } from "jspdf";
import { formatHoursStatistic } from "@/lib/hours";

export const WTS_CHECKLIST_ROWS = [
  "Confirm Fitness for Work",
  "Dimension & Load Check List Completed",
  "Daily Vehicle Check List Completed",
] as const;

export const WTS_DAY_ABBREVS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export function weekEndingDateLabel(weekStarting: string | null | undefined): string {
  if (!weekStarting?.trim()) return "—";
  const [y, m, d] = weekStarting.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const date = new Date(y, m - 1, d + 6);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${yy}`;
}

/** Unique truck regs for the week, first-seen order. */
export function collectWeekTruckRegs(
  days: Array<{ truck_rego?: string | null } | Record<string, unknown>>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    const raw = (day as { truck_rego?: string | null }).truck_rego;
    const reg = typeof raw === "string" ? raw.trim() : "";
    if (!reg) continue;
    const key = reg.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(reg);
  }
  return out;
}

export function formatWeekWorkHoursTotal(workMinutes: number): string {
  if (!Number.isFinite(workMinutes) || workMinutes <= 0) return "0";
  return formatHoursStatistic(workMinutes / 60);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 3 checklist rows × 7 days; true = print tick. */
export type ChecklistTickMatrix = boolean[][];

export type WeeklyTripSheetChromeInput = {
  weekStarting: string;
  driverName: string;
  truckRegs: string[];
  weekWorkMinutes: number;
  signature?: string | null;
  signedAt?: string | null;
  /** Optional 3×7 matrix; missing/false → empty box. */
  checklistTicks?: ChecklistTickMatrix;
};

function tickFor(matrix: ChecklistTickMatrix | undefined, row: number, day: number): boolean {
  return matrix?.[row]?.[day] === true;
}

export function renderWeeklyTripSheetHeaderHtml(input: WeeklyTripSheetChromeInput): string {
  const ending = weekEndingDateLabel(input.weekStarting);
  const driver = (input.driverName || "").trim() || "—";
  const regs =
    input.truckRegs.length > 0
      ? input.truckRegs.map((r) => escapeHtml(r)).join("<br/>")
      : "—";

  const checkRows = WTS_CHECKLIST_ROWS.map((label, rowIdx) => {
    const boxes = WTS_DAY_ABBREVS.map((d, dayIdx) => {
      const on = tickFor(input.checklistTicks, rowIdx, dayIdx);
      return `<div class="wtsTickCol"><span class="wtsTickDay">${d}</span><span class="wtsTickBox${on ? " on" : ""}">${on ? "✓" : ""}</span></div>`;
    }).join("");
    return `<div class="wtsCheckRow">
      <div class="wtsCheckLab">${escapeHtml(label)} <span class="wtsCheckHint">(Driver to Tick Box)</span></div>
      <div class="wtsTickGrid">${boxes}</div>
    </div>`;
  }).join("");

  return `
  <section class="wtsChrome wtsHeaderBlock" aria-label="Weekly trip sheet header">
    <div class="wtsHead">
      <div class="wtsHeadLeft">
        <div><span class="wtsLab">WEEK ENDING:</span> <span class="wtsVal mono">${escapeHtml(ending)}</span></div>
        <div><span class="wtsLab">DRIVER'S NAME (PRINT):</span> <span class="wtsVal">${escapeHtml(driver)}</span></div>
      </div>
      <div class="wtsTitle">WEEKLY TRIP SHEET</div>
      <div class="wtsHeadRight">
        <div class="wtsLab">Truck Reg No:</div>
        <div class="wtsVal mono">${regs}</div>
      </div>
    </div>
    <div class="wtsCheck">${checkRows}</div>
  </section>`;
}

export function renderWeeklyTripSheetFooterHtml(input: WeeklyTripSheetChromeInput): string {
  const hours = formatWeekWorkHoursTotal(input.weekWorkMinutes);
  const sig = (input.signature || "").trim();
  const signed =
    input.signedAt != null && String(input.signedAt).trim()
      ? new Date(input.signedAt).toLocaleString("en-AU", { timeZone: "Australia/Perth" })
      : "";

  return `
  <section class="wtsChrome wtsFooterBlock" aria-label="Weekly trip sheet footer">
    <div class="wtsFoot">
      <div class="wtsOffice">
        <div class="wtsOfficeTitle">OFFICE USE</div>
        <div class="wtsOfficeLine">Checked / Recorded by:</div>
      </div>
      <div class="wtsHours">
        <div class="wtsLab">Total Working Hours Per Week:</div>
        <div class="wtsHoursVal mono">${escapeHtml(hours)}</div>
      </div>
      <div class="wtsSig">
        <div class="wtsLab">DRIVER SIGNATURE</div>
        ${
          sig
            ? `<img class="wtsSigImg" src="${escapeHtml(sig)}" alt="Driver signature" />`
            : `<div class="wtsSigBlank"></div>`
        }
        ${signed ? `<div class="wtsSignedAt">Signed: ${escapeHtml(signed)}</div>` : ""}
      </div>
    </div>
  </section>`;
}

export const WEEKLY_TRIP_SHEET_PDF_CSS = `
  .wtsChrome { border: 1px solid #000; background: #fff; color: #000; margin: 12px 0; break-inside: avoid; }
  .wtsHead { display: flex; gap: 8px; align-items: stretch; border-bottom: 1px solid #000; padding: 8px 10px; }
  .wtsHeadLeft { flex: 1.2; min-width: 0; font-size: 9.5px; line-height: 1.45; }
  .wtsHeadRight { flex: 0.9; min-width: 0; font-size: 9px; line-height: 1.35; border-left: 1px solid #d6d3d1; padding-left: 8px; }
  .wtsTitle { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; letter-spacing: 0.04em; border: 1.5px solid #000; padding: 6px 8px; text-align: center; }
  .wtsLab { font-weight: 700; }
  .wtsVal { font-weight: 600; }
  .wtsCheck { padding: 6px 8px 8px; }
  .wtsCheckRow { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .wtsCheckRow:last-child { margin-bottom: 0; }
  .wtsCheckLab { flex: 1; min-width: 0; font-size: 8.5px; font-weight: 600; }
  .wtsCheckHint { font-weight: 500; color: #57534e; }
  .wtsTickGrid { display: flex; gap: 3px; flex-shrink: 0; }
  .wtsTickCol { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 22px; }
  .wtsTickDay { font-size: 7px; font-weight: 700; }
  .wtsTickBox { width: 14px; height: 14px; border: 1px solid #000; background: #fff; box-sizing: border-box; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; line-height: 1; }
  .wtsTickBox.on { background: #f5f5f4; }
  .wtsFoot { display: flex; gap: 8px; padding: 8px 10px; align-items: stretch; }
  .wtsOffice { flex: 1.1; border: 1px solid #000; background: #e7e5e4; padding: 6px 8px; min-height: 52px; }
  .wtsOfficeTitle { font-size: 10px; font-weight: 800; margin-bottom: 6px; }
  .wtsOfficeLine { font-size: 9px; border-bottom: 1px dotted #444; padding-bottom: 14px; }
  .wtsHours { flex: 0.9; border: 1px solid #000; padding: 6px 8px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .wtsHoursVal { font-size: 16px; font-weight: 800; }
  .wtsSig { flex: 1.1; border: 1px solid #000; padding: 6px 8px; min-height: 52px; }
  .wtsSigBlank { height: 36px; border: 1px dashed #a8a29e; margin-top: 4px; }
  .wtsSigImg { display: block; max-height: 40px; max-width: 100%; margin-top: 4px; object-fit: contain; }
  .wtsSignedAt { font-size: 8px; color: #44403c; margin-top: 4px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
`;

export function drawWeeklyTripSheetHeaderJsPdf(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    width: number;
    weekStarting: string;
    driverName: string;
    truckRegs: string[];
    checklistTicks?: ChecklistTickMatrix;
  }
): number {
  const { x, width } = opts;
  let y = opts.y;
  const ink: [number, number, number] = [0, 0, 0];
  const headH = 18;
  const checkH = 22;
  const totalH = headH + checkH;

  doc.setDrawColor(...ink);
  doc.setLineWidth(0.25);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, width, totalH, "S");

  const colL = width * 0.34;
  const colC = width * 0.32;
  const colR = width - colL - colC;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...ink);
  doc.text("WEEK ENDING:", x + 2, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(weekEndingDateLabel(opts.weekStarting), x + 28, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("DRIVER'S NAME (PRINT):", x + 2, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const driverClipped = doc.splitTextToSize((opts.driverName || "").trim() || "—", colL - 4);
  doc.text(String(driverClipped[0] ?? "—"), x + 2, y + 15.5);

  doc.setDrawColor(...ink);
  doc.rect(x + colL, y + 2, colC - 2, headH - 4, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("WEEKLY TRIP SHEET", x + colL + (colC - 2) / 2, y + 10, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Truck Reg No:", x + colL + colC, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const regText = opts.truckRegs.length ? opts.truckRegs.join(", ") : "—";
  const regLines = doc.splitTextToSize(regText, colR - 4);
  doc.text(regLines.slice(0, 3), x + colL + colC, y + 9);

  doc.line(x, y + headH, x + width, y + headH);

  const checkTop = y + headH;
  const labW = width * 0.42;
  const tickAreaW = width - labW - 4;
  const tickW = tickAreaW / 7;

  WTS_CHECKLIST_ROWS.forEach((label, rowIdx) => {
    const ry = checkTop + 2 + rowIdx * 6.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...ink);
    doc.text(`${label} (tick)`, x + 2, ry + 3.5);
    WTS_DAY_ABBREVS.forEach((d, i) => {
      const tx = x + labW + i * tickW;
      if (rowIdx === 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.text(d, tx + tickW / 2 - 1, ry - 0.5, { align: "center" });
      }
      const bx = tx + tickW / 2 - 2.5;
      const by = ry + 0.5;
      doc.setDrawColor(...ink);
      doc.rect(bx, by, 5, 5, "S");
      if (tickFor(opts.checklistTicks, rowIdx, i)) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text("X", bx + 2.5, by + 3.8, { align: "center" });
      }
    });
  });

  return y + totalH + 3;
}

export function drawWeeklyTripSheetFooterJsPdf(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    width: number;
    weekWorkMinutes: number;
    signature?: string | null;
    signedAt?: string | null;
  }
): number {
  const { x, width } = opts;
  let y = opts.y;
  const ink: [number, number, number] = [0, 0, 0];
  const footH = 36;
  const gap = 2;
  const colW = (width - gap * 2) / 3;

  // Caller reserves space so signature stays with the last day tile — do not orphan on a new page.

  doc.setFillColor(231, 229, 228);
  doc.rect(x, y, colW, footH, "FD");
  doc.setDrawColor(...ink);
  doc.rect(x, y, colW, footH, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...ink);
  doc.text("OFFICE USE", x + 2, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Checked / Recorded by:", x + 2, y + 14);
  doc.setDrawColor(100, 100, 100);
  doc.line(x + 2, y + 28, x + colW - 2, y + 28);

  const hx = x + colW + gap;
  doc.setDrawColor(...ink);
  doc.setFillColor(255, 255, 255);
  doc.rect(hx, y, colW, footH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Total Working Hours Per Week:", hx + 2, y + 8);
  doc.setFontSize(14);
  doc.text(formatWeekWorkHoursTotal(opts.weekWorkMinutes), hx + 2, y + 22);

  const sx = hx + colW + gap;
  doc.rect(sx, y, colW, footH, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("DRIVER SIGNATURE", sx + 2, y + 6);
  const sig = (opts.signature || "").trim();
  if (sig) {
    try {
      doc.addImage(sig, "PNG", sx + 2, y + 8, colW - 4, 20);
    } catch {
      doc.setDrawColor(160, 160, 160);
      doc.rect(sx + 2, y + 8, colW - 4, 20, "S");
    }
  } else {
    doc.setDrawColor(160, 160, 160);
    doc.rect(sx + 2, y + 8, colW - 4, 20, "S");
  }
  if (opts.signedAt) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Signed: ${new Date(opts.signedAt).toLocaleString("en-AU", { timeZone: "Australia/Perth" })}`,
      sx + 2,
      y + footH - 2
    );
  }

  return y + footH + 3;
}
