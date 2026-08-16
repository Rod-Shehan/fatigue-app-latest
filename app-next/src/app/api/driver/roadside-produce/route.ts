import { NextResponse } from "next/server";
import { getSessionForSheetAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPerthNowParts } from "@/lib/perth-now";
import {
  getRoadsideProduceFromYmd,
  selectSheetsForRoadsideProduce,
} from "@/lib/roadside-produce";
import {
  buildRoadsideProducePdfBytes,
  buildWeekPdfBodyForSheet,
  renderRoadsideProduceDocumentHtml,
} from "@/lib/roadside-produce-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Multi-week PDF + compliance per sheet can exceed default serverless limit. */
export const maxDuration = 60;

export async function GET() {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.isManager) {
    return NextResponse.json(
      { error: "Roadside produce is available from the driver account on this device." },
      { status: 403 }
    );
  }

  const { ymd: todayStr } = getPerthNowParts();
  const fromYmd = getRoadsideProduceFromYmd(todayStr);
  const generatedAtLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" });

  const rows = await prisma.fatigueSheet.findMany({
    where: { tenantId: access.tenantId, createdById: access.userId },
    orderBy: { weekStarting: "asc" },
  });

  const inWindow = selectSheetsForRoadsideProduce(rows, fromYmd, todayStr);

  if (inWindow.length === 0) {
    return NextResponse.json(
      { error: "No weekly records in the last 28 days. Log and save at least one week first." },
      { status: 404 }
    );
  }

  const driverName = inWindow[0]?.driverName ?? "Driver";
  const weekBodies: string[] = [];
  for (const row of inWindow) {
    weekBodies.push(await buildWeekPdfBodyForSheet(prisma, row, row.id, todayStr, generatedAtLabel));
  }

  const html = renderRoadsideProduceDocumentHtml({
    driverName,
    fromYmd,
    toYmd: todayStr,
    generatedAtLabel,
    todayStr,
    weekBodies,
  });

  const pdfBytes = await buildRoadsideProducePdfBytes(prisma, inWindow, html, {
    driverName,
    fromYmd,
    toYmd: todayStr,
    todayStr,
    generatedAtLabel,
  });
  if (!pdfBytes) {
    return NextResponse.json(
      { error: "PDF generation failed. Try again or export each week from Settings." },
      { status: 503 }
    );
  }

  const timeStamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "");
  const safeName = driverName.replace(/[\s"\r\n\\]+/g, "-").replace(/[^\w\-.]/g, "") || "driver";
  const filename = `roadside-produce-${safeName}-${timeStamp}.pdf`;

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
