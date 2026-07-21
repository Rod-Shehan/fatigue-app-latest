/**
 * End-shift finish calendar day (display bucket only).
 * Bounds: last open work/break event's local day → regulatory today.
 * Does not change rolling-timeline continuity — only where the stop is labeled.
 */

import { formatDateLocal, getSheetDayDateString, normalizeWeekDateString } from "@/lib/weeks";
import { isoToLocalYmd } from "@/lib/sheet-day-time";

export function findSheetDayIndexForYmd(weekStarting: string, ymd: string): number | null {
  const target = normalizeWeekDateString(ymd);
  for (let i = 0; i < 7; i++) {
    if (getSheetDayDateString(weekStarting, i) === target) return i;
  }
  return null;
}

export type EndShiftFinishDayOptions = {
  minYmd: string;
  maxYmd: string;
  defaultYmd: string;
  defaultDayIndex: number;
  /** True when the driver can pick more than one calendar day. */
  showDatePicker: boolean;
};

/**
 * Resolve finish-day picker bounds for End shift.
 * Defaults to the last open event's local day when that day is before today
 * (forgotten overnight close); otherwise today.
 */
export function resolveEndShiftFinishDayOptions(args: {
  lastOpenEventIso: string;
  todayYmd: string;
  weekStarting: string;
  /** Day index the driver tapped End shift from (usually today). */
  tappedDayIndex: number;
}): EndShiftFinishDayOptions {
  const todayYmd = normalizeWeekDateString(args.todayYmd);
  const weekStart = getSheetDayDateString(args.weekStarting, 0);
  const weekEnd = getSheetDayDateString(args.weekStarting, 6);
  const lastYmd = isoToLocalYmd(args.lastOpenEventIso) ?? todayYmd;

  let minYmd = lastYmd < weekStart ? weekStart : lastYmd;
  if (minYmd > todayYmd) minYmd = todayYmd;
  if (minYmd > weekEnd) minYmd = weekEnd;

  let maxYmd = todayYmd > weekEnd ? weekEnd : todayYmd;
  if (maxYmd < minYmd) maxYmd = minYmd;

  const defaultYmd = minYmd < maxYmd ? minYmd : maxYmd;
  const defaultDayIndex =
    findSheetDayIndexForYmd(args.weekStarting, defaultYmd) ?? args.tappedDayIndex;

  return {
    minYmd,
    maxYmd,
    defaultYmd,
    defaultDayIndex,
    showDatePicker: minYmd < maxYmd,
  };
}

/** Local calendar YYYY-MM-DD for "now" (tests / callers that already have a Date). */
export function localYmdFromDate(d: Date = new Date()): string {
  return formatDateLocal(d);
}
