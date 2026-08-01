import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildChecklistPackJsPdfBuffer,
  checklistPdfFilename,
  collectChecklistPdfDays,
  CHECKLIST_PDF_TYPE_TITLE,
} from "@/lib/checklist/checklist-pdf";
import {
  isChecklistRecordType,
  type ChecklistRecord,
  type ChecklistRecordType,
} from "@/lib/checklist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — dedicated checklist PDF: one type for one driver week (default).
 * Query: type=ffw|prestart|dimension_load (required)
 *        dayIndex=0..6 optional (omit = whole week for that type)
 * Never part of fatigue roadside produce (H2). Types are not combined (different regs).
 */
export async function GET(
  req: Request,
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

    let days: Array<{ checklists?: ChecklistRecord[] }> = [];
    try {
      const parsed = row.days ? JSON.parse(row.days) : [];
      days = Array.isArray(parsed) ? parsed : [];
    } catch {
      days = [];
    }

    const url = new URL(req.url);
    const typeRaw = url.searchParams.get("type");
    if (!isChecklistRecordType(typeRaw)) {
      return NextResponse.json(
        { error: "type is required: ffw | prestart | dimension_load" },
        { status: 400 }
      );
    }
    const type = typeRaw as ChecklistRecordType;

    const dayRaw = url.searchParams.get("dayIndex");
    let dayIndex: number | null = null;
    if (dayRaw != null && dayRaw !== "") {
      const n = Number(dayRaw);
      if (!Number.isInteger(n) || n < 0 || n > 6) {
        return NextResponse.json({ error: "dayIndex must be 0–6" }, { status: 400 });
      }
      dayIndex = n;
    }

    const bundles = collectChecklistPdfDays({
      weekStarting: row.weekStarting,
      days,
      type,
      dayIndex,
    });

    if (!bundles.length) {
      return NextResponse.json(
        {
          error: `No completed ${CHECKLIST_PDF_TYPE_TITLE[type]} records for this selection`,
        },
        { status: 404 }
      );
    }

    const generatedAtLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" });

    const pdfBytes = await buildChecklistPackJsPdfBuffer({
      driverName: row.driverName,
      weekStarting: row.weekStarting,
      days: bundles,
      generatedAtLabel,
      type,
    });

    const filename = checklistPdfFilename({
      driverName: row.driverName,
      weekStarting: row.weekStarting,
      type,
      dayIndex,
    });

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[checklists/export]", e);
    return NextResponse.json({ error: "Failed to build checklist PDF" }, { status: 500 });
  }
}
