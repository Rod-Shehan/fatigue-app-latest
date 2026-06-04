import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";
import { buildRiskTimelineFromStoredBlocks, latestStoredBlockCamera } from "@/lib/risk-block-timeline";
import { findNowBlockStartMs } from "@/lib/manager-risk-timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/manager/risk-timeline?driverName=...&fromMs=...&toMs=...
 * Per-driver 15-minute risk timeline (camera + diary fusion). Assurance only.
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

  const nowBlock = findNowBlockStartMs();
  const blockMs = RISK_BLOCK_MINUTES * 60 * 1000;
  const defaultFrom = nowBlock - 32 * blockMs;
  const defaultTo = nowBlock + 12 * blockMs;

  const fromMs = Number(searchParams.get("fromMs") ?? defaultFrom);
  const toMs = Number(searchParams.get("toMs") ?? defaultTo);

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

    const series = buildRiskTimelineFromStoredBlocks(driverName, rows, {
      pastBlocks: 32,
      futureBlocks: 12,
    });

    const latestCamera = latestStoredBlockCamera(rows);

    return NextResponse.json({
      series,
      block_count: rows.length,
      latest_camera: latestCamera ?? null,
      disclaimer:
        "Assurance risk glance only — not compliance, not fleet average, not NHVR biomathematical FRMS.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
