/**
 * Dedicated checklist PDF (Phase 6 / H2) — separate from fatigue 28-day roadside.
 * System of record remains day JSON (Q1); this is an on-demand view.
 */

import { PRODUCT_NAME_EXPORT } from "@/lib/branding";
import { getSheetDayDateString } from "@/lib/weeks";
import { checklistFaultMobilityLabel } from "./item-types";
import {
  isChecklistRecordType,
  listCompletedChecklistsOfType,
  type ChecklistRecord,
  type ChecklistRecordType,
} from "./record";
import { CHECKLIST_BRAND } from "./tokens";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const CHECKLIST_PDF_BUTTON_LABEL = "Produce checklist PDFs";

export const CHECKLIST_PDF_DISCLAIMER =
  "This Circadia24 checklist pack is generated from signed form records of one type for one driver week. It is not a fatigue work diary and is not part of the 28-day roadside fatigue PDF. Different checklist types are kept separate (different regs / audit call-ups). Confirm with your policies and applicable CoR / WHS duties.";

export const CHECKLIST_PDF_TYPE_TITLE: Record<ChecklistRecordType, string> = {
  ffw: "Fitness for Work",
  prestart: "Prestart inspection",
  dimension_load: "Dimension & Load",
};

const TYPE_TITLE = CHECKLIST_PDF_TYPE_TITLE;

const LOADER_PATH_LABEL: Record<string, string> = {
  present: "Loader present — signed",
  pending: "Loader pending — CoR not yet obtained",
  not_obtained: "Loader CoR not obtained — photo evidence at capture",
  self_as_loader: "Driver also loaded — dual signatures",
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function itemValueLabel(value: string): string {
  switch (value) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fault";
    case "na":
      return "N/A";
    case "acknowledged":
      return "Acknowledged";
    default:
      return value;
  }
}

function completedWhen(record: ChecklistRecord): string {
  const driver = record.signatures.find((s) => s.role === "driver");
  if (driver?.signedAtAwst) return `${driver.signedAtAwst} (AWST)`;
  return record.completedAtUtc;
}

export type ChecklistPdfDayBundle = {
  dayIndex: number;
  dayName: string;
  dateLabel: string;
  records: ChecklistRecord[];
};

export function collectChecklistPdfDays(opts: {
  weekStarting: string;
  days: Array<{ checklists?: ChecklistRecord[] | null } | null | undefined>;
  /** Required — one pack = one checklist type (different regs / audit call-ups). */
  type: ChecklistRecordType;
  /** Optional day filter (0–6). Default = whole week for that type. */
  dayIndex?: number | null;
}): ChecklistPdfDayBundle[] {
  if (!isChecklistRecordType(opts.type)) return [];
  const out: ChecklistPdfDayBundle[] = [];
  const list = opts.days.slice(0, 7);
  while (list.length < 7) list.push({});
  for (let i = 0; i < 7; i++) {
    if (opts.dayIndex != null && opts.dayIndex !== i) continue;
    const day = list[i] ?? {};
    const records = listCompletedChecklistsOfType(day.checklists, opts.type);
    if (!records.length) continue;
    out.push({
      dayIndex: i,
      dayName: DAY_NAMES[i] ?? `Day ${i + 1}`,
      dateLabel: getSheetDayDateString(opts.weekStarting, i),
      records,
    });
  }
  return out;
}

export function checklistPdfFilename(opts: {
  driverName: string;
  weekStarting: string;
  type: ChecklistRecordType;
  dayIndex?: number | null;
}): string {
  const safeName = (opts.driverName || "driver").replace(/[^\w\-]+/g, "_").slice(0, 40);
  const typeSlug =
    opts.type === "dimension_load" ? "dimension-load" : opts.type === "prestart" ? "prestart" : "ffw";
  const scope =
    opts.dayIndex != null && Number.isInteger(opts.dayIndex)
      ? `day${opts.dayIndex}`
      : "week";
  return `checklist-${typeSlug}-${safeName}-${opts.weekStarting}-${scope}.pdf`;
}

export const CHECKLIST_PDF_TYPES: ChecklistRecordType[] = ["ffw", "prestart", "dimension_load"];

function dataUrlToJsPdfFormat(dataUrl: string): { format: "PNG" | "JPEG"; data: string } | null {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const format = m[1]!.toLowerCase() === "png" ? "PNG" : "JPEG";
  return { format, data: m[2]! };
}

/**
 * Build a multi-page checklist pack PDF (jsPDF).
 * Includes photos when still present on the record (legacy / until Q1 offload).
 */
