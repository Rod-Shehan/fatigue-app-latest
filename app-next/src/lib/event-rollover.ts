/**
 * Rolling timeline carry across calendar-day buckets.
 * Server-safe — do not import from EventLogger (that file is a client component).
 *
 * RULE IP — Do not change fatigue time/coverage behaviour without explicit owner approval.
 * See .cursor/rules/time-rules-ip.mdc and rolling-timeline.mdc
 */

import { getTodayLocalDateString, getSheetDayDateString } from "@/lib/weeks";
import { deriveMinuteGridFromEvents, MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import { perthDayEndUtcMs, perthDayStartUtcMs } from "@/lib/perth-now";

/** Open segment at end of a sheet calendar day — may continue on the rolling timeline until the next event. */
export type OpenActivityAtDayEnd = "work" | "break" | "other_work" | "non_work";

/**
 * Open activity on the calendar day before `days[0]` of a sheet week (e.g. prior
 * week Saturday → this week's Sunday). WeekStarting is a label only; continuity
 * still comes from the last driver-logged type. End shift continues as non-work.
 */
export function resolveOpenActivityBeforeFirstDay(
  prevWeekDays:
    | {
        work_time?: boolean[];
        breaks?: boolean[];
        non_work?: boolean[];
        events?: { time: string; type: string }[];
      }[]
    | null
    | undefined,
  prevWeekStarting: string | undefined,
  todayStr: string
): OpenActivityAtDayEnd | null {
  if (!prevWeekDays?.length || !prevWeekStarting?.trim()) return null;
  const lastIdx = prevWeekDays.length - 1;
  const last = prevWeekDays[lastIdx];
  if (!last) return null;
  const dateStr = getSheetDayDateString(prevWeekStarting, lastIdx);
  return getEffectiveOpenActivityAtDayEnd(last, dateStr, todayStr);
}

/**
 * Activity still open at end of this calendar-day *descriptor* (for the next bucket's paint).
 * End shift starts non-work; that non-work continues until the next driver-logged event.
 * Midnight / weekStarting are labels only — they do not end coverage.
 */
export function getEffectiveOpenActivityAtDayEnd(
  day: {
    work_time?: boolean[];
    breaks?: boolean[];
    non_work?: boolean[];
    events?: { time: string; type: string }[];
  },
  _dateStr: string,
  _todayStr: string
): OpenActivityAtDayEnd | null {
  const evs = day.events ?? [];
  const lastEv = evs[evs.length - 1];
  if (lastEv?.type === "stop") return "non_work";
  if (lastEv?.type === "passenger") return "other_work";
  if (lastEv?.type === "sleeper_berth") return "non_work";
  if (
    lastEv?.type === "work" ||
    lastEv?.type === "break" ||
    lastEv?.type === "other_work" ||
    lastEv?.type === "non_work"
  ) {
    return lastEv.type;
  }

  const w = day.work_time ?? [];
  const b = day.breaks ?? [];
  const nw = day.non_work ?? [];
  const len =
    w.length === 48
      ? 48
      : Math.min(Math.max(w.length, b.length, nw.length) || MINUTES_PER_DAY, MINUTES_PER_DAY);
  for (let s = len - 1; s >= 0; s--) {
    if (w[s] && b[s]) return "other_work";
    if (w[s]) return "work";
    if (b[s]) return "break";
    if (nw[s]) return "non_work";
  }
  return null;
}

/**
 * Derive work_time, breaks, non_work for all days with rollover.
 *
 * Rolling timeline: calendar day / weekStarting are UI buckets only. An open
 * driver-logged segment (work, break, other work, or non-work after End shift)
 * continues into the next bucket from 00:00 until the first event on that bucket
 * (or until "now" on today). Do not invent a type change at midnight.
 * Unlogged elapsed time is always non-work — never leave a blank.
 */
export function deriveDaysWithRollover<T extends { events?: { time: string; type: string }[] }>(
  days: T[],
  weekStarting: string,
  options?: {
    todayStr?: string;
    /**
     * Open activity on the calendar day before `days[0]` (e.g. prior week Saturday).
     * Required so Sunday week-start is not a false timeline cut.
     */
    openActivityBeforeFirstDay?: OpenActivityAtDayEnd | null;
  }
): (T & { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] })[] {
  const todayStr = options?.todayStr ?? getTodayLocalDateString();
  const result = days.map((d) => ({ ...d })) as (T & {
    work_time: boolean[];
    breaks: boolean[];
    non_work: boolean[];
  })[];
  for (let i = 0; i < days.length; i++) {
    const currentEvents = (result[i].events || []) as { time: string; type: string }[];
    const dateStr = getSheetDayDateString(weekStarting, i);
    const dayStart = perthDayStartUtcMs(dateStr);
    const isToday = dateStr === todayStr;
    const dayEnd = perthDayEndUtcMs(dateStr);
    const now = Date.now();
    const effectiveEnd = isToday ? Math.min(dayEnd, now) : dayEnd;
    const maxMinuteExclusive = isToday
      ? Math.min(MINUTES_PER_DAY, Math.max(0, Math.ceil((effectiveEnd - dayStart) / 60000)))
      : MINUTES_PER_DAY;

    const prevDateStr = i > 0 ? getSheetDayDateString(weekStarting, i - 1) : "";
    const carryOverType: OpenActivityAtDayEnd | null =
      i > 0
        ? getEffectiveOpenActivityAtDayEnd(result[i - 1], prevDateStr, todayStr)
        : (options?.openActivityBeforeFirstDay ?? null);
    let carryOverEndMinute = 0;
    if (carryOverType) {
      const firstEv = currentEvents[0];
      if (firstEv) {
        const firstEvTime = new Date(firstEv.time).getTime();
        carryOverEndMinute = Math.min(
          maxMinuteExclusive,
          Math.max(0, Math.ceil((firstEvTime - dayStart) / 60000))
        );
      } else {
        carryOverEndMinute = maxMinuteExclusive;
      }
    }

    const assumeIdleFrom = (result[i] as { assume_idle_from?: string }).assume_idle_from;

    const derived = deriveMinuteGridFromEvents(currentEvents.length ? currentEvents : undefined, dateStr, {
      carryOverType: carryOverType ?? undefined,
      carryOverEndMinute: carryOverEndMinute || undefined,
      assumeIdleFromMs: assumeIdleFrom ? new Date(assumeIdleFrom).getTime() : undefined,
      isToday,
      dayStart,
      todayStr,
    });
    result[i] = { ...result[i], ...derived };
  }
  return result;
}
