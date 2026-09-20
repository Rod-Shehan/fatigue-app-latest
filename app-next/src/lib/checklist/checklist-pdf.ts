/**
 * Dedicated checklist PDF — separate from fatigue 28-day roadside.
 * Filing date is always week ending (same as the Weekly Trip Sheet).
 * One completed log = one sheet. Identity is driver and/or vehicle, not signed-at.
 */

import { weekEndingDateLabel } from "@/lib/worksafe-day-sheet/weekly-trip-sheet";
import { getSheetDayDateString } from "@/lib/weeks";
import { headerString } from "./audit-identity";
import { checklistFaultMobilityLabel } from "./item-types";
import {
  isChecklistRecordType,
  isPrestartRecordType,
  listCompletedChecklistsOfType,
  type ChecklistRecord,
  type ChecklistRecordType,
} from "./record";
import { CHECKLIST_BRAND } from "./tokens";
import {
  FFW_FORM_TITLE,
  FORKLIFT_PRESTART_FORM_TITLE,
  HOOKUP_FORM_TITLE,
  LOAD_FORM_TITLE,
  PRESTART_FORM_TITLE,
  TRAILER_PRESTART_FORM_TITLE,
} from "./schema-stubs";
import { FAULT_REPORT_FORM_TITLE } from "./fault-report";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const CHECKLIST_PDF_BUTTON_LABEL = "Produce checklist PDFs";

export const CHECKLIST_PDF_DISCLAIMER =
  "Each sheet is one signed log. The record date is week ending — not the time signed and not when this file was produced.";

export const CHECKLIST_PDF_TYPE_TITLE: Record<ChecklistRecordType, string> = {
  ffw: FFW_FORM_TITLE,
  prestart: PRESTART_FORM_TITLE,
  prestart_trailer: TRAILER_PRESTART_FORM_TITLE,
  prestart_forklift: FORKLIFT_PRESTART_FORM_TITLE,
  dimension_load: LOAD_FORM_TITLE,
  hookup: HOOKUP_FORM_TITLE,
  fault_report: FAULT_REPORT_FORM_TITLE,
};

const TYPE_TITLE = CHECKLIST_PDF_TYPE_TITLE;

const LOADER_PATH_LABEL: Record<string, string> = {
  present: "Loader present — signed",
  pending: "Loader pending — CoR not yet obtained",
  not_obtained: "Loader CoR not obtained — photo evidence at capture",
  self_as_loader: "Driver also loaded — dual signatures",
};

function pdfTypeFileSlug(title: string): string {
  return title.trim().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
}

