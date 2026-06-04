/**
 * Manager risk timeline — 15-minute blocks, 0–100% glance score (prospective assurance).
 * Not compliance. Not fleet aggregate. Wired for demo now; API adapter later.
 *
 * Score mapping uses a composite latent index → z-score → logistic CDF to [0, 100].
 */

export const RISK_BLOCK_MINUTES = 15;
export const RISK_PCT_MIN = 0;
export const RISK_PCT_MAX = 100;

/** Logistic steepness (β) and centre (ζ); tune μ/σ per domain later. */
export const RISK_LOGISTIC_BETA = 1.35;
export const RISK_LOGISTIC_ZETA = 0;

export const RISK_COLOR_THRESHOLDS = {
  amber: 45,
  red: 70,
} as const;

export type RiskTimelineBlock = {
  /** Block start, UTC ms, aligned to 15 minutes. */
  blockStartMs: number;
  /** Short label for axis (Perth HH:mm). */
  label: string;
  /** Expected trajectory (plan / smoothed prior). */
  baselinePct: number;
  /** Observed risk at this block — undefined until the block is received. */
  livePct?: number;
  /** True for the block containing regulatory "now". */
  isNow?: boolean;
  /** Whether camera data contributed to live score. */
  hasCamera?: boolean;
  fusionSources?: string[];
};

export type RiskTimelineSeries = {
  driverName: string;
  timezone: string;
  blocks: RiskTimelineBlock[];
  nowBlockStartMs: number;
};

import type { CameraBlockFeatures } from "@/lib/camera-risk-packet";

export type RiskTimelineBlockInput = {
  blockStartMs: number;
  /** Minutes of work in this 15-min window (0–15). */
  workMinutes: number;
  /** Minutes since last qualifying break at block end. */
  minutesSinceBreak: number;
  /** Rolling work hours in prior 14 days (proxy). */
  rollingWorkHours14d: number;
  /** Local hour 0–23.8 for circadian pressure. */
  localHour: number;
  /** Plan deviation: extra work vs baseline expectation in this block. */
  planDeviationMinutes: number;
  /** Cab camera features for this block (optional until device connected). */
  camera?: CameraBlockFeatures;
};

export type QueuedLiveBlock = {
  blockStartMs: number;
  livePct: number;
};

/** Standard score: z = (x − μ) / σ with σ floored for stability. */
export function standardize(value: number, mean: number, stdDev: number): number {
  const sigma = Math.max(stdDev, 1e-6);
  return (value - mean) / sigma;
}

/** Logistic map to percentile: P = 100 / (1 + exp(−β(z − ζ))). */
export function logisticRiskPercentile(z: number): number {
  const p = 100 / (1 + Math.exp(-RISK_LOGISTIC_BETA * (z - RISK_LOGISTIC_ZETA)));
  return Math.round(Math.min(RISK_PCT_MAX, Math.max(RISK_PCT_MIN, p)));
}

/** Camera-derived contribution 0–1 (coverage-weighted). */
export function cameraFatigueContribution(camera?: CameraBlockFeatures): number {
  if (!camera) return 0;
  const coverage = camera.sampleCoveragePct / 100;
  if (coverage <= 0) return 0;
  const eyesOff = Math.min(1, camera.eyesOffRoadSeconds / (RISK_BLOCK_MINUTES * 60));
  const events = Math.min(1, (camera.yawnCount + camera.headNodCount) / 8);
  const model =
    0.45 * camera.drowsinessScore +
    0.3 * camera.distractionScore +
    0.15 * eyesOff +
    0.1 * events;
  return coverage * Math.min(1, model);
}

/**
 * Composite latent fatigue index (demo / v1).
 * Weights align with IEC 31010 semi-quantitative factors; coefficients tunable.
 * When camera present, diary weights shrink slightly so streams fuse without double-counting.
 */
