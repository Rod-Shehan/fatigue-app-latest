import type { FatigueSheet, PrismaClient } from "@prisma/client";
import { PRODUCT_NAME_EXPORT, TAGLINE_DRIVER } from "@/lib/branding";
import { computeEvidenceSummary } from "@/lib/evidence";
import { jurisdictionDisplayLabel, parseJurisdictionCode } from "@/lib/jurisdiction";
import { buildProduceCoverPdfBytes } from "@/lib/roadside-cover-jspdf";
import { formatProduceWindowLabel } from "@/lib/roadside-produce";
import { ROADSIDE_PDF_DISCLAIMER } from "@/lib/roadside-pdf";
import { prepareRoadsidePdfExtras } from "@/lib/roadside-pdf-extras";
import {
  buildSingleSheetJsPdfBuffer,
  renderPdfHtml,
  type RoadsidePdfPayload,
} from "@/lib/sheet-jspdf-export";
import { WORKSAFE_PDF_DAY_CSS } from "@/lib/worksafe-day-sheet/pdf-render";

export function extractPdfHtmlBody(fullHtml: string): string {
  const m = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m?.[1]?.trim() ?? fullHtml;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    <p class="produceNote">Each following section is one weekly sheet (WorkSafe day sheets, compliance summary, and shift log).</p>
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
  const cover = renderRoadsideProduceCoverHtml({
    driverName: opts.driverName,
    fromYmd: opts.fromYmd,
    toYmd: opts.toYmd,
    weekCount: opts.weekBodies.length,
    generatedAtLabel: opts.generatedAtLabel,
  });
  const weeks = opts.weekBodies
    .map((body) => `<div class="produceWeek">${body}</div>`)
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 12mm; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1e293b; }
      .produceCover { margin: 0 0 20px; padding: 16px 18px; border: 2px solid #b45309; border-radius: 12px; background: #fffbeb; break-after: page; }
      .produceCover h1 { font-size: 20px; font-weight: 800; margin: 0 0 8px; color: #78350f; }
      .produceLead { font-size: 12px; line-height: 1.45; margin: 0 0 12px; color: #92400e; }
      .produceMeta { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
      .produceMeta th { text-align: left; width: 34%; padding: 5px 10px 5px 0; color: #78350f; font-weight: 700; vertical-align: top; border-bottom: 1px solid #fde68a; }
      .produceMeta td { padding: 5px 0; border-bottom: 1px solid #fde68a; color: #1e293b; }
      .produceDisclaimer { font-size: 9px; color: #57534e; line-height: 1.4; margin: 0 0 8px; }
      .produceNote { font-size: 10px; color: #78716c; margin: 0; }
      .produceWeek { page-break-before: always; break-before: page; }
      .produceWeek .header { margin-top: 0; }
      .header { background: #0f172a; color: white; padding: 12px 14px; border-radius: 10px; }
      .headerRow { display:flex; justify-content:space-between; align-items:flex-end; gap: 10px; }
      .title { font-weight: 800; font-size: 18px; letter-spacing: 0.02em; }
      .subtitle { font-size: 11px; opacity: 0.9; margin-top: 2px; }
      .generated { font-size: 10px; opacity: 0.9; text-align:right; white-space:nowrap; }
      .dayCard { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; margin: 10px 0; break-inside: avoid; background: #fff; }
      ${WORKSAFE_PDF_DAY_CSS}
      .segTable { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 8px; }
      .segTable thead th { text-align:left; padding: 4px 6px; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; color:#6b7280; font-weight: 800; }
      .segTable tbody td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }
      .segTable tbody tr:nth-child(even) td { background: #fafafa; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .empty { color:#9ca3af; font-style: italic; }
      .more { font-size: 10px; color:#6b7280; margin-top: 2px; }
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
    <div class="header" style="margin-bottom: 16px;">
      <div class="headerRow">
        <div>
          <div class="title">${PRODUCT_NAME_EXPORT}</div>
          <div class="subtitle">${TAGLINE_DRIVER} · Roadside produce</div>
        </div>
        <div class="generated">Generated: ${escapeHtml(opts.generatedAtLabel)}</div>
      </div>
    </div>
    ${cover}
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
  };
  roadsidePayload: RoadsidePdfPayload;
}> {
  const days = parseSheetDays(row);
  const jurisdictionLabel = jurisdictionDisplayLabel(parseJurisdictionCode(row.jurisdictionCode));
  const roadsideExtras = await prepareRoadsidePdfExtras(prisma, row, sheetId);
  const rv = roadsideExtras.results.filter((r) => r.type === "violation");
  const rw = roadsideExtras.results.filter((r) => r.type === "warning");
  const ev = computeEvidenceSummary(days);

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
    },
    roadsidePayload: {
      driverName: row.driverName,
      weekStarting: row.weekStarting,
      jurisdictionLabel: roadsideExtras.jurisdictionLabel,
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
      qrDataUrl: roadsideExtras.qrDataUrl,
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
  const { sheet, roadsidePayload } = await buildRoadsideSheetExportInput(prisma, row, sheetId);

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
    },
    todayStr,
    generatedAtLabel,
    roadside: roadsidePayload,
  });

  return extractPdfHtmlBody(full);
}

export { buildProduceCoverPdfBytes } from "@/lib/roadside-cover-jspdf";

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
  try {
    const { PDFDocument } = await import("pdf-lib");
    const merged = await PDFDocument.create();

    const coverBytes = await buildProduceCoverPdfBytes({
      driverName: opts.driverName,
      fromYmd: opts.fromYmd,
      toYmd: opts.toYmd,
      weekCount: rows.length,
      generatedAtLabel: opts.generatedAtLabel,
    });
    const coverDoc = await PDFDocument.load(coverBytes);
    const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
    coverPages.forEach((p) => merged.addPage(p));

    for (const row of rows) {
      const { sheet, roadsidePayload } = await buildRoadsideSheetExportInput(prisma, row, row.id);
      const weekBytes = await buildSingleSheetJsPdfBuffer({
        sheet: {
          ...sheet,
          days: sheet.days as Array<Record<string, unknown>>,
        },
        roadsidePayload,
        todayStr: opts.todayStr,
        generatedAtLabel: opts.generatedAtLabel,
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