export const CHECKLIST_PDF_TYPE_FILE_SLUG: Record<ChecklistRecordType, string> = {
  ffw: pdfTypeFileSlug(FFW_FORM_TITLE),
  prestart: pdfTypeFileSlug(PRESTART_FORM_TITLE),
  prestart_trailer: pdfTypeFileSlug(TRAILER_PRESTART_FORM_TITLE),
  prestart_forklift: pdfTypeFileSlug(FORKLIFT_PRESTART_FORM_TITLE),
  dimension_load: pdfTypeFileSlug(LOAD_FORM_TITLE),
  hookup: pdfTypeFileSlug(HOOKUP_FORM_TITLE),
  fault_report: pdfTypeFileSlug(FAULT_REPORT_FORM_TITLE),
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function itemValueLabel(value: string, type?: ChecklistRecordType): string {
  switch (value) {
    case "pass":
      return type === "hookup" ? "Completed" : "Pass";
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

function safeFilePart(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 40) || fallback;
}

/** Same Saturday label as the Weekly Trip Sheet (`dd/mm/yyyy`). */
export function checklistPdfWeekEndingLabel(weekStarting: string): string {
  return weekEndingDateLabel(weekStarting);
}

/** Week ending for filenames (`dd-mm-yyyy`). */
export function checklistPdfWeekEndingFileToken(weekStarting: string): string {
  return checklistPdfWeekEndingLabel(weekStarting).replace(/\//g, "-");
}

export type ChecklistPdfIdentity = {
  driver: string;
  vehicle: string;
  /** Filename stem after the form title (no week-ending suffix). */
  fileStem: string;
  /** Header line under the form title. */
  titleLine: string;
};

/**
 * How the sheet is named for filing.
 * FFW: driver. Vehicle / load: vehicle rego. Hook-up: driver and rego.
 */
export function checklistPdfIdentity(
  record: ChecklistRecord,
  sheetDriverName?: string | null
): ChecklistPdfIdentity {
  const driver =
    headerString(record.header, "driver_name") || (sheetDriverName || "").trim() || "driver";
  const vehicle =
    headerString(record.header, "vehicle_rego") ||
    headerString(record.header, "truck_rego") ||
    headerString(record.header, "audit_vehicle") ||
    "";
  const trailer = headerString(record.header, "trailer_rego");

  if (record.type === "ffw") {
    return {
      driver,
      vehicle: "",
      fileStem: safeFilePart(driver, "driver"),
      titleLine: `Driver: ${driver}`,
    };
  }

  if (record.type === "hookup") {
    const rego = [vehicle, trailer].filter(Boolean).join("-") || "vehicle";
    return {
      driver,
      vehicle: rego,
      fileStem: `${safeFilePart(driver, "driver")}_${safeFilePart(rego, "vehicle")}`,
      titleLine: `Driver: ${driver}  ·  Vehicle: ${rego}`,
    };
  }

  if (record.type === "fault_report") {
    const plant =
      vehicle ||
      headerString(record.header, "fleet_unit") ||
      "plant";
    return {
      driver,
      vehicle: plant,
      fileStem: safeFilePart(plant, "plant"),
      titleLine: `Plant: ${plant}  ·  Driver: ${driver}`,
    };
  }

  const plant = vehicle || "vehicle";
  const plantLabel =
    record.type === "prestart_trailer"
      ? "Trailer"
      : record.type === "prestart_forklift"
        ? "Forklift"
        : "Vehicle";
  return {
    driver,
    vehicle: plant,
    fileStem: safeFilePart(plant, "vehicle"),
    titleLine: `${plantLabel}: ${plant}`,
  };
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
  type: ChecklistRecordType;
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

export function flattenChecklistPdfRecords(days: ChecklistPdfDayBundle[]): ChecklistRecord[] {
  return days.flatMap((day) => day.records);
}

function sharedFileStem(
  records: ChecklistRecord[] | null | undefined,
  type: ChecklistRecordType,
  driverName?: string | null
): string | null {
  const list = records ?? [];
  if (!list.length) {
    return type === "ffw" ? safeFilePart(driverName || "", "driver") : null;
  }
  const stems = [...new Set(list.map((r) => checklistPdfIdentity(r, driverName).fileStem))];
  return stems.length === 1 ? stems[0]! : null;
}

export function checklistPdfFilename(opts: {
  weekStarting: string;
  type: ChecklistRecordType;
  driverName?: string | null;
  record?: ChecklistRecord | null;
  records?: ChecklistRecord[] | null;
}): string {
  const ending = checklistPdfWeekEndingFileToken(opts.weekStarting);
  const slug = CHECKLIST_PDF_TYPE_FILE_SLUG[opts.type];
  const stem = opts.record
    ? checklistPdfIdentity(opts.record, opts.driverName).fileStem
    : sharedFileStem(opts.records, opts.type, opts.driverName);
  if (stem) return `${slug}_${stem}_week-ending-${ending}.pdf`;
  return `${slug}_week-ending-${ending}.pdf`;
}

export function uniqueChecklistPdfFilename(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const suffix = ".pdf";
  const root = base.endsWith(suffix) ? base.slice(0, -suffix.length) : base;
  let n = 2;
  let next = `${root}-${n}${suffix}`;
  while (used.has(next)) {
    n += 1;
    next = `${root}-${n}${suffix}`;
  }
  used.add(next);
  return next;
}

export const CHECKLIST_PDF_TYPES: ChecklistRecordType[] = [
  "ffw",
  "prestart",
  "prestart_trailer",
  "prestart_forklift",
  "dimension_load",
  "hookup",
  "fault_report",
];

function dataUrlToJsPdfFormat(dataUrl: string): { format: "PNG" | "JPEG"; data: string } | null {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const format = m[1]!.toLowerCase() === "png" ? "PNG" : "JPEG";
  return { format, data: m[2]! };
}

/**
 * One completed log per A4 sheet. Header date is week ending only.
 */
export async function buildChecklistPackJsPdfBuffer(input: {
  driverName: string;
  weekStarting: string;
  days: ChecklistPdfDayBundle[];
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
  const weekEnding = checklistPdfWeekEndingLabel(input.weekStarting);
  const records = flattenChecklistPdfRecords(input.days);

  let y = 0;

  const ensureSpace = (need: number) => {
    if (y + need <= 285) return;
    doc.addPage();
    y = 16;
  };

  const drawSheetHeader = (identityLine: string) => {
    doc.setFillColor(mr, mg, mb);
    doc.rect(0, 0, pageW, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(typeTitle, margin, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`WEEK ENDING: ${weekEnding}`, pageW - margin, 10, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(identityLine, margin, 17);
    doc.setFontSize(8);
    doc.text("Record date is week ending — not signed time, not file produced time", margin, 22);
    y = 32;
  };

  if (!records.length) {
    drawSheetHeader(`Driver: ${input.driverName || "—"}`);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("No completed checklist records for this selection.", margin, y);
    return doc.output("arraybuffer");
  }

  records.forEach((record, index) => {
    if (index > 0) doc.addPage();
    const identity = checklistPdfIdentity(record, input.driverName);
    drawSheetHeader(identity.titleLine);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8);
    const disc = doc.splitTextToSize(CHECKLIST_PDF_DISCLAIMER, colW);
    doc.text(disc, margin, y);
    y += disc.length * 4 + 5;

    if (isPrestartRecordType(record.type) && record.prestartResponsible === false) {
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

    const observations = String(record.header?.faults_and_observations ?? "").trim();
    const headerEntries = Object.entries(record.header ?? {}).filter(
      ([k, v]) =>
        k !== "faults_and_observations" && v != null && String(v).trim() !== ""
    );
    if (headerEntries.length) {
      ensureSpace(8 + headerEntries.length * 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      for (const [k, v] of headerEntries) {
        const line = doc.splitTextToSize(`${k.replace(/_/g, " ")}: ${String(v)}`, colW);
        ensureSpace(line.length * 3.8);
        doc.text(line, margin, y);
        y += line.length * 3.8;
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
      doc.text(itemValueLabel(item.value, record.type), margin + colW, valueY, { align: "right" });
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

    if (observations) {
      ensureSpace(12);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Faults and observations", margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      const obs = doc.splitTextToSize(observations, colW);
      doc.text(obs, margin, y);
      y += obs.length * 3.5 + 2;
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
      doc.text(sig.role === "loader" ? "As loader" : "As driver", margin, y);
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
  });

  return doc.output("arraybuffer");
}
