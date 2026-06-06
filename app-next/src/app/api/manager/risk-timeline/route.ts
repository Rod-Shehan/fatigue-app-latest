import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFrmsEngineEnabled } from "@/lib/frms/orchestrator";
import { defaultTimelineWindow, resolveFrmsRiskTimeline } from "@/lib/frms/risk-timeline";
import type { RiskTimelineSeries } from "@/lib/manager-risk-timeline";
import {
  buildRiskTimelineFromStoredBlocks,
  latestStoredBlockCamera,
} from "@/lib/risk-block-timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    let scoring_engine: "frms" | "legacy" = "legacy";
    let frms_cache_status: string | null = null;
    let frms_run_id: string | null = null;
    let snapshot_count = 0;
    let series: RiskTimelineSeries;

    if (isFrmsEngineEnabled()) {
      const frms = await resolveFrmsRiskTimeline(prisma, {
        driverName,
        fromMs,
        toMs,
        storedBlocks: rows,
        weekStarting,
        userId: manager.user.id,
      });

      if (frms) {
        series = frms.series;
        scoring_engine = "frms";
        frms_cache_status = frms.cacheStatus;
        frms_run_id = frms.runId;
        snapshot_count = frms.snapshotCount;
      }
    }

    if (!series) {
      series = buildRiskTimelineFromStoredBlocks(driverName, rows, {
        pastBlocks: 32,
        futureBlocks: 12,
      });
    }

    const latestCamera = latestStoredBlockCamera(rows);

    return NextResponse.json({
      series,
      block_count: rows.length,
      snapshot_count,
      latest_camera: latestCamera ?? null,
      scoring_engine,
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
