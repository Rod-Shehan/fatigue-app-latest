import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFrmsEngineEnabled, getFrmsEngineMode } from "@/lib/frms/orchestrator";
import { defaultTimelineWindow, resolveFrmsRiskTimeline } from "@/lib/frms/risk-timeline";
import {
  buildRiskTimelineFromStoredBlocks,
  latestStoredBlockCamera,
} from "@/lib/risk-block-timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/manager/risk-timeline?driverName=...&fromMs=...&toMs=...&weekStarting=...
 * Per-driver 15-minute risk timeline. FRMS TPMA when enabled and cached; legacy sawtooth fallback.
 */
export async function GET(request: NextRequest) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const driverName = searchParams.get("driverName")?.trim();
  if (!driverName) {
    return NextResponse.json({ error: "driverName required" }, { status: 400 });
  }

  const defaults = defaultTimelineWindow();
  const fromMs = Number(searchParams.get("fromMs") ?? defaults.fromMs);
  const toMs = Number(searchParams.get("toMs") ?? defaults.toMs);
  const weekStarting = searchParams.get("weekStarting")?.trim() || undefined;

  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return NextResponse.json({ error: "fromMs and toMs must be numbers" }, { status: 400 });
  }

  try {
    const rows = await prisma.driverRiskBlock.findMany({
      where: {
        driverName,
        blockStartMs: {
          gte: BigInt(fromMs),
          lte: BigInt(toMs),
        },
      },
      orderBy: { blockStartMs: "asc" },
      select: {
        blockStartMs: true,
        baselinePct: true,
        livePct: true,
        fusionSources: true,
        cameraPayload: true,
        diaryContext: true,
      },
    });

    let frmsResult = null as Awaited<ReturnType<typeof resolveFrmsRiskTimeline>>;

    if (isFrmsEngineEnabled()) {
      frmsResult = await resolveFrmsRiskTimeline(prisma, {
        driverName,
        tenantId: manager.user.tenantId,
        fromMs,
        toMs,
        storedBlocks: rows,
        weekStarting,
        userId: manager.user.id,
      });
    }

    const series =
      frmsResult?.series ??
      buildRiskTimelineFromStoredBlocks(driverName, rows, {
        pastBlocks: 32,
        futureBlocks: 12,
      });

    const scoring_engine: "frms" | "legacy" = frmsResult ? "frms" : "legacy";
    const frms_cache_status = frmsResult?.cacheStatus ?? null;
    const frms_run_id = frmsResult?.runId ?? null;
    const snapshot_count = frmsResult?.snapshotCount ?? 0;

    const latestCamera = latestStoredBlockCamera(rows);

    return NextResponse.json({
      series,
      block_count: rows.length,
      snapshot_count,
      latest_camera: latestCamera ?? null,
      scoring_engine,
      frms_engine_mode: getFrmsEngineMode(),
      frms_cache_status,
      frms_run_id,
      disclaimer:
        scoring_engine === "frms"
          ? "TPMA FRMS glance only — assurance and coaching, not compliance, fleet average, or NHVR FRMSc certification."
          : "Assurance risk glance only — not compliance, not fleet average, not NHVR biomathematical FRMS.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
