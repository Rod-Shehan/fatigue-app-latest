/**
 * End-shift finish calendar day (display bucket only).
 * Bounds: open-shift start day card → regulatory today.
 * Tuesday follow-on work on the grid is not a new event — min day stays the
 * card that holds Start work for this open shift.
 */

import { formatDateLocal, getSheetDayDateString, normalizeWeekDateString } from "@/lib/weeks";

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

function clampYmdToWeekAndToday(
  ymd: string,
  weekStart: string,
  weekEnd: string,
  todayYmd: string
): string {
  let out = ymd;
  if (out < weekStart) out = weekStart;
  if (out > weekEnd) out = weekEnd;
  if (out > todayYmd) out = todayYmd;
  return out;
}

/**
 * Resolve finish-day picker bounds for End shift.
 *
 * - min = sheet day of the open shift's starting Work (episode start day card)
 * - max = regulatory today
 * - default = last open work/break's sheet day when before today (forgotten overnight);
 *   otherwise today (finish must still be after that last event)
 */
export function resolveEndShiftFinishDayOptions(args: {
  /** Day card index of the Work that opened this open shift. */
  episodeStartDayIndex: number;
  /** Day card index of the last open work/break event. */
  lastOpenDayIndex: number;
  todayYmd: string;
  weekStarting: string;
  /** Day index the driver tapped End shift from (usually today). */
  tappedDayIndex: number;
}): EndShiftFinishDayOptions {
  const todayYmd = normalizeWeekDateString(args.todayYmd);
  const weekStart = getSheetDayDateString(args.weekStarting, 0);
  const weekEnd = getSheetDayDateString(args.weekStarting, 6);

  const episodeYmd = getSheetDayDateString(args.weekStarting, args.episodeStartDayIndex);
  const lastOpenYmd = getSheetDayDateString(args.weekStarting, args.lastOpenDayIndex);

  let minYmd = clampYmdToWeekAndToday(episodeYmd, weekStart, weekEnd, todayYmd);
  let maxYmd = todayYmd > weekEnd ? weekEnd : todayYmd;
  if (maxYmd < minYmd) maxYmd = minYmd;

  // Prefer last-open day when it is still before today (true forgotten overnight).
  // If last open landed on today's card (or episode spans into today), default today
  // but keep min at episode start so yesterday remains selectable.
  let defaultYmd =
    lastOpenYmd < todayYmd
      ? clampYmdToWeekAndToday(lastOpenYmd, weekStart, weekEnd, todayYmd)
      : maxYmd;
  if (defaultYmd < minYmd) defaultYmd = minYmd;
  if (defaultYmd > maxYmd) defaultYmd = maxYmd;

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
