import type { FatigueSheet } from "@/lib/api";
import { computeEvidenceSummary } from "@/lib/evidence";
import { jurisdictionDisplayLabel } from "@/lib/jurisdiction";
import { listSheetsOfflineFirst } from "@/lib/offline-api";
import { getPerthNowParts } from "@/lib/perth-now";
import { ROADSIDE_PDF_DISCLAIMER } from "@/lib/roadside-pdf";
import { getRoadsideProduceFromYmd, selectSheetsForRoadsideProduce } from "@/lib/roadside-produce";
import { computeComplianceForCachedSheets } from "@/lib/sheet-export-compliance-cache";
import type { RoadsidePdfPayload, SheetJsPdfInput } from "@/lib/sheet-jspdf-export";

export type RoadsideProduceClientResult =
  | { ok: true; blob: Blob; filename: string; weekCount: number }
  | { ok: false; error: string };

function buildRoadsidePayloadForSheet(
  sheet: FatigueSheet,
  allSheets: FatigueSheet[]
): RoadsidePdfPayload {
  const { results, jurisdictionCode } = computeComplianceForCachedSheets(allSheets, sheet);
  const rv = results.filter((r) => r.type === "violation");
  const rw = results.filter((r) => r.type === "warning");
  const ev = computeEvidenceSummary(sheet.days ?? []);
  return {
    driverName: sheet.driver_name,
    weekStarting: sheet.week_starting,
    jurisdictionLabel: jurisdictionDisplayLabel(jurisdictionCode),
    violations: rv.map((v) => ({ day: v.day, message: v.message })),
    warnings: rw.map((w) => ({ day: w.day, message: w.message })),
    evidence: {
      gpsCoveragePct: ev.gpsCoveragePct,
      gpsKm: ev.gpsKm,
      odometerKm: ev.odometerKm,
      movingDuringRestCount: ev.movingDuringRestCount,
      flags: ev.flags.map((f) => ({ severity: f.severity, message: f.message })),
    },
    disclaimer: ROADSIDE_PDF_DISCLAIMER,
  };
}

function sheetJsPdfInput(
  sheet: FatigueSheet,
  roadsidePayload: RoadsidePdfPayload,
  todayStr: string,
  generatedAtLabel: string
): SheetJsPdfInput {
  return {
    sheet: {
      driver_name: sheet.driver_name,
      second_driver: sheet.second_driver ?? null,
      driver_type: sheet.driver_type,
      week_starting: sheet.week_starting,
      days: (sheet.days ?? []) as Array<Record<string, unknown>>,
      status: sheet.status,
      signature: sheet.signature ?? null,
      signed_at: sheet.signed_at ?? null,
      jurisdiction_label: roadsidePayload.jurisdictionLabel,
      last_24h_break: sheet.last_24h_break ?? null,
    },
    roadsidePayload,
    todayStr,
    generatedAtLabel,
  };
}

/**
 * Build 28-day roadside PDF from IndexedDB-cached weeks (works fully offline).
 */
export async function buildRoadsideProducePdfFromCache(
  driverName: string
): Promise<RoadsideProduceClientResult> {
  const trimmed = driverName.trim();
  if (!trimmed) {
    return { ok: false, error: "Driver name is required." };
  }

  let allSheets: FatigueSheet[];
  try {
    allSheets = await listSheetsOfflineFirst();
  } catch {
    return { ok: false, error: "Could not read saved weeks on this device." };
  }

  const mine = allSheets.filter((s) => s.driver_name?.trim() === trimmed);
  const { ymd: todayStr } = getPerthNowParts();
  const fromYmd = getRoadsideProduceFromYmd(todayStr);
  const inWindow = selectSheetsForRoadsideProduce(mine, fromYmd, todayStr);

  if (inWindow.length === 0) {
    return {
      ok: false,
      error: "No weekly records in the last 28 days on this device. Log and save at least one week first.",
    };
  }

  const generatedAtLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" });

  try {
    const [{ buildProduceCoverPdfBytes }, { buildSingleSheetJsPdfBuffer }, { PDFDocument }] =
      await Promise.all([
        import("@/lib/roadside-cover-jspdf"),
        import("@/lib/sheet-jspdf-export"),
        import("pdf-lib"),
      ]);
    const merged = await PDFDocument.create();

    const coverBytes = await buildProduceCoverPdfBytes({
      driverName: trimmed,
      fromYmd,
      toYmd: todayStr,
      weekCount: inWindow.length,
      generatedAtLabel,
    });
    const coverDoc = await PDFDocument.load(coverBytes);
    const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
    coverPages.forEach((p) => merged.addPage(p));

    for (const sheet of inWindow) {
      const roadsidePayload = buildRoadsidePayloadForSheet(sheet, mine);
      const weekBytes = await buildSingleSheetJsPdfBuffer(
        sheetJsPdfInput(sheet, roadsidePayload, todayStr, generatedAtLabel)
      );
      const weekDoc = await PDFDocument.load(weekBytes);
      const weekPages = await merged.copyPages(weekDoc, weekDoc.getPageIndices());
      weekPages.forEach((p) => merged.addPage(p));
    }

    const bytes = await merged.save();
    const timeStamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "");
    const safeName = trimmed.replace(/[\s"\r\n\\]+/g, "-").replace(/[^\w\-.]/g, "") || "driver";
    const filename = `roadside-produce-${safeName}-${timeStamp}.pdf`;
    const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
    return { ok: true, blob, filename, weekCount: inWindow.length };
  } catch {
    return { ok: false, error: "PDF generation failed on this device. Try again when online." };
  }
}

export { downloadRoadsidePdfBlob } from "@/lib/roadside-produce-download";