export async function buildChecklistPackJsPdfBuffer(input: {
  driverName: string;
  weekStarting: string;
  days: ChecklistPdfDayBundle[];
  generatedAtLabel: string;
  /** One type per pack — shown in header. */
  type: ChecklistRecordType;
}): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 14;
  const colW = pageW - margin * 2;
  const [mr, mg, mb] = hexToRgb(CHECKLIST_BRAND.midnight);
  const [rr, rg, rb] = hexToRgb(CHECKLIST_BRAND.red);
  const [er, eg, eb] = hexToRgb(CHECKLIST_BRAND.emerald);
  const typeTitle = TYPE_TITLE[input.type];

  let y = 0;

  const ensureSpace = (need: number) => {
    if (y + need <= 285) return;
    doc.addPage();
    y = 16;
  };

  const drawHeader = (subtitle: string) => {
    doc.setFillColor(mr, mg, mb);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${PRODUCT_NAME_EXPORT} — ${typeTitle}`, margin, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(subtitle, margin, 16);
    doc.text(input.generatedAtLabel, pageW - margin, 16, { align: "right" });
    y = 28;
  };

  drawHeader(
    `Driver: ${input.driverName || "—"}  ·  Week starting ${input.weekStarting}  ·  Not a fatigue roadside PDF`
  );

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  const disc = doc.splitTextToSize(CHECKLIST_PDF_DISCLAIMER, colW);
  doc.text(disc, margin, y);
  y += disc.length * 4 + 6;

  if (!input.days.length) {
    doc.setFont("helvetica", "bold");
    doc.text("No completed checklist records for this selection.", margin, y);
    return doc.output("arraybuffer");
  }

  for (const day of input.days) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(mr, mg, mb);
    doc.text(`${day.dayName}  ${day.dateLabel}`, margin, y);
    y += 7;
    doc.setDrawColor(42, 59, 80);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + colW, y);
    y += 5;

    for (const record of day.records) {
      ensureSpace(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(TYPE_TITLE[record.type], margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Completed ${completedWhen(record)}`, margin, y);
      y += 5;

      if (record.type === "prestart" && record.prestartResponsible === false) {
        ensureSpace(14);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.text("Not responsible for prestart", margin, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        const reason = doc.splitTextToSize(record.prestartSkipReason || "—", colW);
        doc.text(reason, margin, y);
        y += reason.length * 3.5 + 3;
      }

      if (record.loaderPath) {
        ensureSpace(10);
        doc.setTextColor(30, 41, 59);
        const pathLabel = LOADER_PATH_LABEL[record.loaderPath] ?? record.loaderPath;
        const pending = record.loaderPath === "pending" || record.loaderPath === "not_obtained";
        if (pending) doc.setTextColor(rr, rg, rb);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`Loader CoR: ${pathLabel}`, margin, y);
        y += 4;
        if (record.loaderName) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 41, 59);
          doc.text(`Loader name: ${record.loaderName}`, margin, y);
          y += 4;
        }
      }

      const headerEntries = Object.entries(record.header ?? {}).filter(
        ([, v]) => v != null && String(v).trim() !== ""
      );
      if (headerEntries.length) {
        ensureSpace(8 + headerEntries.length * 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        for (const [k, v] of headerEntries) {
          doc.text(`${k.replace(/_/g, " ")}: ${String(v)}`, margin, y);
          y += 3.8;
        }
        y += 2;
      }

      for (const item of record.items) {
        ensureSpace(10);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        const label = item.label || item.code;
        const lines = doc.splitTextToSize(label, colW - 28);
        doc.text(lines, margin, y);
        const valueY = y;
        if (item.value === "fail") doc.setTextColor(rr, rg, rb);
        else if (item.value === "pass" || item.value === "acknowledged") doc.setTextColor(er, eg, eb);
        else doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text(itemValueLabel(item.value), margin + colW, valueY, { align: "right" });
        y += lines.length * 3.5 + 1;

        if (item.kind === "pass_fail" && item.value === "fail" && item.defect) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 41, 59);
          const desc = doc.splitTextToSize(item.defect.description || "—", colW - 4);
          doc.text(desc, margin + 2, y);
          y += desc.length * 3.5;
          const mob = checklistFaultMobilityLabel(item.defect.mobilityStatus);
          if (mob) {
            doc.setTextColor(100, 116, 139);
            doc.text(mob, margin + 2, y);
            y += 3.5;
          }
          for (const photo of item.defect.photoDataUrls ?? []) {
            const parsed = dataUrlToJsPdfFormat(photo);
            if (!parsed) continue;
            ensureSpace(28);
            try {
              doc.addImage(parsed.data, parsed.format, margin + 2, y, 24, 24);
              y += 26;
            } catch {
              /* skip bad image */
            }
          }
        }
      }

      if (record.actionedFaultText) {
        ensureSpace(12);
        doc.setTextColor(rr, rg, rb);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Actioned fault", margin, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        const t = doc.splitTextToSize(record.actionedFaultText, colW);
        doc.text(t, margin, y);
        y += t.length * 3.5 + 2;
      }

      for (const photo of record.evidencePhotoDataUrls ?? []) {
        const parsed = dataUrlToJsPdfFormat(photo);
        if (!parsed) continue;
        ensureSpace(28);
        try {
          doc.addImage(parsed.data, parsed.format, margin, y, 28, 28);
          y += 30;
        } catch {
          /* skip */
        }
      }

      for (const sig of record.signatures) {
        ensureSpace(32);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text(
          `${sig.role === "loader" ? "As loader" : "As driver"}${sig.signedAtAwst ? ` · ${sig.signedAtAwst}` : ""}`,
          margin,
          y
        );
        y += 3;
        const parsed = dataUrlToJsPdfFormat(sig.pngDataUrl);
        if (parsed) {
          try {
            doc.addImage(parsed.data, parsed.format, margin, y, 60, 18);
            y += 20;
          } catch {
            y += 4;
          }
        } else {
          y += 4;
        }
      }

      y += 6;
    }
  }

  return doc.output("arraybuffer");
}
