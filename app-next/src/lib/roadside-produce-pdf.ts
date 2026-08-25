import type { FatigueSheet, PrismaClient } from "@prisma/client";
import { jurisdictionDisplayLabel, parseJurisdictionCode } from "@/lib/jurisdiction";
import { formatProduceWindowLabel } from "@/lib/roadside-produce";
import { ROADSIDE_PDF_DISCLAIMER } from "@/lib/roadside-pdf";
import { sanitizePdfPlainText } from "@/lib/pdf-plain-text";
import { buildSingleSheetJsPdfBuffer, renderPdfHtml } from "@/lib/sheet-jspdf-export";
import { findRosterPdfIdentity } from "@/lib/roster-driver-pdf";
import { WORKSAFE_PDF_DAY_CSS } from "@/lib/worksafe-day-sheet/pdf-render";
import { WEEKLY_TRIP_SHEET_PDF_CSS } from "@/lib/worksafe-day-sheet/weekly-trip-sheet";

export function extractPdfHtmlBody(fullHtml: string): string {
  const m = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m?.[1]?.trim() ?? fullHtml;
}

function escapeHtml(s: string) {
  return sanitizePdfPlainText(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderRoadsideProduceCoverHtml(opts: {
  driverName: string;
  fromYmd: string;
  toYmd: string;
  weekCount: number;
  generatedAtLabel: string;
}): string {
  const windowLabel = formatProduceWindowLabel(opts.fromYmd, opts.toYmd);
  return `
  <section class="produceCover">
    <h1>Roadside produce — driver record</h1>
    <p class="produceLead">Last 28 calendar days of weekly fatigue records for inspection. Times in Australia/Perth unless noted.</p>
    <table class="produceMeta">
      <tbody>
        <tr><th>Driver</th><td>${escapeHtml(opts.driverName)}</td></tr>
        <tr><th>Period</th><td>${escapeHtml(windowLabel)}</td></tr>
        <tr><th>Weeks included</th><td>${opts.weekCount}</td></tr>
        <tr><th>Generated</th><td>${escapeHtml(opts.generatedAtLabel)}</td></tr>
      </tbody>
    </table>
    <p class="produceDisclaimer">${escapeHtml(ROADSIDE_PDF_DISCLAIMER)}</p>
    <p class="produceNote">Each following page is one weekly trip sheet.</p>
  </section>`;
}

export function renderRoadsideProduceDocumentHtml(opts: {
  driverName: string;
  fromYmd: string;
  toYmd: string;
  generatedAtLabel: string;
  todayStr: string;
  weekBodies: string[];
}): string {
  void opts.driverName;
  void opts.fromYmd;
  void opts.toYmd;
  void opts.generatedAtLabel;
  void opts.todayStr;
  const weeks = opts.weekBodies
    .map((body) => `<div class="produceWeek">${body}</div>`)
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 8mm; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1e293b; margin: 0; }
      /* One weekly trip sheet per page */
      .produceWeek { page-break-before: always; break-before: page; page-break-inside: avoid; break-inside: avoid; }
      .produceWeek:first-of-type { page-break-before: auto; break-before: auto; }
      .dayCard { margin: 1px 0; padding: 0; border: none; background: transparent; break-inside: avoid; page-break-inside: avoid; }
      .wtsWeekBody { margin: 0; break-before: auto; page-break-before: auto; }
      .wtsWeekBody .wtsHeaderBlock { break-after: avoid; page-break-after: avoid; }
      .wtsLastWithFooter { break-inside: avoid; page-break-inside: avoid; }
      .wtsWeekBody .wtsFooterBlock { break-before: avoid; page-break-before: avoid; margin-top: 4px; }
      .wtsChrome { margin: 4px 0; }
      ${WORKSAFE_PDF_DAY_CSS}
      ${WEEKLY_TRIP_SHEET_PDF_CSS}
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    </style>
  </head>
  <body>
    ${weeks}
  </body>
</html>`;
}

type SheetDays = Array<{
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  date?: string;
  truck_rego?: string;
  destination?: string;
  start_kms?: number;
  end_kms?: number;
  assume_idle_from?: string;
  events?: Array<{ time: string; type: string }>;
}>;

function parseSheetDays(row: FatigueSheet): SheetDays {
  try {
    const parsed = row.days ? JSON.parse(row.days) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function buildRoadsideSheetExportInput(
  prisma: PrismaClient,
  row: FatigueSheet,
  sheetId: string
): Promise<{
  sheet: {
    driver_name: string;
    second_driver: string | null;
    driver_type: string;
    week_starting: string;
    days: SheetDays;
    jurisdiction_label: string;
    last_24h_break: string | null;
    last_24h_rest_1?: string | null;
    last_24h_rest_2?: string | null;
    last_24h_rest_3?: string | null;
    last_24h_rest_4?: string | null;
    status: string;
    signed_at: string | null;
    signature: string | null;
    operator_legal_name?: string | null;
    driver_licence_number?: string | null;
    driver_medical_expiry?: string | null;
    driver_licence_expiry?: string | null;
  };
}> {
  void sheetId;
  const days = parseSheetDays(row);
  const jurisdictionLabel = jurisdictionDisplayLabel(parseJurisdictionCode(row.jurisdictionCode));
  const tenant = await prisma.tenant.findUnique({
    where: { id: row.tenantId },
    select: { legalName: true },
  });
  const roster = await findRosterPdfIdentity(prisma, row.tenantId, row.driverName);

  return {
    sheet: {
      driver_name: row.driverName,
      second_driver: row.secondDriver,
      driver_type: row.driverType,
      week_starting: row.weekStarting,
      days,
      jurisdiction_label: jurisdictionLabel,
      last_24h_break: row.last24hBreak,
      last_24h_rest_1: row.last24hRest1,
      last_24h_rest_2: row.last24hRest2,
      last_24h_rest_3: row.last24hRest3,
      last_24h_rest_4: row.last24hRest4,
      status: row.status,
      signed_at: row.signedAt?.toISOString() ?? null,
      signature: row.signature,
      operator_legal_name: tenant?.legalName ?? null,
      driver_licence_number: roster.licenceNumber,
      driver_medical_expiry: roster.medicalExpiryYmd,
      driver_licence_expiry: roster.licenceExpiryYmd,
    },
  };
}

export async function buildWeekPdfBodyForSheet(
  prisma: PrismaClient,
  row: FatigueSheet,
  sheetId: string,
  todayStr: string,
  generatedAtLabel: string
): Promise<string> {
  const { sheet } = await buildRoadsideSheetExportInput(prisma, row, sheetId);

  const full = renderPdfHtml({
    sheet: {
      driver_name: sheet.driver_name,
      second_driver: sheet.second_driver,
      driver_type: sheet.driver_type,
      week_starting: sheet.week_starting,
      days: sheet.days,
      jurisdiction_label: sheet.jurisdiction_label,
      last_24h_break: sheet.last_24h_break,
      status: sheet.status,
      signed_at: sheet.signed_at,
      signature: sheet.signature,
      operator_legal_name: sheet.operator_legal_name,
      driver_licence_number: sheet.driver_licence_number,
      driver_medical_expiry: sheet.driver_medical_expiry,
      driver_licence_expiry: sheet.driver_licence_expiry,
    },
    todayStr,
    generatedAtLabel,
    layout: "tripSheetOnly",
  });

  return extractPdfHtmlBody(full);
}

/** Merge per-week jsPDF exports when Chromium HTML print is unavailable (Vercel). */
export async function buildRoadsideProducePdfMergedJsPdf(
  prisma: PrismaClient,
  rows: FatigueSheet[],
  opts: {
    driverName: string;
    fromYmd: string;
    toYmd: string;
    todayStr: string;
    generatedAtLabel: string;
  }
): Promise<Buffer | null> {
  void opts.driverName;
  void opts.fromYmd;
  void opts.toYmd;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const merged = await PDFDocument.create();

    for (const row of rows) {
      const { sheet } = await buildRoadsideSheetExportInput(prisma, row, row.id);
      const weekBytes = await buildSingleSheetJsPdfBuffer({
        sheet: {
          ...sheet,
          days: sheet.days as Array<Record<string, unknown>>,
        },
        todayStr: opts.todayStr,
        generatedAtLabel: opts.generatedAtLabel,
        layout: "tripSheetOnly",
      });
      const weekDoc = await PDFDocument.load(weekBytes);
      const weekPages = await merged.copyPages(weekDoc, weekDoc.getPageIndices());
      weekPages.forEach((p) => merged.addPage(p));
    }

    return Buffer.from(await merged.save());
  } catch {
    return null;
  }
}

export async function buildRoadsideProducePdfBytes(
  prisma: PrismaClient,
  rows: FatigueSheet[],
  html: string,
  opts: {
    driverName: string;
    fromYmd: string;
    toYmd: string;
    todayStr: string;
    generatedAtLabel: string;
  }
): Promise<Buffer | null> {
  const chromium = await htmlToPdfBytes(html);
  if (chromium) return chromium;
  return buildRoadsideProducePdfMergedJsPdf(prisma, rows, opts);
}

export async function htmlToPdfBytes(html: string): Promise<Buffer | null> {
  try {
    const [{ default: chromium }, puppeteer] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    const executablePath = await chromium.executablePath();
    if (!executablePath) return null;

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });

    try {
      const page = await browser.newPage();
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
      return Buffer.from(pdfBytes);
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}
