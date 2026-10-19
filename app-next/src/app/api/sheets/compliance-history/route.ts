import { NextResponse } from "next/server";
import { getSessionForSheetAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadComplianceWeekContext, COMPLIANCE_PRIOR_WEEKS_LOOKBACK } from "@/lib/compliance-history";
import { getRecordRetentionPolicy } from "@/lib/record-retention";
import { normalizeSheetDaysForApi } from "@/lib/coverage/derive-minute-coverage";
import { normalizeWeekDateString } from "@/lib/weeks";

/** Full prior-week tape for the signed-in driver (used when this week is still local-*). */
export async function GET(req: Request) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weekStarting = new URL(req.url).searchParams.get("weekStarting")?.trim() ?? "";
  const week = weekStarting ? normalizeWeekDateString(weekStarting) : "";
  if (!week) {
    return NextResponse.json({ error: "weekStarting required" }, { status: 400 });
  }

  const rawName = access.session.user?.name?.trim() || access.session.user?.email?.trim() || "";
  const driverName = rawName.includes("@") ? rawName.split("@")[0] || "" : rawName;
  if (!driverName) {
    return NextResponse.json({ error: "Driver name required" }, { status: 400 });
  }

  try {
    const ctx = await loadComplianceWeekContext(prisma, access.tenantId, driverName, week);
    return NextResponse.json({
      prev_week_starting: ctx.prevWeekStarting ?? null,
      prev_week_days: ctx.prevWeekDays ? normalizeSheetDaysForApi(ctx.prevWeekDays) : null,
      history_days: normalizeSheetDaysForApi(ctx.historyDays),
      lookback_weeks: COMPLIANCE_PRIOR_WEEKS_LOOKBACK,
      policy: getRecordRetentionPolicy(),
    });
  } catch (e) {
    console.error("compliance-history-by-week error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
