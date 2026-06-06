/**
 * Build manager risk timeline series from FrmsRiskSnapshot rows (Phase 5).
 * Merges TPMA baseline with optional DriverRiskBlock camera overlay.
 */

import type { PrismaClient } from "@prisma/client";
import {
  findNowBlockStartMs,
  formatBlockLabelPerth,
  RISK_BLOCK_MINUTES,
  type RiskTimelineBlock,
  type RiskTimelineSeries,
} from "@/lib/manager-risk-timeline";
import {
  buildFrmsPayloadAndHash,
  enqueueFrmsRecompute,
  FRMS_ENGINE_VERSION,
  isFrmsEngineEnabled,
  loadDriverWeekMap,
  runFrmsAndPersist,
  type FrmsCacheStatus,
  type FrmsRunArgs,
} from "@/lib/frms/orchestrator";
import type { StoredRiskBlockRow } from "@/lib/risk-block-timeline";
import { getThisWeekSunday } from "@/lib/weeks";

export type FrmsSnapshotRow = {
  blockStartMs: bigint;
  combinedPct: number;
  processSPct: number | null;
  processCPct: number | null;
  band: string | null;
};

export type FrmsTimelineBuildResult = {
  series: RiskTimelineSeries;
  cacheStatus: FrmsCacheStatus;
  runId: string;
  snapshotCount: number;
};

/** Minimum snapshots required before preferring FRMS over legacy sawtooth. */
export const FRMS_TIMELINE_MIN_SNAPSHOTS = 12;

export function mergeFrmsSnapshotsWithLiveBlocks(
  driverName: string,
  snapshots: FrmsSnapshotRow[],
  storedBlocks: StoredRiskBlockRow[],
  opts: { nowMs?: number }
): RiskTimelineSeries {
  const nowBlock = findNowBlockStartMs(opts.nowMs);
  const liveByBlock = new Map<number, StoredRiskBlockRow>();
  for (const row of storedBlocks) {
    liveByBlock.set(Number(row.blockStartMs), row);
  }

  const blocks: RiskTimelineBlock[] = snapshots.map((snap) => {
    const ms = Number(snap.blockStartMs);
    const stored = liveByBlock.get(ms);
    const hasCamera = stored?.fusionSources.includes("camera") ?? false;
    const baselinePct = snap.combinedPct;
    let livePct: number | undefined;
    if (stored?.livePct != null) {
      livePct = stored.livePct;
    } else if (ms <= nowBlock) {
      livePct = snap.combinedPct;
    }

    return {
      blockStartMs: ms,
      label: formatBlockLabelPerth(ms),
      baselinePct,
      livePct,
      isNow: ms === nowBlock,
      hasCamera,
      fusionSources: stored?.fusionSources,
    };
  });

  return {
    driverName,
    timezone: "Australia/Perth",
    blocks,
    nowBlockStartMs: nowBlock,
  };
}

async function loadSnapshotsForRun(
  prisma: PrismaClient,
  runId: string,
  fromMs: number,
  toMs: number
): Promise<FrmsSnapshotRow[]> {
  return prisma.frmsRiskSnapshot.findMany({
    where: {
      runId,
      blockStartMs: { gte: BigInt(fromMs), lte: BigInt(toMs) },
    },
    orderBy: { blockStartMs: "asc" },
    select: {
      blockStartMs: true,
      combinedPct: true,
      processSPct: true,
      processCPct: true,
      band: true,
    },
  });
}

/**
 * Read path: serve cached FrmsRiskSnapshot series when available; enqueue recompute on miss/stale.
 */
export async function resolveFrmsRiskTimeline(
  prisma: PrismaClient,
  args: {
    driverName: string;
    fromMs: number;
    toMs: number;
    storedBlocks: StoredRiskBlockRow[];
    weekStarting?: string;
    userId?: string;
    nowMs?: number;
  }
): Promise<FrmsTimelineBuildResult | null> {
  if (!isFrmsEngineEnabled()) return null;

  const weekStarting = args.weekStarting ?? getThisWeekSunday();
  const weekMap = await loadDriverWeekMap(prisma, args.driverName);
  if (weekMap.size === 0) return null;

  const focusSheet =
    (await prisma.fatigueSheet.findFirst({
      where: { driverName: args.driverName, weekStarting },
      select: { jurisdictionCode: true, driverType: true },
    })) ??
    (await prisma.fatigueSheet.findFirst({
      where: { driverName: args.driverName },
      orderBy: { weekStarting: "desc" },
      select: { jurisdictionCode: true, driverType: true, weekStarting: true },
    }));

  if (!focusSheet) return null;

  const { inputHash } = buildFrmsPayloadAndHash({
    driverName: args.driverName,
    weekStarting,
    weekMap,
    jurisdictionCode: focusSheet.jurisdictionCode,
    driverType: focusSheet.driverType ?? "solo",
  });

  const tryBuild = async (
    runId: string,
    cacheStatus: FrmsCacheStatus
  ): Promise<FrmsTimelineBuildResult | null> => {
    const snapshots = await loadSnapshotsForRun(prisma, runId, args.fromMs, args.toMs);
    if (snapshots.length < FRMS_TIMELINE_MIN_SNAPSHOTS) return null;
    return {
      series: mergeFrmsSnapshotsWithLiveBlocks(args.driverName, snapshots, args.storedBlocks, {
        nowMs: args.nowMs,
      }),
      cacheStatus,
      runId,
      snapshotCount: snapshots.length,
    };
  };

  const exact = await prisma.frmsProfileRun.findFirst({
    where: {
      driverName: args.driverName,
      inputHash,
      engineVersion: FRMS_ENGINE_VERSION,
      status: "ready",
    },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });

  if (exact) {
    const built = await tryBuild(exact.id, "hit");
    if (built) return built;
  }

  const latest = await prisma.frmsProfileRun.findFirst({
    where: { driverName: args.driverName, status: "ready" },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });

  enqueueFrmsRecompute({
    driverName: args.driverName,
    weekStarting,
    userId: args.userId,
  });

  if (latest) {
    const cacheStatus: FrmsCacheStatus =
      exact && latest.id === exact.id ? "miss" : "stale";
    const built = await tryBuild(latest.id, cacheStatus);
    if (built) return built;
  }

  // Fire-and-forget enqueue often dies when the serverless function returns.
  // Run once inline so the first manager chart load can populate Neon + TPMA series.
  const runArgs: FrmsRunArgs = {
    driverName: args.driverName,
    weekStarting,
    weekMap,
    jurisdictionCode: focusSheet.jurisdictionCode,
    driverType: focusSheet.driverType ?? "solo",
    userId: args.userId,
  };

  try {
    await runFrmsAndPersist(prisma, runArgs);
    const fresh = await prisma.frmsProfileRun.findFirst({
      where: {
        driverName: args.driverName,
        inputHash,
        engineVersion: FRMS_ENGINE_VERSION,
        status: "ready",
      },
      orderBy: { completedAt: "desc" },
      select: { id: true },
    });
    if (fresh) {
      const built = await tryBuild(fresh.id, "hit");
      if (built) return built;
    }
  } catch (e) {
    console.error("FRMS sync recompute for timeline failed:", e);
  }

  return null;
}

export function defaultTimelineWindow(nowMs = Date.now()): {
  fromMs: number;
  toMs: number;
  nowBlock: number;
} {
  const nowBlock = findNowBlockStartMs(nowMs);
  const blockMs = RISK_BLOCK_MINUTES * 60 * 1000;
  return {
    fromMs: nowBlock - 32 * blockMs,
    toMs: nowBlock + 12 * blockMs,
    nowBlock,
  };
}
