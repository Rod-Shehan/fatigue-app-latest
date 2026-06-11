"use client";

/**
 * Legacy grid-only rest walkback (no event timestamps).
 * Prefer getShiftRestStatusFromTimeline in rolling-events.ts for the 7h Start-shift gate.
 */

export type ShiftRestDay = {
  work_time?: boolean[];
};

export type ShiftRestStatus = {
  consecutiveNonWorkMinutes: number;
  restRunStartedAtMs: number | null;
};

function minutesSinceMidnightLocal(nowMs: number): number {
  const d = new Date(nowMs);
  return d.getHours() * 60 + d.getMinutes();
}

function isWorkMinute(work: boolean[] | undefined, minuteIndex: number): boolean {
  if (!work || work.length === 0) return false;
  if (work.length === 48) return !!work[Math.floor(minuteIndex / 30)];
  return !!work[minuteIndex];
}

/**
 * Walk work_time grids backward through consecutive record slices (legacy fallback).
 * Slices must already be in chronological order; index is the slice containing asOfMs.
 */
export function getShiftRestStatusFromWorkGrid(
  slices: ShiftRestDay[],
  sliceIndexContainingNow: number,
  nowMs: number
): ShiftRestStatus {
  const endMinuteToday = Math.max(0, Math.min(1440, minutesSinceMidnightLocal(nowMs) + 1));
  let count = 0;

  for (let dayIdx = sliceIndexContainingNow; dayIdx >= 0; dayIdx--) {
    const day = slices[dayIdx] ?? {};
    const wt = day.work_time ?? [];
    const limit = dayIdx === sliceIndexContainingNow ? endMinuteToday : 1440;
    const maxMinute =
      wt.length === 48 ? Math.min(limit, 48 * 30) : wt.length ? Math.min(limit, wt.length) : limit;

    for (let m = maxMinute - 1; m >= 0; m--) {
      if (isWorkMinute(wt, m)) {
        const restRunStartedAtMs = nowMs - count * 60 * 1000;
        return { consecutiveNonWorkMinutes: count, restRunStartedAtMs };
      }
      count += 1;
    }
  }

  return {
    consecutiveNonWorkMinutes: count,
    restRunStartedAtMs: count > 0 ? nowMs - count * 60 * 1000 : null,
  };
}
