import type { FatigueSheet } from "@/lib/api";
import { listSheetsOfflineFirst } from "@/lib/offline-api";
import { getPerthNowParts } from "@/lib/perth-now";
import { getRoadsideProduceFromYmd, selectSheetsForRoadsideProduce } from "@/lib/roadside-produce";
import type { SheetJsPdfInput } from "@/lib/sheet-jspdf-export";

export type RoadsideProduceClientResult =
  | { ok: true; blob: Blob; filename: string; weekCount: number }
  | { ok: false; error: string };

function sheetJsPdfInput(
  sheet: FatigueSheet,
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
      jurisdiction_label: "",
      last_24h_break: sheet.last_24h_break ?? null,
      last_24h_rest_1: sheet.last_24h_rest_1 ?? null,
      last_24h_rest_2: sheet.last_24h_rest_2 ?? null,
      last_24h_rest_3: sheet.last_24h_rest_3 ?? null,
      last_24h_rest_4: sheet.last_24h_rest_4 ?? null,
    },
    todayStr,
    generatedAtLabel,
    layout: "tripSheetOnly",
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
    const [{ buildSingleSheetJsPdfBuffer }, { PDFDocument }] = await Promise.all([
      import("@/lib/sheet-jspdf-export"),
      import("pdf-lib"),
    ]);
    const merged = await PDFDocument.create();

    for (const sheet of inWindow) {
      const weekBytes = await buildSingleSheetJsPdfBuffer(
        sheetJsPdfInput(sheet, todayStr, generatedAtLabel)
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
