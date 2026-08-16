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
  type RiskTimelineBlock,
} from "@/lib/manager-risk-timeline";
import { buildRiskTimelineFromStoredBlocks } from "@/lib/risk-block-timeline";
import { getThisWeekSunday } from "@/lib/weeks";

/** Safety cap for scoring workload per request (not a display limit). */
export const FLEET_SCORE_MAX_DRIVERS = 80;

/** TPMA elevated band floor — matches frms-engine `_risk_band()` (55–74% elevated). */
export const FLEET_ACTION_THRESHOLD_PCT = 55;

/** TPMA critical band floor — matches frms-engine `_risk_band()` (≥75% critical). */
export const FLEET_CRITICAL_THRESHOLD_PCT = 75;

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

export type FleetRiskSummary = {
  total_in_scope: number;
  actionable_count: number;
  below_threshold_count: number;
  action_threshold_pct: number;
};

export type FleetRiskTimelineResult = {
  weekStarting: string;
  timezone: string;
  fromMs: number;
  toMs: number;
  nowBlockStartMs: number;
  columnLabels: string[];
  /** Drivers above action threshold — heatmap + priority queue. */
  drivers: FleetDriverRiskRow[];
  /** Full scoped fleet for auto-chart and KPI denominators. */
  all_drivers: FleetDriverRiskRow[];
  fleet_summary: FleetRiskSummary;
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
  tenantId: string,
  requested?: string[]
): Promise<string[]> {
  if (requested?.length) {
    return [...new Set(requested.map((n) => n.trim()).filter(Boolean))].slice(
      0,
      FLEET_SCORE_MAX_DRIVERS
    );
  }

  const sheets = await prisma.fatigueSheet.findMany({
    where: { tenantId, weekStarting },
    select: { driverName: true, secondDriver: true },
  });

  const names = new Set<string>();
  for (const s of sheets) {
    if (s.driverName?.trim()) names.add(s.driverName.trim());
    if (s.secondDriver?.trim()) names.add(s.secondDriver.trim());
  }
  return [...names].sort((a, b) => a.localeCompare(b)).slice(0, FLEET_SCORE_MAX_DRIVERS);
}

/** True when current or next-24h peak risk warrants manager attention. */
export function fleetDriverNeedsManagerAttention(row: FleetDriverRiskRow): boolean {
  const now = row.nowPct ?? 0;
  const peak = row.peakNext24Pct ?? 0;
  return now >= FLEET_ACTION_THRESHOLD_PCT || peak >= FLEET_ACTION_THRESHOLD_PCT;
}

export function partitionFleetDrivers(rows: FleetDriverRiskRow[]): {
  actionable: FleetDriverRiskRow[];
  belowThreshold: FleetDriverRiskRow[];
  summary: FleetRiskSummary;
} {
  const actionable = rows.filter(fleetDriverNeedsManagerAttention);
  const belowThreshold = rows.filter((r) => !fleetDriverNeedsManagerAttention(r));
  return {
    actionable,
    belowThreshold,
    summary: {
      total_in_scope: rows.length,
      actionable_count: actionable.length,
      below_threshold_count: belowThreshold.length,
      action_threshold_pct: FLEET_ACTION_THRESHOLD_PCT,
    },
  };
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

export async function resolveFleetRiskTimeline(
  prisma: PrismaClient,
  args: {
    weekStarting?: string;
    driverNames?: string[];
    userId?: string;
    tenantId: string;
    nowMs?: number;
  }
): Promise<FleetRiskTimelineResult | null> {
  const weekStarting = args.weekStarting ?? getThisWeekSunday();
  const { fromMs, toMs, nowBlock } = defaultTimelineWindow(args.nowMs);
  const driverNames = await loadFleetDriverNames(prisma, weekStarting, args.tenantId, args.driverNames);

  if (driverNames.length === 0) return null;

  let frmsCount = 0;

  const rows = await mapInBatches(driverNames, 6, async (driverName) => {
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
        tenantId: args.tenantId,
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

    return summarizeRow(driverName, blocks, scoring_engine, nowBlock);
  });

  const sortByExposure = (a: FleetDriverRiskRow, b: FleetDriverRiskRow) => {
    const aKey = Math.max(a.nowPct ?? 0, a.peakNext24Pct ?? 0);
    const bKey = Math.max(b.nowPct ?? 0, b.peakNext24Pct ?? 0);
    return bKey - aKey;
  };

  const allDrivers = [...rows].sort(sortByExposure);
  const { actionable, summary } = partitionFleetDrivers(allDrivers);
  const actionableSorted = [...actionable].sort(sortByExposure);

  const referenceCells = allDrivers[0]?.cells ?? [];
  const columnLabels = referenceCells.map((c) => c.label);

  const scoring_engine: FleetRiskTimelineResult["scoring_engine"] =
    frmsCount === 0 ? "legacy" : frmsCount === allDrivers.length ? "frms" : "mixed";

  const thresholdNote = `Showing drivers at or above ${FLEET_ACTION_THRESHOLD_PCT}% combined risk (now or next 24h).`;

  return {
    weekStarting,
    timezone: "Australia/Perth",
    fromMs,
    toMs,
    nowBlockStartMs: nowBlock,
    columnLabels,
    drivers: actionableSorted,
    all_drivers: allDrivers,
    fleet_summary: summary,
    scoring_engine,
    frms_driver_count: frmsCount,
    disclaimer:
      scoring_engine !== "legacy"
        ? `TPMA fleet pulse — ${thresholdNote} Not a fleet average or NHVR FRMSc certification.`
        : `Fleet risk glance — ${thresholdNote} Diary-based assurance, not compliance.`,
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
  if (now >= FLEET_CRITICAL_THRESHOLD_PCT) return "Critical fatigue now";
  if (now >= FLEET_ACTION_THRESHOLD_PCT) return "Elevated fatigue now";
  if (peak >= FLEET_CRITICAL_THRESHOLD_PCT) return "Peak risk in next 24h";
  if (peak >= FLEET_ACTION_THRESHOLD_PCT) return "Rising exposure next 24h";
  return "Steady — monitor plan";
}

export function fleetPrioritySeverity(row: FleetDriverRiskRow): FleetPrioritySeverity {
  const now = row.nowPct ?? 0;
  const peak = row.peakNext24Pct ?? 0;
  if (now >= FLEET_CRITICAL_THRESHOLD_PCT || peak >= FLEET_CRITICAL_THRESHOLD_PCT) return "critical";
  if (now >= FLEET_ACTION_THRESHOLD_PCT || peak >= FLEET_ACTION_THRESHOLD_PCT) return "elevated";
  if (now > 0 || peak > 0) return "monitor";
  return "clear";
}

/** Priority queue — actionable drivers only, sorted by current block risk. */
export function buildFleetPriorityQueue(drivers: FleetDriverRiskRow[]): FleetPriorityItem[] {
  return [...drivers]
    .filter(fleetDriverNeedsManagerAttention)
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
  if (drivers.length === 0) return null;
  const sorted = [...drivers].sort((a, b) => (b.nowPct ?? -1) - (a.nowPct ?? -1));
  const top = sorted[0];
  if (!top || top.nowPct == null) return null;
  return { driverName: top.driverName, nowPct: top.nowPct };
}

export function fleetElevatedNowCount(drivers: FleetDriverRiskRow[]): number {
  return drivers.filter((d) => (d.nowPct ?? 0) >= FLEET_ACTION_THRESHOLD_PCT).length;
}

export function fleetActionableCount(drivers: FleetDriverRiskRow[]): number {
  return drivers.filter(fleetDriverNeedsManagerAttention).length;
}
