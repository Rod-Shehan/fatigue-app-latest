/**
 * Fleet-wide manager risk matrix from per-driver FRMS snapshots (or legacy blocks).
 */

import type { PrismaClient } from "@prisma/client";
import {
  defaultTimelineWindow,
  resolveFrmsRiskTimeline,
} from "@/lib/frms/risk-timeline";
import { isFrmsEngineEnabled, getFrmsEngineMode } from "@/lib/frms/orchestrator";
import {
  RISK_BLOCK_MINUTES,
  RISK_COLOR_THRESHOLDS,
  type RiskTimelineBlock,
} from "@/lib/manager-risk-timeline";
import { buildRiskTimelineFromStoredBlocks } from "@/lib/risk-block-timeline";
import { getThisWeekSunday } from "@/lib/weeks";

export const FLEET_RISK_MAX_DRIVERS = 20;

export type FleetRiskCell = {
  blockStartMs: number;
  label: string;
  pct: number;
  isNow?: boolean;
};

export type FleetDriverRiskRow = {
  driverName: string;
  scoring_engine: "frms" | "legacy";
  nowPct: number | null;
  peakNext24Pct: number | null;
  cells: FleetRiskCell[];
};

export type FleetRiskTimelineResult = {
  weekStarting: string;
  timezone: string;
  fromMs: number;
  toMs: number;
  nowBlockStartMs: number;
  columnLabels: string[];
  drivers: FleetDriverRiskRow[];
  scoring_engine: "frms" | "legacy" | "mixed";
  frms_driver_count: number;
  disclaimer: string;
};

function blockPct(block: RiskTimelineBlock): number {
  return block.livePct ?? block.baselinePct;
}

function summarizeRow(
  driverName: string,
  blocks: RiskTimelineBlock[],
  scoring_engine: "frms" | "legacy",
  nowBlock: number
): FleetDriverRiskRow {
  const horizonMs = nowBlock + 24 * 60 * 60 * 1000;
  let nowPct: number | null = null;
  let peakNext24Pct: number | null = null;

  const cells: FleetRiskCell[] = blocks.map((b) => {
    const pct = blockPct(b);
    if (b.isNow || b.blockStartMs === nowBlock) nowPct = pct;
    if (b.blockStartMs >= nowBlock && b.blockStartMs <= horizonMs) {
      peakNext24Pct = peakNext24Pct == null ? pct : Math.max(peakNext24Pct, pct);
    }
    return {
      blockStartMs: b.blockStartMs,
      label: b.label,
      pct,
      isNow: b.isNow ?? b.blockStartMs === nowBlock,
    };
  });

  return { driverName, scoring_engine, nowPct, peakNext24Pct, cells };
}

export async function loadFleetDriverNames(
  prisma: PrismaClient,
  weekStarting: string,
  requested?: string[]
): Promise<string[]> {
  if (requested?.length) {
    return [...new Set(requested.map((n) => n.trim()).filter(Boolean))].slice(0, FLEET_RISK_MAX_DRIVERS);
  }

  const sheets = await prisma.fatigueSheet.findMany({
    where: { weekStarting },
    select: { driverName: true, secondDriver: true },
  });

  const names = new Set<string>();
  for (const s of sheets) {
    if (s.driverName?.trim()) names.add(s.driverName.trim());
    if (s.secondDriver?.trim()) names.add(s.secondDriver.trim());
  }
  return [...names].sort((a, b) => a.localeCompare(b)).slice(0, FLEET_RISK_MAX_DRIVERS);
}

