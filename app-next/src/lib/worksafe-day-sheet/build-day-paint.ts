/**
 * Build exclusive WorkSafe day paint from EWD coverage / events.
 * RULE IP: does not change thresholds — delegates to deriveMinuteGridFromEvents.
 */

import {
  deriveMinuteGridFromEvents,
  MINUTES_PER_DAY,
  normalizeDayCoverageArrays,
  type CarryOverActivity,
} from "@/lib/coverage/derive-minute-coverage";
import { perthDayStartUtcMs } from "@/lib/perth-now";
import type {
  WorkSafeDayPaint,
  WorkSafeDaySegment,
  WorkSafeDayTotalsMinutes,
  WorkSafeTrack,
} from "./types";

export type BuildWorkSafeDayPaintInput = {
  dateStr: string;
  /** Regulatory / display "today" YMD — future days stay unpainted. */
  todayStr: string;
  events?: Array<{ time: string; type: string }>;
  /** Optional precomputed grids (e.g. after deriveDaysWithRollover). */
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  carryOverType?: CarryOverActivity;
  carryOverEndMinute?: number;
  /** Injected clock for tests; defaults to Date.now(). */
  nowMs?: number;
  /**
   * Override paint cap (0–1440). Use for PDF when "now" must follow Australia/Perth
   * rather than the process local timezone.
   */
  paintedUntilMinute?: number;
};

function paintedUntilMinuteForDay(dateStr: string, todayStr: string, nowMs: number): number {
  if (dateStr > todayStr) return 0;
  if (dateStr < todayStr) return MINUTES_PER_DAY;
  const dayStart = perthDayStartUtcMs(dateStr);
  return Math.min(MINUTES_PER_DAY, Math.max(0, Math.ceil((nowMs - dayStart) / 60000)));
}

/**
 * Exclusive track for one minute from coverage grids.
 * Matches WorkSafe day exclusivity: break masks work (`work && !breaks`); then break; then non_work.
 */
export function exclusiveTrackAtMinute(
  work_time: boolean[],
  breaks: boolean[],
  non_work: boolean[],
  minute: number
): WorkSafeTrack | null {
  if (minute < 0 || minute >= MINUTES_PER_DAY) return null;
  if (breaks[minute]) return "break";
  if (work_time[minute]) return "work";
  if (non_work[minute]) return "non_work";
  return null;
}

export function segmentsFromTrackByMinute(
  trackByMinute: Array<WorkSafeTrack | null>
): WorkSafeDaySegment[] {
  const segments: WorkSafeDaySegment[] = [];
  let i = 0;
  while (i < trackByMinute.length) {
    const track = trackByMinute[i];
    if (track == null) {
      i++;
      continue;
    }
    let end = i + 1;
    while (end < trackByMinute.length && trackByMinute[end] === track) end++;
    segments.push({ track, startMin: i, endMin: end });
    i = end;
  }
  return segments;
}

export function totalsFromTrackByMinute(
  trackByMinute: Array<WorkSafeTrack | null>
): WorkSafeDayTotalsMinutes {
  const totals: WorkSafeDayTotalsMinutes = { work: 0, break: 0, non_work: 0 };
  for (const t of trackByMinute) {
    if (t === "work") totals.work += 1;
    else if (t === "break") totals.break += 1;
    else if (t === "non_work") totals.non_work += 1;
  }
  return totals;
}

function resolveCoverageGrids(input: BuildWorkSafeDayPaintInput, nowMs: number) {
  const hasGrids =
    Array.isArray(input.work_time) &&
    Array.isArray(input.breaks) &&
    Array.isArray(input.non_work) &&
    (input.work_time.length > 0 || input.breaks.length > 0 || input.non_work.length > 0);

  if (hasGrids) {
    return normalizeDayCoverageArrays({
      work_time: input.work_time,
      breaks: input.breaks,
      non_work: input.non_work,
    });
  }

  const dayStart = perthDayStartUtcMs(input.dateStr);
  const isToday = input.dateStr === input.todayStr;
  return deriveMinuteGridFromEvents(input.events, input.dateStr, {
    todayStr: input.todayStr,
    dayStart,
    carryOverType: input.carryOverType,
    carryOverEndMinute: input.carryOverEndMinute,
    isToday,
    // Caps work/break paint when injecting nowMs; open segments still use Date.now()
    // inside derive — callers should prefer sheet grids for live "today".
    assumeIdleFromMs: isToday ? nowMs : undefined,
  });
}

/**
 * Build WorkSafe exclusive day paint for one YMD.
 * Prefer passing grids from `deriveDaysWithRollover` when overnight carry is required.
 *
 * Presentation only (owner): elapsed minutes are never blank. Unlogged time is
 * always non-work. Calendar day / midnight are descriptors only — they do not
 * start or stop coverage. Prefer grids from `deriveDaysWithRollover`.
 */
export function buildWorkSafeDayPaint(input: BuildWorkSafeDayPaintInput): WorkSafeDayPaint {
  const nowMs = input.nowMs ?? Date.now();
  const paintedUntilMinute = Math.min(
    MINUTES_PER_DAY,
    Math.max(
      0,
      input.paintedUntilMinute ?? paintedUntilMinuteForDay(input.dateStr, input.todayStr, nowMs)
    )
  );
  const grids = resolveCoverageGrids(input, nowMs);

  const trackByMinute: Array<WorkSafeTrack | null> = Array(MINUTES_PER_DAY).fill(null);
  for (let m = 0; m < paintedUntilMinute; m++) {
    trackByMinute[m] =
      exclusiveTrackAtMinute(grids.work_time, grids.breaks, grids.non_work, m) ?? "non_work";
  }

  return {
    dateStr: input.dateStr,
    paintedUntilMinute,
    trackByMinute,
    segments: segmentsFromTrackByMinute(trackByMinute),
    totalsMinutes: totalsFromTrackByMinute(trackByMinute),
  };
}