export function compositeFatigueIndex(input: RiskTimelineBlockInput): number {
  const circadian =
    0.55 * Math.sin(((input.localHour - 6) / 24) * 2 * Math.PI) +
    0.35 * Math.max(0, Math.sin(((input.localHour - 1) / 12) * Math.PI));
  const workLoad = input.workMinutes / RISK_BLOCK_MINUTES;
  const breakDebt = Math.min(1, input.minutesSinceBreak / 300);
  const accumulation = Math.min(1, input.rollingWorkHours14d / 168);
  const deviation = Math.min(1, Math.max(0, input.planDeviationMinutes / RISK_BLOCK_MINUTES));
  const cameraTerm = cameraFatigueContribution(input.camera);

  if (input.camera && cameraTerm > 0) {
    return (
      0.22 * circadian +
      0.18 * workLoad +
      0.2 * breakDebt +
      0.14 * accumulation +
      0.06 * deviation +
      0.2 * cameraTerm
    );
  }

  return (
    0.28 * circadian +
    0.22 * workLoad +
    0.24 * breakDebt +
    0.18 * accumulation +
    0.08 * deviation
  );
}

/** Map block inputs to 0–100% using composite → z → logistic. */
export function blockInputsToRiskPercent(
  input: RiskTimelineBlockInput,
  stats = DEFAULT_RISK_INDEX_STATS
): number {
  const raw = compositeFatigueIndex(input);
  const z = standardize(raw, stats.mean, stats.stdDev);
  return logisticRiskPercentile(z);
}

export const DEFAULT_RISK_INDEX_STATS = { mean: 0.42, stdDev: 0.18 };

export function riskPercentToColor(pct: number): string {
  if (pct >= RISK_COLOR_THRESHOLDS.red) return "#dc2626";
  if (pct >= RISK_COLOR_THRESHOLDS.amber) return "#d97706";
  return "#16a34a";
}

export function alignToBlockStartMs(ms: number, blockMinutes = RISK_BLOCK_MINUTES): number {
  const blockMs = blockMinutes * 60 * 1000;
  return Math.floor(ms / blockMs) * blockMs;
}

