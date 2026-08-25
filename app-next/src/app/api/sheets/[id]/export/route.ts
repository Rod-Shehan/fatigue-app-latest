import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jurisdictionDisplayLabel, parseJurisdictionCode } from "@/lib/jurisdiction";
import { getPerthNowParts } from "@/lib/perth-now";
import { buildSingleSheetJsPdfBuffer, renderPdfHtml } from "@/lib/sheet-jspdf-export";

export { getPerthNowParts } from "@/lib/perth-now";
export {
  buildSingleSheetJsPdfBuffer,
  renderPdfHtml,
  type RoadsidePdfPayload,
  type SheetJsPdfInput,
} from "@/lib/sheet-jspdf-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Chromium + a full week of events/checklists can exceed the default limit. */
export const maxDuration = 60;

function asNodePdfBuffer(bytes: ArrayBuffer | Uint8Array): Buffer {
  return Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const row = await prisma.fatigueSheet.findUnique({
      where: { id },
      include: { tenant: { select: { legalName: true } } },
    });
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
      last_24h_rest_1: row.last24hRest1,
      last_24h_rest_2: row.last24hRest2,
      last_24h_rest_3: row.last24hRest3,
      last_24h_rest_4: row.last24hRest4,
      operator_legal_name: row.tenant.legalName,
    };

    const todayStr = getPerthNowParts().ymd;
    const generatedAtLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" });

    // Vercel: skip Chromium. Loading it first often exhausts the isolate, so the
    // jsPDF fallback never runs — that is what returns {"error":"Export failed"}
    // on heavier completed weeks (events + daily checklists + signature).
    if (!process.env.VERCEL) {
      try {
        const [{ default: chromium }, puppeteer] = await Promise.all([
          import("@sparticuz/chromium"),
          import("puppeteer-core"),
        ]);

        const executablePath = await chromium.executablePath();
        if (!executablePath) throw new Error("Chromium executablePath not available");

        const html = renderPdfHtml({
          sheet,
          todayStr,
          generatedAtLabel,
          layout: "tripSheetOnly",
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
          const safeName =
            (row.driverName || "unknown").replace(/[\s"\r\n\\]+/g, "-").replace(/[^\w\-.]/g, "") ||
            "sheet";
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
      } catch (err) {
        console.error("[sheets/export] chromium failed, using jsPDF", err);
      }
    }

    const pdfBytes = await buildSingleSheetJsPdfBuffer({
      sheet,
      todayStr,
      generatedAtLabel,
      layout: "tripSheetOnly",
    });
    const timeStamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "");
    const safeName = (sheet.driver_name || "unknown")
      .replace(/[\s"\r\n\\]+/g, "-")
      .replace(/[^\w\-.]/g, "") || "sheet";
    const filename = `fatigue-sheet-${safeName}-${timeStamp}.pdf`;
    return new NextResponse(asNodePdfBuffer(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err) {
    console.error("[sheets/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
