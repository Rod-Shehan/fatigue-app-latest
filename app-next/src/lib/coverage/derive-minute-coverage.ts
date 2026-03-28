/**
 * Single source of truth: work / break / non-work coverage per calendar day as 1440 booleans (one per minute).
 * Used by EventLogger, compliance, and TimeGrid (via dayData grids).
 */

import { getTodayLocalDateString } from "@/lib/weeks";

export const MINUTES_PER_DAY = 1440;

const MAX_GAP_AS_BREAK_MINUTES = 30;
const MIN_BREAK_BLOCK_MINUTES = 10;

function reclassifyShortGapsAsBreak(
  work_time: boolean[],
  breaks: boolean[],
  non_work: boolean[],
  maxMinuteExclusive: number
): { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] } {
  for (let s = 0; s < maxMinuteExclusive; ) {
    if (!non_work[s]) {
      s++;
      continue;
    }
    let runEnd = s;
    while (runEnd < maxMinuteExclusive && non_work[runEnd]) runEnd++;
    const runMinutes = runEnd - s;
    const isShortGap = runMinutes <= MAX_GAP_AS_BREAK_MINUTES;
    const hasWorkBefore = s > 0 && work_time[s - 1];
    const hasWorkAfter = runEnd < maxMinuteExclusive && work_time[runEnd];
    if (isShortGap && (hasWorkBefore || hasWorkAfter)) {
      for (let k = s; k < runEnd; k++) {
        breaks[k] = true;
        non_work[k] = false;
      }
    }
    s = runEnd;
  }
  return { work_time, breaks, non_work };
}

function reclassifyLongBreaksAsNonWork(
  work_time: boolean[],
  breaks: boolean[],
  non_work: boolean[],
  maxMinuteExclusive: number
): { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] } {
  const minMinutesAsNonWork = MAX_GAP_AS_BREAK_MINUTES + 1;
  for (let s = 0; s < maxMinuteExclusive; ) {
    if (!breaks[s]) {
      s++;
      continue;
    }
    let runEnd = s;
    while (runEnd < maxMinuteExclusive && breaks[runEnd]) runEnd++;
    const runMinutes = runEnd - s;
    if (runMinutes >= minMinutesAsNonWork) {
      for (let k = s; k < runEnd; k++) {
        non_work[k] = true;
        breaks[k] = false;
      }
    }
    s = runEnd;
  }
  return { work_time, breaks, non_work };
}

export type DeriveMinuteGridOptions = {
  carryOverType?: "work" | "break";
  /** Minutes from midnight [0,1440) to fill carry; exclusive end index. */
  carryOverEndMinute?: number;
  assumeIdleFromMs?: number;
  isToday?: boolean;
  dayStart?: number;
  todayStr?: string;
};

/**
 * Derive minute-resolution grids from events for one day (00:00–24:00 local `dateStr`).
 * Mirrors the former 30-minute slot rules at 1-minute granularity.
 */
export function deriveMinuteGridFromEvents(
  events: { time: string; type: string }[] | undefined,
  dateStr: string,
  options?: DeriveMinuteGridOptions
): { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] } {
  const work_time = Array(MINUTES_PER_DAY).fill(false);
  const breaks = Array(MINUTES_PER_DAY).fill(false);
  const non_work = Array(MINUTES_PER_DAY).fill(false);
  const todayStr = options?.todayStr ?? getTodayLocalDateString();
  if (dateStr > todayStr) return { work_time, breaks, non_work };

  const isToday = dateStr === todayStr;
  const now = Date.now();
  const dayStart = options?.dayStart ?? new Date(dateStr + "T00:00:00").getTime();
  const dayEnd = new Date(dateStr + "T23:59:59").getTime();
  const assumeIdleFromMs = options?.assumeIdleFromMs && options?.isToday ? options.assumeIdleFromMs : undefined;
  const workBreakCap = assumeIdleFromMs != null ? Math.min(now, assumeIdleFromMs) : undefined;
  const effectiveEnd = isToday ? Math.min(dayEnd, now) : dayEnd;
  const maxMinuteExclusive = isToday
    ? Math.min(MINUTES_PER_DAY, Math.max(0, Math.ceil((effectiveEnd - dayStart) / 60000)))
    : MINUTES_PER_DAY;
  const workBreakMaxMinute =
    workBreakCap != null
      ? Math.min(maxMinuteExclusive, Math.max(0, Math.ceil((workBreakCap - dayStart) / 60000)))
      : maxMinuteExclusive;

  const { carryOverType, carryOverEndMinute = 0 } = options ?? {};
  if (carryOverType && carryOverEndMinute > 0) {
    const end = Math.min(carryOverEndMinute, workBreakMaxMinute);
    for (let m = 0; m < end; m++) {
      if (carryOverType === "work") work_time[m] = true;
      else breaks[m] = true;
    }
  }

  if (!events?.length) {
    for (let m = 0; m < maxMinuteExclusive; m++) {
      if (!work_time[m] && !breaks[m]) non_work[m] = true;
    }
    const withShortGapsAsBreak = reclassifyShortGapsAsBreak(work_time, breaks, non_work, maxMinuteExclusive);
    return reclassifyLongBreaksAsNonWork(
      withShortGapsAsBreak.work_time,
      withShortGapsAsBreak.breaks,
      withShortGapsAsBreak.non_work,
      maxMinuteExclusive
    );
  }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const nextEv = events[i + 1];
    if (ev.type === "stop") continue;
    const start = new Date(ev.time).getTime();
    const segmentEnd = nextEv ? new Date(nextEv.time).getTime() : isToday ? now : dayEnd;
    const end = workBreakCap != null && segmentEnd > workBreakCap ? workBreakCap : segmentEnd;
    const clampedStart = Math.max(start, dayStart);
    const clampedEnd = Math.min(end, workBreakCap ?? effectiveEnd);
    const durationMinutes = Math.floor((clampedEnd - clampedStart) / 60000);
    const startMin = Math.floor((clampedStart - dayStart) / 60000);
    const endMin = Math.ceil((clampedEnd - dayStart) / 60000);
    const isCompletedBreak = ev.type === "break" && nextEv != null;
    const treatBreakAsWork = isCompletedBreak && durationMinutes < MIN_BREAK_BLOCK_MINUTES;
    for (let m = Math.max(0, startMin); m < Math.min(workBreakMaxMinute, endMin); m++) {
      if (ev.type === "work" || treatBreakAsWork) work_time[m] = true;
      else if (ev.type === "break") breaks[m] = true;
    }
  }
  for (let m = 0; m < maxMinuteExclusive; m++) {
    if (!work_time[m] && !breaks[m]) non_work[m] = true;
  }
  const withShortGapsAsBreak = reclassifyShortGapsAsBreak(work_time, breaks, non_work, maxMinuteExclusive);
  return reclassifyLongBreaksAsNonWork(
    withShortGapsAsBreak.work_time,
    withShortGapsAsBreak.breaks,
    withShortGapsAsBreak.non_work,
    maxMinuteExclusive
  );
}

