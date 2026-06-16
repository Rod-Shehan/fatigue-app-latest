/**
 * Shift lane cells aligned to 15-minute risk timeline blocks.
 * Before now: duty from logged events. After now: TPMA risk % per block (duty in tooltip).
 */

import type { ShiftLanePlanContext } from "@/lib/manager-shift-lane-plans";
import {
  blockOverlapsBreakDue,
  dutyFromSegmentsForBlock,
  sawtoothKindForBlockIndex,
} from "@/lib/manager-shift-lane-plans";
import {
  RISK_BLOCK_MINUTES,
  riskPercentToColor,
  type RiskTimelineBlock,
  findNowBlockStartMs,
} from "@/lib/manager-risk-timeline";
import {
  MINUTES_PER_DAY,
} from "@/lib/coverage/derive-minute-coverage";
import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";

const BLOCK_MS = RISK_BLOCK_MINUTES * 60 * 1000;

export type ShiftLaneKind = "work" | "break" | "non_work" | "idle";

export type ShiftLaneCell = {
  blockStartMs: number;
  kind: ShiftLaneKind;
  /** True when block is after the now line (projected, not attested). */
  generated: boolean;
  /** Run plan / manual plan label when projected from declared route. */
  planLabel?: string | null;
  /** Break was due/overdue in this block while still on work. */
  breakDue?: boolean;
  /** TPMA / timeline impairment % for projected blocks after now. */
  riskPct?: number;
};

export type TimelineEvent = { time: string; type: string };

/** Per-day minute grids (driver sheet / EventLogger) for blocks with no event overlap. */
export type ShiftLaneDayCoverage = {
  ymd: string;
  work_time: boolean[];
  breaks: boolean[];
  non_work: boolean[];
};

function dominantFromOverlapMs(overlapMs: Record<"work" | "break" | "non_work", number>): ShiftLaneKind | null {
  const total = overlapMs.work + overlapMs.break + overlapMs.non_work;
  if (total === 0) return null;
  if (overlapMs.work >= overlapMs.break && overlapMs.work >= overlapMs.non_work) return "work";
  if (overlapMs.break >= overlapMs.non_work) return "break";
  return "non_work";
}

export function dominantKindFromMinuteGrids(
  blockStartMs: number,
  sources: ShiftLaneDayCoverage[],
  nowMs: number
): ShiftLaneKind | null {
  const blockEnd = Math.min(blockStartMs + BLOCK_MS, nowMs);
  if (blockStartMs >= nowMs || blockEnd <= blockStartMs) return null;

  const overlapMs = { work: 0, break: 0, non_work: 0 };
  for (const src of sources) {
    const dayStart = new Date(`${src.ymd}T00:00:00`).getTime();
    for (let t = blockStartMs; t < blockEnd; t += 60_000) {
      const minute = Math.floor((t - dayStart) / 60_000);
      if (minute < 0 || minute >= MINUTES_PER_DAY) continue;
      if (src.work_time[minute]) overlapMs.work += 1;
      else if (src.breaks[minute]) overlapMs.break += 1;
      else if (src.non_work[minute]) overlapMs.non_work += 1;
    }
  }
  return dominantFromOverlapMs(overlapMs);
}

function resolveRecordedKind(
  blockStartMs: number,
  events: TimelineEvent[],
  dayCoverage: ShiftLaneDayCoverage[] | undefined,
  nowMs: number
): ShiftLaneKind {
  const fromEvents = recordedKindForBlock(blockStartMs, events, nowMs);
  if (fromEvents != null) return fromEvents;
  const fromCoverage = dayCoverage?.length
    ? dominantKindFromMinuteGrids(blockStartMs, dayCoverage, nowMs)
    : null;
  return fromCoverage ?? "non_work";
}

function eventTypeToKind(type: string): ShiftLaneKind | null {
  switch (type) {
    case "work":
      return "work";
    case "break":
      return "break";
    case "non_work":
    case "stop":
      return "non_work";
    default:
      return null;
  }
}

