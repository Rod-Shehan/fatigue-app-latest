import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prepareRoadsidePdfExtras } from "@/lib/roadside-pdf-extras";
import { ROADSIDE_PDF_DISCLAIMER } from "@/lib/roadside-pdf";
import { computeEvidenceSummary } from "@/lib/evidence";
import { jurisdictionDisplayLabel, parseJurisdictionCode } from "@/lib/jurisdiction";
import { getPerthNowParts } from "@/lib/perth-now";
import {
  buildSingleSheetJsPdfBuffer,
  renderPdfHtml,
  type RoadsidePdfPayload,
} from "@/lib/sheet-jspdf-export";

export { getPerthNowParts } from "@/lib/perth-now";
export {
  buildSingleSheetJsPdfBuffer,
  renderPdfHtml,
  type RoadsidePdfPayload,
  type SheetJsPdfInput,
} from "@/lib/sheet-jspdf-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const row = await prisma.fatigueSheet.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    if (!canAccessSheet(row, access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let days: Array<{
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
    try {
      const parsed = row.days ? JSON.parse(row.days) : [];
      days = Array.isArray(parsed) ? parsed : [];
    } catch {
      days = [];
    }

    const jurisdictionLabel = jurisdictionDisplayLabel(parseJurisdictionCode(row.jurisdictionCode));

    const sheet = {
      driver_name: row.driverName,
      second_driver: row.secondDriver,
      driver_type: row.driverType,
      week_starting: row.weekStarting,
      days,
      status: row.status,
      signature: row.signature,
      signed_at: row.signedAt?.toISOString() ?? null,
      jurisdiction_label: jurisdictionLabel,
      last_24h_break: row.last24hBreak,
    };

    const roadsideExtras = await prepareRoadsidePdfExtras(prisma, row, id);
    const rv = roadsideExtras.results.filter((r) => r.type === "violation");
    const rw = roadsideExtras.results.filter((r) => r.type === "warning");
    const roadsidePayload: RoadsidePdfPayload = {
      driverName: row.driverName,
      weekStarting: row.weekStarting,
      jurisdictionLabel: roadsideExtras.jurisdictionLabel,
      violations: rv.map((v) => ({ day: v.day, message: v.message })),
      warnings: rw.map((w) => ({ day: w.day, message: w.message })),
      evidence: (() => {
        const ev = computeEvidenceSummary(days);
        return {
          gpsCoveragePct: ev.gpsCoveragePct,
          gpsKm: ev.gpsKm,
          odometerKm: ev.odometerKm,
          movingDuringRestCount: ev.movingDuringRestCount,
          flags: ev.flags.map((f) => ({ severity: f.severity, message: f.message })),
        };
      })(),
      disclaimer: ROADSIDE_PDF_DISCLAIMER,
      qrDataUrl: roadsideExtras.qrDataUrl,
    };

    try {
      const [{ default: chromium }, puppeteer] = await Promise.all([
        import("@sparticuz/chromium"),
        import("puppeteer-core"),
      ]);

      const executablePath = await chromium.executablePath();
      if (!executablePath) throw new Error("Chromium executablePath not available");

      const todayStr = getPerthNowParts().ymd;
      const generatedAtLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" });
      const html = renderPdfHtml({
        sheet: {
          driver_name: row.driverName,
          second_driver: row.secondDriver,
          driver_type: row.driverType,
          week_starting: row.weekStarting,
          days,
          jurisdiction_label: jurisdictionLabel,
          last_24h_break: row.last24hBreak,
          status: row.status,
          signed_at: row.signedAt?.toISOString() ?? null,
        },
        todayStr,
        generatedAtLabel,
        roadside: roadsidePayload,
      });

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

        const timeStamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "");
        const safeName = (row.driverName || "unknown").replace(/[\s"\r\n\\]+/g, "-").replace(/[^\w\-.]/g, "") || "sheet";
        const filename = `fatigue-sheet-${safeName}-${timeStamp}.pdf`;
        return new NextResponse(Buffer.from(pdfBytes), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "private, no-store, max-age=0, must-revalidate",
            Pragma: "no-cache",
          },
        });
      } finally {
        await browser.close();
      }
    } catch {
      /* jsPDF fallback below */
    }

    const pdfBytes = await buildSingleSheetJsPdfBuffer({
      sheet,
      roadsidePayload,
      todayStr: getPerthNowParts().ymd,
      generatedAtLabel: new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" }),
    });
    const timeStamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "");
    const safeName = (sheet.driver_name || "unknown")
      .replace(/[\s"\r\n\\]+/g, "-")
      .replace(/[^\w\-.]/g, "") || "sheet";
    const filename = `fatigue-sheet-${safeName}-${timeStamp}.pdf`;
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