export async function resolveFleetRiskTimeline(
  prisma: PrismaClient,
  args: {
    weekStarting?: string;
    driverNames?: string[];
    userId?: string;
    nowMs?: number;
  }
): Promise<FleetRiskTimelineResult | null> {
  const weekStarting = args.weekStarting ?? getThisWeekSunday();
  const { fromMs, toMs, nowBlock } = defaultTimelineWindow(args.nowMs);
  const driverNames = await loadFleetDriverNames(prisma, weekStarting, args.driverNames);

  if (driverNames.length === 0) return null;

  const rows: FleetDriverRiskRow[] = [];
  let frmsCount = 0;

  for (const driverName of driverNames) {
    const storedBlocks = await prisma.driverRiskBlock.findMany({
      where: {
        driverName,
        blockStartMs: { gte: BigInt(fromMs), lte: BigInt(toMs) },
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

    let blocks: RiskTimelineBlock[] = [];
    let scoring_engine: "frms" | "legacy" = "legacy";

    if (isFrmsEngineEnabled()) {
      const frms = await resolveFrmsRiskTimeline(prisma, {
        driverName,
        fromMs,
        toMs,
        storedBlocks,
        weekStarting,
        userId: args.userId,
        nowMs: args.nowMs,
        allowSyncRecompute: false,
      });
      if (frms) {
        blocks = frms.series.blocks;
        scoring_engine = "frms";
        frmsCount += 1;
      }
    }

    if (blocks.length === 0) {
      blocks = buildRiskTimelineFromStoredBlocks(driverName, storedBlocks, {
        pastBlocks: 32,
        futureBlocks: 12,
      }).blocks;
    }

    rows.push(summarizeRow(driverName, blocks, scoring_engine, nowBlock));
  }

  rows.sort((a, b) => (b.peakNext24Pct ?? 0) - (a.peakNext24Pct ?? 0));

  const referenceCells = rows[0]?.cells ?? [];
  const columnLabels = referenceCells.map((c) => c.label);

  const scoring_engine: FleetRiskTimelineResult["scoring_engine"] =
    frmsCount === 0 ? "legacy" : frmsCount === rows.length ? "frms" : "mixed";

  return {
    weekStarting,
    timezone: "Australia/Perth",
    fromMs,
    toMs,
    nowBlockStartMs: nowBlock,
    columnLabels,
    drivers: rows,
    scoring_engine,
    frms_driver_count: frmsCount,
    disclaimer:
      scoring_engine !== "legacy"
        ? "TPMA fleet pulse — per-driver combined risk, not a fleet average or NHVR FRMSc certification."
        : "Fleet risk glance — diary-based assurance, not compliance or fleet average.",
  };
}

/** Pick column indices for axis labels (~6 ticks across the window). */
export function fleetHeatmapLabelIndices(columnCount: number): number[] {
  if (columnCount <= 6) return [...Array(columnCount).keys()];
  const step = Math.max(1, Math.floor(columnCount / 5));
  const indices: number[] = [];
  for (let i = 0; i < columnCount; i += step) indices.push(i);
  if (indices[indices.length - 1] !== columnCount - 1) indices.push(columnCount - 1);
  return indices;
}

export function fleetBlockMs(): number {
  return RISK_BLOCK_MINUTES * 60 * 1000;
}

export function pickHighestCurrentRiskDriver(
  drivers: { driverName: string; nowPct: number | null }[]
): string | null {
  if (drivers.length === 0) return null;
  const sorted = [...drivers].sort((a, b) => (b.nowPct ?? -1) - (a.nowPct ?? -1));
  return sorted[0]?.driverName ?? null;
}

export function findFleetNowIndex(cells: FleetRiskCell[], nowBlock: number): number {
  return cells.findIndex((c) => c.blockStartMs === nowBlock);
}

export type FleetPrioritySeverity = "critical" | "elevated" | "monitor" | "clear";

export type FleetPriorityItem = {
  driverName: string;
  nowPct: number | null;
  peakNext24Pct: number | null;
  reason: string;
  severity: FleetPrioritySeverity;
};

export function fleetPriorityReason(row: FleetDriverRiskRow): string {
  const now = row.nowPct ?? 0;
  const peak = row.peakNext24Pct ?? 0;
  if (now >= RISK_COLOR_THRESHOLDS.red) return "Critical fatigue now";
  if (now >= RISK_COLOR_THRESHOLDS.amber) return "Elevated fatigue now";
  if (peak >= RISK_COLOR_THRESHOLDS.red) return "Peak risk in next 24h";
  if (peak >= RISK_COLOR_THRESHOLDS.amber) return "Rising exposure next 24h";
  return "Steady — monitor plan";
}

export function fleetPrioritySeverity(row: FleetDriverRiskRow): FleetPrioritySeverity {
  const now = row.nowPct ?? 0;
  const peak = row.peakNext24Pct ?? 0;
  if (now >= RISK_COLOR_THRESHOLDS.red || peak >= RISK_COLOR_THRESHOLDS.red) return "critical";
  if (now >= RISK_COLOR_THRESHOLDS.amber || peak >= RISK_COLOR_THRESHOLDS.amber) return "elevated";
  if (now > 0 || peak > 0) return "monitor";
  return "clear";
}

/** Priority queue sorted by current block risk (manager action order). */
export function buildFleetPriorityQueue(drivers: FleetDriverRiskRow[]): FleetPriorityItem[] {
  return [...drivers]
    .sort((a, b) => (b.nowPct ?? -1) - (a.nowPct ?? -1))
    .map((row) => ({
      driverName: row.driverName,
      nowPct: row.nowPct,
      peakNext24Pct: row.peakNext24Pct,
      reason: fleetPriorityReason(row),
      severity: fleetPrioritySeverity(row),
    }));
}

export function fleetWorstNowDriver(
  drivers: FleetDriverRiskRow[]
): { driverName: string; nowPct: number } | null {
  const queue = buildFleetPriorityQueue(drivers);
  const top = queue[0];
  if (!top || top.nowPct == null) return null;
  return { driverName: top.driverName, nowPct: top.nowPct };
}

export function fleetElevatedNowCount(drivers: FleetDriverRiskRow[]): number {
  return drivers.filter((d) => (d.nowPct ?? 0) >= RISK_COLOR_THRESHOLDS.amber).length;
}