export function formatBlockLabelPerth(blockStartMs: number): string {
  return new Date(blockStartMs).toLocaleTimeString("en-AU", {
    timeZone: "Australia/Perth",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function findNowBlockStartMs(nowMs = Date.now()): number {
  return alignToBlockStartMs(nowMs);
}

/** Merge queued live readings into series (sorted, deduped by blockStartMs). */
export function applyQueuedLiveBlocks(
  blocks: RiskTimelineBlock[],
  queue: QueuedLiveBlock[]
): RiskTimelineBlock[] {
  if (queue.length === 0) return blocks;
  const byStart = new Map(blocks.map((b) => [b.blockStartMs, { ...b }]));
  const sorted = [...queue].sort((a, b) => a.blockStartMs - b.blockStartMs);
  for (const item of sorted) {
    const existing = byStart.get(item.blockStartMs);
    if (existing) {
      existing.livePct = item.livePct;
    } else {
      byStart.set(item.blockStartMs, {
        blockStartMs: item.blockStartMs,
        label: formatBlockLabelPerth(item.blockStartMs),
        baselinePct: 0,
        livePct: item.livePct,
      });
    }
  }
  return [...byStart.values()].sort((a, b) => a.blockStartMs - b.blockStartMs);
}

export type CrossoverInterval = { startMs: number; endMs: number };

/** Intervals where live risk exceeds baseline (both defined). */
export function findCrossoverIntervals(blocks: RiskTimelineBlock[]): CrossoverInterval[] {
  const intervals: CrossoverInterval[] = [];
  let open: number | null = null;
  for (const b of blocks) {
    if (b.livePct == null) continue;
    const over = b.livePct > b.baselinePct;
    if (over && open == null) open = b.blockStartMs;
    if (!over && open != null) {
      intervals.push({ startMs: open, endMs: b.blockStartMs });
      open = null;
    }
  }
  if (open != null) {
    const last = blocks[blocks.length - 1];
    intervals.push({ startMs: open, endMs: last.blockStartMs + RISK_BLOCK_MINUTES * 60 * 1000 });
  }
  return intervals;
}

export function synthesizeRiskNarrative(
  block: RiskTimelineBlock,
  opts?: { driverName?: string; camera?: CameraBlockFeatures }
): string {
  const live = block.livePct;
  if (live == null) {
    return `Waiting for the ${block.label} block — live risk will appear when data arrives.`;
  }
  const variance = live - block.baselinePct;
  const driver = opts?.driverName ? `${opts.driverName}: ` : "";
  const cameraNote =
    block.hasCamera && opts?.camera
      ? ` Camera stream: drowsiness ${Math.round(opts.camera.drowsinessScore * 100)}%, distraction ${Math.round(opts.camera.distractionScore * 100)}%, coverage ${Math.round(opts.camera.sampleCoveragePct)}%.`
      : block.hasCamera
        ? " Camera data included in this block."
        : "";
  if (variance <= 2) {
    return `${driver}At ${block.label}, fatigue risk is ${live}% — in line with the expected ${block.baselinePct}% for this part of the shift.${cameraNote}`;
  }
  const severity =
    live >= RISK_COLOR_THRESHOLDS.red
      ? "elevated"
      : live >= RISK_COLOR_THRESHOLDS.amber
        ? "raised"
        : "slightly raised";
  return `${driver}At ${block.label}, live fatigue risk is ${live}% (${severity}) — ${variance} points above the ${block.baselinePct}% baseline.${cameraNote} A brief check-in may help before load accumulates.`;
}

/** Demo series: past + future blocks; live filled through "now" only initially. */
export function buildDemoRiskTimelineSeries(
  driverName: string,
  opts?: { pastBlocks?: number; futureBlocks?: number; nowMs?: number }
): RiskTimelineSeries {
  const nowMs = opts?.nowMs ?? Date.now();
  const nowBlock = findNowBlockStartMs(nowMs);
  const blockMs = RISK_BLOCK_MINUTES * 60 * 1000;
  const past = opts?.pastBlocks ?? 32;
  const future = opts?.futureBlocks ?? 12;
  const startMs = nowBlock - past * blockMs;

  const blocks: RiskTimelineBlock[] = [];
  for (let i = 0; i <= past + future; i++) {
    const blockStartMs = startMs + i * blockMs;
    const localHour =
      Number(
        new Date(blockStartMs).toLocaleString("en-AU", {
          timeZone: "Australia/Perth",
          hour: "numeric",
          hour12: false,
        })
      ) +
      Number(
        new Date(blockStartMs).toLocaleString("en-AU", {
          timeZone: "Australia/Perth",
          minute: "numeric",
        })
      ) /
        60;

    const t = i / (past + future);
    const workMinutes = blockStartMs <= nowBlock ? 8 + Math.round(7 * Math.sin(t * Math.PI)) : 0;
    const minutesSinceBreak = blockStartMs <= nowBlock ? 40 + i * 8 : 0;
    const rollingWorkHours14d = 118 + t * 28;
    const planDeviation = blockStartMs <= nowBlock ? Math.max(0, (i % 5) - 2) * 3 : 0;

    const input: RiskTimelineBlockInput = {
      blockStartMs,
      workMinutes,
      minutesSinceBreak,
      rollingWorkHours14d,
      localHour,
      planDeviationMinutes: Math.max(0, planDeviation - 1),
    };

    const baselineInput: RiskTimelineBlockInput = {
      ...input,
      planDeviationMinutes: 0,
      workMinutes: Math.max(0, workMinutes - 2),
    };

    const baselinePct = blockInputsToRiskPercent(baselineInput);
    const livePct = blockStartMs <= nowBlock ? blockInputsToRiskPercent(input) : undefined;

    blocks.push({
      blockStartMs,
      label: formatBlockLabelPerth(blockStartMs),
      baselinePct,
      livePct,
      isNow: blockStartMs === nowBlock,
    });
  }

  return {
    driverName,
    timezone: "Australia/Perth",
    blocks,
    nowBlockStartMs: nowBlock,
  };
}

/** Next demo blocks to simulate arrival (after now). */
export function nextDemoLiveBlocks(
  series: RiskTimelineSeries,
  count: number
): QueuedLiveBlock[] {
  const blockMs = RISK_BLOCK_MINUTES * 60 * 1000;
  const pending = series.blocks.filter(
    (b) => b.blockStartMs > series.nowBlockStartMs && b.livePct == null
  );
  return pending.slice(0, count).map((b, idx) => {
    const input: RiskTimelineBlockInput = {
      blockStartMs: b.blockStartMs,
      workMinutes: 10 + idx,
      minutesSinceBreak: 60 + idx * 12,
      rollingWorkHours14d: 125 + idx * 2,
      localHour: 14 + idx * 0.25,
      planDeviationMinutes: idx * 2,
    };
    return { blockStartMs: b.blockStartMs, livePct: blockInputsToRiskPercent(input) };
  });
}

/** Adapter hook point for live API (future). */
export type RiskTimelineDataSource =
  | { mode: "demo"; series: RiskTimelineSeries }
  | { mode: "api"; driverName: string; fromMs: number; toMs: number };
