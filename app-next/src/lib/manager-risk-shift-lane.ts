/**
 * Shift lane cells aligned to 15-minute risk timeline blocks.
 * Before now: duty from logged events. After now: declared run plan / manual km·hours, else demo walk.
 */

import { demoBlockEventForIndex, type FatigueCarryBlockEvent } from "@/lib/fatigue-risk-carry";
import type { ShiftWorkProjection } from "@/lib/manager-shift-lane-plans";
import {
  projectedKindFromPlans,
  projectionLabelForBlock,
} from "@/lib/manager-shift-lane-plans";
import {
  RISK_BLOCK_MINUTES,
  type RiskTimelineBlock,
  findNowBlockStartMs,
} from "@/lib/manager-risk-timeline";
import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";

const BLOCK_MS = RISK_BLOCK_MINUTES * 60 * 1000;

export type ShiftLaneKind = "work" | "break" | "non_work" | "idle";

export type ShiftLaneCell = {
  blockStartMs: number;
  kind: ShiftLaneKind;
  /** True when block is at or after the now line (projected, not attested). */
  generated: boolean;
  /** Run plan / manual plan label when projected from declared route. */
  planLabel?: string | null;
};

export type TimelineEvent = { time: string; type: string };

function fatigueEventToKind(event: FatigueCarryBlockEvent): ShiftLaneKind {
  if (event.nonWork) return "non_work";
  if (event.recoveryMinutes > 0) return "break";
  if (event.workMinutes > 0) return "work";
  return "idle";
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
    projections?: ShiftWorkProjection[];
  }
): ShiftLaneCell[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const projections = opts?.projections ?? [];
  const nowBlock = findNowBlockStartMs(nowMs);
  const hasPlanProjection = projections.length > 0;

  return blocks.map((block, index) => {
    const generated = block.blockStartMs > nowBlock;
    if (generated) {
      if (hasPlanProjection) {
        const kind = projectedKindFromPlans(block.blockStartMs, projections);
        return {
          blockStartMs: block.blockStartMs,
          kind,
          generated: true,
          planLabel: projectionLabelForBlock(block.blockStartMs, projections),
        };
      }
      const projected = demoBlockEventForIndex(index, true);
      return {
        blockStartMs: block.blockStartMs,
        kind: fatigueEventToKind(projected),
        generated: true,
        planLabel: null,
      };
    }

    const recorded = recordedKindForBlock(block.blockStartMs, events, nowMs);
    return {
      blockStartMs: block.blockStartMs,
      kind: recorded ?? "idle",
      generated: false,
    };
  });
}

export function shiftLaneColor(kind: ShiftLaneKind, generated: boolean): string {
  if (kind === "idle") {
    return generated ? "rgba(148, 163, 184, 0.35)" : "#cbd5e1";
  }

  const themeKey: ActivityKey = kind;
  const { rgb } = ACTIVITY_THEME[themeKey];
  if (!generated) return ACTIVITY_THEME[themeKey].hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.42)`;
}

export function shiftLaneLabel(kind: ShiftLaneKind): string {
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