/** Expand legacy 48 half-hour slots to 1440 minutes (each true slot → 30 minutes). */
export function expandHalfHourSlotsToMinutes(slots: boolean[]): boolean[] {
  const out = Array(MINUTES_PER_DAY).fill(false);
  for (let i = 0; i < Math.min(48, slots.length); i++) {
    if (!slots[i]) continue;
    for (let m = 0; m < 30; m++) {
      const idx = i * 30 + m;
      if (idx < MINUTES_PER_DAY) out[idx] = true;
    }
  }
  return out;
}

/**
 * Single interpretation for one coverage row (work, break, or non-work): legacy 48 half-hour
 * slots expand to 1440 minutes; anything else is treated as per-minute booleans up to one day
 * (pad short, truncate long) so getHours never mixes half-hour and minute math by accident.
 */
export function normalizeCoverageFieldToMinutes(slots: boolean[] | undefined | null): boolean[] {
  if (!slots || slots.length === 0) return Array(MINUTES_PER_DAY).fill(false);
  if (slots.length === 48) return expandHalfHourSlotsToMinutes(slots);
  if (slots.length === MINUTES_PER_DAY) return slots.slice();
  if (slots.length < MINUTES_PER_DAY) {
    const out = slots.slice();
    while (out.length < MINUTES_PER_DAY) out.push(false);
    return out.slice(0, MINUTES_PER_DAY);
  }
  return slots.slice(0, MINUTES_PER_DAY);
}

/** Ensure work_time/breaks/non_work are 1440-length (expand from 48 if needed). */
export function normalizeDayCoverageArrays<T extends { work_time?: boolean[]; breaks?: boolean[]; non_work?: boolean[] }>(
  d: T
): T & { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] } {
  const wt = d.work_time;
  if (!wt || wt.length === 0) {
    return {
      ...d,
      work_time: Array(MINUTES_PER_DAY).fill(false),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: Array(MINUTES_PER_DAY).fill(false),
    };
  }
  if (wt.length === MINUTES_PER_DAY) {
    const br = d.breaks;
    const nw = d.non_work;
    return {
      ...d,
      work_time: wt,
      breaks:
        br && br.length === MINUTES_PER_DAY
          ? br
          : br && br.length === 48
            ? expandHalfHourSlotsToMinutes(br)
            : Array(MINUTES_PER_DAY).fill(false),
      non_work:
        nw && nw.length === MINUTES_PER_DAY
          ? nw
          : nw && nw.length === 48
            ? expandHalfHourSlotsToMinutes(nw)
            : Array(MINUTES_PER_DAY).fill(false),
    };
  }
  if (wt.length === 48) {
    return {
      ...d,
      work_time: expandHalfHourSlotsToMinutes(wt),
      breaks: expandHalfHourSlotsToMinutes(d.breaks ?? Array(48).fill(false)),
      non_work: expandHalfHourSlotsToMinutes(d.non_work ?? Array(48).fill(false)),
    };
  }
  return {
    ...d,
    work_time: wt.slice(0, MINUTES_PER_DAY),
    breaks: (d.breaks ?? []).slice(0, MINUTES_PER_DAY),
    non_work: (d.non_work ?? []).slice(0, MINUTES_PER_DAY),
  };
}

/**
 * API boundary: normalize each day's coverage to 1440 booleans (expand legacy 48-slot grids).
 * Preserves other day fields (events, kms, etc.). Safe for GET responses and POST/PATCH persist.
 */
export function normalizeSheetDaysForApi(days: unknown): unknown[] {
  if (!Array.isArray(days)) return [];
  return days.map((d) => {
    if (d && typeof d === "object" && !Array.isArray(d)) {
      return normalizeDayCoverageArrays(d as { work_time?: boolean[]; breaks?: boolean[]; non_work?: boolean[] });
    }
    return d;
  });
}
