import { NextResponse } from "next/server";
import { canAccessSheet, getSessionForSheetAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadComplianceWeekContext, COMPLIANCE_PRIOR_WEEKS_LOOKBACK } from "@/lib/compliance-history";
import { getRecordRetentionPolicy } from "@/lib/record-retention";
import { normalizeSheetDaysForApi } from "@/lib/coverage/derive-minute-coverage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const sheet = await prisma.fatigueSheet.findUnique({
      where: { id },
      select: { id: true, driverName: true, weekStarting: true, createdById: true },
    });
    if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canAccessSheet(sheet, access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ctx = await loadComplianceWeekContext(prisma, sheet.driverName, sheet.weekStarting);

    return NextResponse.json({
      prev_week_starting: ctx.prevWeekStarting ?? null,
      prev_week_days: ctx.prevWeekDays ? normalizeSheetDaysForApi(ctx.prevWeekDays) : null,
      history_days: normalizeSheetDaysForApi(ctx.historyDays),
      lookback_weeks: COMPLIANCE_PRIOR_WEEKS_LOOKBACK,
      policy: getRecordRetentionPolicy(),
    });
  } catch (e) {
    console.error("compliance-history error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
