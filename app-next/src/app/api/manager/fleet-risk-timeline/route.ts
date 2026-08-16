import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFrmsEngineMode } from "@/lib/frms/orchestrator";
import { resolveFleetRiskTimeline } from "@/lib/frms/fleet-risk-timeline";
import { getThisWeekSunday } from "@/lib/weeks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/manager/fleet-risk-timeline?weekStarting=...&driverNames=a,b
 * Fleet heatmap matrix — cached FRMS per driver; no inline batch recompute.
 */
export async function GET(request: NextRequest) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weekStarting = searchParams.get("weekStarting")?.trim() || getThisWeekSunday();
  const driverNamesParam = searchParams.get("driverNames")?.trim();
  const driverNames = driverNamesParam
    ? driverNamesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  try {
    const result = await resolveFleetRiskTimeline(prisma, {
      weekStarting,
      driverNames,
      userId: manager.user.id,
      tenantId: manager.user.tenantId,
    });

    if (!result) {
      return NextResponse.json({
        weekStarting,
        timezone: "Australia/Perth",
        fromMs: 0,
        toMs: 0,
        nowBlockStartMs: 0,
        columnLabels: [],
        drivers: [],
        all_drivers: [],
        fleet_summary: {
          total_in_scope: 0,
          actionable_count: 0,
          below_threshold_count: 0,
          action_threshold_pct: 55,
        },
        scoring_engine: "legacy" as const,
        frms_driver_count: 0,
        frms_engine_mode: getFrmsEngineMode(),
        disclaimer: "No drivers for this work week.",
      });
    }

    return NextResponse.json({
      ...result,
      frms_engine_mode: getFrmsEngineMode(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
