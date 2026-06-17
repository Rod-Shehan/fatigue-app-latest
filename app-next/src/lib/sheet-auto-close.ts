/**
 * Auto-close draft sheets for **past** work weeks when there is nothing actionable
 * (no open shift to end, no legacy assume-idle cap, no grid work/break without a closed event line).
 * Frees drivers from being stuck on an old week when starting the current week.
 */

import { getEventsInTimeOrder } from "@/lib/rolling-events";
import { getThisWeekSunday, normalizeWeekDateString } from "@/lib/weeks";

export type SheetDayLike = {
  events?: { time: string; type: string }[];
  work_time?: boolean[];
  breaks?: boolean[];
  assume_idle_from?: string | null;
};

/**
 * @param thisWeekSunday - optional for tests (YYYY-MM-DD Sunday of “current” week)
 */
export function sheetEligibleForAutoClosePastWeek(
  weekStarting: string,
  days: unknown[],
  thisWeekSunday?: string
): boolean {
  const thisSun = normalizeWeekDateString(thisWeekSunday ?? getThisWeekSunday());
  const ws = normalizeWeekDateString(weekStarting);
  if (ws >= thisSun) return false;

  if (!Array.isArray(days)) return true;

  for (const d of days) {
    const day = d as SheetDayLike;
    if (day.assume_idle_from) return false;
  }

  const dayTyped = days as SheetDayLike[];
  const hasGridWorkOrBreak = dayTyped.some(
    (d) => (d.work_time || []).some(Boolean) || (d.breaks || []).some(Boolean)
  );

  const ev = getEventsInTimeOrder(dayTyped);
  if (ev.length === 0) {
    return !hasGridWorkOrBreak;
  }

  const last = ev[ev.length - 1];
  return last.type === "stop";
}
