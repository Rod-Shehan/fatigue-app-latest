import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildChecklistPackJsPdfBuffer,
  collectChecklistPdfDays,
} from "@/lib/checklist/checklist-pdf";
import type { ChecklistRecord } from "@/lib/checklist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — dedicated checklist PDF for a week (or one day).
 * Query: dayIndex=0..6 optional. Never part of fatigue roadside produce (H2).
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
      dayIndex,
    });

    if (!bundles.length) {
      return NextResponse.json(
        { error: "No completed checklist records for this selection" },
        { status: 404 }
      );
    }

    const generatedAtLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" });

    const pdfBytes = await buildChecklistPackJsPdfBuffer({
      driverName: row.driverName,
      weekStarting: row.weekStarting,
      days: bundles,
      generatedAtLabel,
    });

    const safeName = (row.driverName || "driver").replace(/[^\w\-]+/g, "_").slice(0, 40);
    const daySuffix = dayIndex != null ? `-day${dayIndex}` : "-week";
    const filename = `checklist-pack-${safeName}-${row.weekStarting}${daySuffix}.pdf`;

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