/** Dominant logged duty overlapping a block window (past only). */
export function recordedKindForBlock(
  blockStartMs: number,
  events: TimelineEvent[],
  nowMs: number
): ShiftLaneKind | null {
  const blockEnd = blockStartMs + BLOCK_MS;
  if (blockStartMs >= nowMs) return null;

  const sorted = [...events].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  const overlapMs: Record<ShiftLaneKind, number> = {
    work: 0,
    break: 0,
    non_work: 0,
    idle: 0,
  };

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    const kind = eventTypeToKind(ev.type);
    if (!kind) continue;

    const start = new Date(ev.time).getTime();
    const next = sorted[i + 1];
    const naturalEnd = next ? new Date(next.time).getTime() : nowMs;
    const segStart = Math.max(blockStartMs, start);
    const segEnd = Math.min(blockEnd, naturalEnd, nowMs);
    if (segStart >= segEnd) continue;

    overlapMs[kind] += segEnd - segStart;
  }

  const total = overlapMs.work + overlapMs.break + overlapMs.non_work;
  if (total === 0) return null;

  if (overlapMs.work >= overlapMs.break && overlapMs.work >= overlapMs.non_work) return "work";
  if (overlapMs.break >= overlapMs.non_work) return "break";
  return "non_work";
}

export function buildShiftLaneCells(
  blocks: RiskTimelineBlock[],
  events: TimelineEvent[],
  opts?: {
    nowMs?: number;
    planContext?: ShiftLanePlanContext;
    dayCoverage?: ShiftLaneDayCoverage[];
  }
): ShiftLaneCell[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const dayCoverage = opts?.dayCoverage;
  const segments = opts?.planContext?.segments ?? [];
  const breakDue = opts?.planContext?.breakDue ?? null;
  const nowBlock = findNowBlockStartMs(nowMs);
  const hasPlanSegments = segments.length > 0;

  return blocks.map((block, index) => {
    const generated = block.blockStartMs > nowBlock;

    if (generated) {
      const riskPct = block.baselinePct;
      if (hasPlanSegments) {
        const duty = dutyFromSegmentsForBlock(block.blockStartMs, segments);
        return {
          blockStartMs: block.blockStartMs,
          kind: duty.kind === "idle" ? "non_work" : duty.kind,
          generated: true,
          planLabel: duty.planLabel,
          riskPct,
        };
      }
      return {
        blockStartMs: block.blockStartMs,
        kind: sawtoothKindForBlockIndex(index),
        generated: true,
        planLabel: null,
        riskPct,
      };
    }

    const kind = resolveRecordedKind(block.blockStartMs, events, dayCoverage, nowMs);
    const breakDueOverlap =
      blockOverlapsBreakDue(block.blockStartMs, breakDue, nowMs) && kind === "work";

    return {
      blockStartMs: block.blockStartMs,
      kind,
      generated: false,
      breakDue: breakDueOverlap,
    };
  });
}

export function shiftLaneColor(
  kind: ShiftLaneKind,
  generated: boolean,
  breakDue?: boolean,
  riskPct?: number
): string {
  if (breakDue) return ACTIVITY_THEME.break.hex;

  if (generated && riskPct != null) {
    return riskPercentToColor(riskPct);
  }

  if (kind === "idle") {
    return generated ? "rgba(148, 163, 184, 0.35)" : "#94a3b8";
  }

  const themeKey: ActivityKey = kind;
  const { rgb } = ACTIVITY_THEME[themeKey];
  if (!generated) return ACTIVITY_THEME[themeKey].hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.42)`;
}

export function shiftLaneLabel(kind: ShiftLaneKind, breakDue?: boolean): string {
  if (breakDue) return "Break due";
  switch (kind) {
    case "work":
      return "Work";
    case "break":
      return "Break";
    case "non_work":
      return "Non-work";
    default:
      return "No log";
  }
}
