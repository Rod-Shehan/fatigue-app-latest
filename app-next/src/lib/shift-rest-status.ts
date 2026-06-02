"use client";

export type ShiftRestDay = {
  /** 1440-minute grid OR legacy 48 half-hour slots. */
  work_time?: boolean[];
};

export type ShiftRestStatus = {
  /** Consecutive minutes with NO work immediately before now. */
  consecutiveNonWorkMinutes: number;
  /** Approx local timestamp (ms) when this non-work run started, or null if unknown. */
  restRunStartedAtMs: number | null;
};

function minutesSinceMidnightLocal(nowMs: number): number {
  const d = new Date(nowMs);
  return d.getHours() * 60 + d.getMinutes();
}

function isWorkMinute(work: boolean[] | undefined, minuteIndex: number): boolean {
  if (!work || work.length === 0) return false;
  // Support both 48-slot legacy and 1440-minute grids.
  if (work.length === 48) return !!work[Math.floor(minuteIndex / 30)];
  return !!work[minuteIndex];
}

/**
 * Phase A core: derive the current "rest run" purely from the work_time grid.
 * Rule: any minute that is not work counts toward the run (break and non-work are both "not work").
 */
export function getShiftRestStatusFromWorkGrid(
  days: ShiftRestDay[],
  currentDayIndex: number,
  nowMs: number
): ShiftRestStatus {
  const endMinuteToday = Math.max(0, Math.min(1440, minutesSinceMidnightLocal(nowMs) + 1));
  let count = 0;

  for (let dayIdx = currentDayIndex; dayIdx >= 0; dayIdx--) {
    const day = days[dayIdx] ?? {};
    const wt = day.work_time ?? [];
    const limit = dayIdx === currentDayIndex ? endMinuteToday : 1440;
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

