/**
 * RULE IP — Do not change fatigue time/compliance rule logic without explicit owner approval.
 * See .cursor/rules/time-rules-ip.mdc
 *
 * Standard fatigue rule: within each rolling 5h block of work time,
 * qualifying rest is either one continuous ≥20 min break, or two separate ≥10 min breaks.
 * Breaks &lt;10 min do not count toward rest (counted as work in coverage). This module
 * models slot filling from `break` events. Display conversion (&gt;30 min → non-work row)
 * is in derive-minute-coverage; AMI 5h treats both rest rows the same.
 */

import { isBreakFromDrivingEventType, isWorkTimeEventType } from "@/lib/activity-kind";

export const MIN_QUAL_BREAK_MIN = 10;
export const TOTAL_QUAL_BREAK_MIN = 20;
export const WORK_WINDOW_MIN = 5 * 60;

export type RestSlots = { slot1: boolean; slot2: boolean };

export function emptySlots(): RestSlots {
  return { slot1: false, slot2: false };
}

/** Apply one qualifying break segment (minutes) to the two-slot model. */
export function applyQualifyingBreakSegment(durationMin: number, slots: RestSlots): void {
  if (durationMin < MIN_QUAL_BREAK_MIN) return;
  if (durationMin >= 20) {
    slots.slot1 = true;
    slots.slot2 = true;
    return;
  }
  if (!slots.slot1) slots.slot1 = true;
  else if (!slots.slot2) slots.slot2 = true;
}

export function qualifyingRestComplete(slots: RestSlots): boolean {
  return slots.slot1 && slots.slot2;
}

export type TimelineEvent = { time: string; type: string };

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Start of the rolling "last 5h of work time" window that ends at `endMs`.
 * Walks backward through work segments only until 300 minutes of work are accounted for.
 */
export function findWorkWindowStartMs(events: TimelineEvent[], endMs: number): number | null {
  if (events.length === 0) return null;
  let remainingWork = WORK_WINDOW_MIN;
  let windowStartMs: number | null = null;
  for (let i = events.length - 1; i >= 0; i--) {
    const segStart = toMs(events[i].time);
    const segEnd = i === events.length - 1 ? endMs : toMs(events[i + 1].time);
    if (segEnd <= segStart) continue;
    const durationMin = Math.floor((segEnd - segStart) / 60000);
    if (!isWorkTimeEventType(events[i].type)) continue;
    if (remainingWork <= durationMin) {
      windowStartMs = segEnd - remainingWork * 60 * 1000;
      break;
    }
    remainingWork -= durationMin;
  }
  if (windowStartMs == null) {
    for (let i = events.length - 1; i >= 0; i--) {
      if (isWorkTimeEventType(events[i].type)) {
        windowStartMs = toMs(events[i].time);
        break;
      }
    }
  }
  return windowStartMs;
}

/**
 * Merged durations (minutes) of each maximal consecutive break run overlapping [rangeStartMs, rangeEndMs].
 */
export function collectBreakRunMinutesOverlappingRange(
  events: TimelineEvent[],
  rangeStartMs: number,
  rangeEndMs: number
): number[] {
  const runs: number[] = [];
  let i = 0;
  while (i < events.length) {
    if (!isBreakFromDrivingEventType(events[i].type)) {
      i += 1;
      continue;
    }
    const runStartIdx = i;
    let runEndMs = i + 1 < events.length ? toMs(events[i + 1].time) : rangeEndMs;
    let j = i + 1;
    while (j < events.length && isBreakFromDrivingEventType(events[j].type)) {
      runEndMs = j + 1 < events.length ? toMs(events[j + 1].time) : rangeEndMs;
      j += 1;
    }
    const runStartMs = toMs(events[runStartIdx].time);
    const overlapStart = Math.max(runStartMs, rangeStartMs);
    const overlapEnd = Math.min(runEndMs, rangeEndMs);
    if (overlapEnd > overlapStart) {
      runs.push(Math.floor((overlapEnd - overlapStart) / 60000));
    }
    i = j;
  }
  return runs;
}

export function restSlotsFromBreakMinutesInOrder(durationsMin: number[]): RestSlots {
  const slots = emptySlots();
  for (const d of durationsMin) {
    applyQualifyingBreakSegment(d, slots);
  }
  return slots;
}

/** Slots filled by qualifying break time in [rangeStartMs, rangeEndMs] (end exclusive for caller control). */
export function getRestSlotsForBreakRange(
  events: TimelineEvent[],
  rangeStartMs: number,
  rangeEndMs: number
): RestSlots {
  const runs = collectBreakRunMinutesOverlappingRange(events, rangeStartMs, rangeEndMs);
  return restSlotsFromBreakMinutesInOrder(runs);
}

/**
 * When last event is "work", minutes before the end of the 5h work block (in work-minutes from window start)
 * at which a break should start: 0 = rest already satisfied by breaks in window; 10 = need one more ~10 min; 20 = need 20 min total rest still.
 */
export function getMinutesBeforeDueFromSlots(slots: RestSlots): number {
  if (qualifyingRestComplete(slots)) return 0;
  if (slots.slot1 || slots.slot2) return 10;
  return 20;
}

/**
 * Prior slots from breaks strictly before `beforeMs`, within the work window starting at `windowStartMs`.
 */
export function getPriorRestSlotsBeforeTime(
  events: TimelineEvent[],
  windowStartMs: number,
  beforeMs: number
): RestSlots {
  return getRestSlotsForBreakRange(events, windowStartMs, beforeMs);
}

/**
 * Minimum additional minutes needed on the current break (starting at breakStartMs) to satisfy the rule
 * if all rest were taken in this break only: 0 if prior slots already complete, 10 if one slot left, 20 if none.
 */
export function getAdditionalMinutesNeededForCurrentBreak(priorSlots: RestSlots): number {
  if (qualifyingRestComplete(priorSlots)) return 0;
  if (priorSlots.slot1 || priorSlots.slot2) return 10;
  return 20;
}

/** Whether logging work after the current break run is allowed without 5h-break warning (rest satisfied in window). */
export function qualifyingRestMetForWorkAfterBreak(
  events: TimelineEvent[],
  breakRunSegmentsMin: number[]
): boolean {
  if (events.length === 0) return true;
  const last = events[events.length - 1];
  if (!isBreakFromDrivingEventType(last.type)) return true;
  const breakStartMs = toMs(last.time);
  const windowStartMs = findWorkWindowStartMs(events, breakStartMs);
  if (windowStartMs == null) return true;
  const prior = getPriorRestSlotsBeforeTime(events, windowStartMs, breakStartMs);
  const slots: RestSlots = { ...prior };
  for (const seg of breakRunSegmentsMin) {
    applyQualifyingBreakSegment(seg, slots);
  }
  return qualifyingRestComplete(slots);
}

/**
 * Progress for a single bar split into two 10-minute halves (20 min total rest target).
 * `elapsedMin` is the current continuous break run duration; `priorSlots` is rest already
 * banked in the current 5h work window before this break started.
 */
export function getBreakSplitBarState(
  priorSlots: RestSlots,
  elapsedMin: number
): { leftPct: number; rightPct: number; combinedPct: number; complete: boolean } {
  const slots = { ...priorSlots };
  applyQualifyingBreakSegment(elapsedMin, slots);
  const complete = qualifyingRestComplete(slots);

  if (priorSlots.slot1 && priorSlots.slot2) {
    return { leftPct: 100, rightPct: 100, combinedPct: 100, complete: true };
  }
  if (priorSlots.slot1 && !priorSlots.slot2) {
    const rightPct = Math.min(100, (elapsedMin / 10) * 100);
    return {
      leftPct: 100,
      rightPct,
      combinedPct: (100 + rightPct) / 2,
      complete,
    };
  }
  if (elapsedMin >= 20) {
    return { leftPct: 100, rightPct: 100, combinedPct: 100, complete: true };
  }
  if (elapsedMin >= 10) {
    const rightPct = ((elapsedMin - 10) / 10) * 100;
    return {
      leftPct: 100,
      rightPct,
      combinedPct: (100 + rightPct) / 2,
      complete,
    };
  }
  const leftPct = (elapsedMin / 10) * 100;
  return {
    leftPct,
    rightPct: 0,
    combinedPct: leftPct / 2,
    complete,
  };
}

/** True when the 5h work window already had a full qualifying rest before this break started. */
export function isRestRequirementAlreadyMetBeforeCurrentBreak(events: TimelineEvent[]): boolean {
  if (events.length === 0) return false;
  const last = events[events.length - 1];
  if (!isBreakFromDrivingEventType(last.type)) return false;
  const breakStartMs = toMs(last.time);
  const windowStartMs = findWorkWindowStartMs(events, breakStartMs);
  if (windowStartMs == null) return false;
  const prior = getPriorRestSlotsBeforeTime(events, windowStartMs, breakStartMs);
  return qualifyingRestComplete(prior);
}

/**
 * Work accumulated since the last qualifying-break reset (or stop/non_work).
 * Mirrors compliance.ts / LogBar warning: qualifying rest when returning to work resets the block.
 */
export function computeWorkPeriodAtEnd(
  events: TimelineEvent[],
  endMs: number
): { periodStartMs: number; workMins: number } | null {
  if (events.length === 0) return null;

  let periodStartMs = toMs(events[0].time);
  let workMins = 0;
  let breakRunDurations: number[] = [];

  for (let i = 0; i < events.length; i++) {
    const segStart = toMs(events[i].time);
    if (segStart >= endMs) break;

    const naturalEnd = i + 1 < events.length ? toMs(events[i + 1].time) : endMs;
    const segEnd = Math.min(naturalEnd, endMs);
    if (segEnd <= segStart) continue;

    const dur = Math.floor((segEnd - segStart) / 60000);
    const type = events[i].type;

    if (isWorkTimeEventType(type)) {
      if (breakRunDurations.length > 0) {
        const slice = events.slice(0, i);
        if (qualifyingRestMetForWorkAfterBreak(slice, breakRunDurations)) {
          periodStartMs = segStart;
          workMins = 0;
        }
        breakRunDurations = [];
      }
      workMins += dur;
    } else if (isBreakFromDrivingEventType(type)) {
      breakRunDurations.push(dur);
    } else {
      periodStartMs = segEnd;
      workMins = 0;
      breakRunDurations = [];
    }
  }

  return { periodStartMs, workMins };
}

/** Wall-clock time when `targetWorkMins` of work have elapsed since `periodStartMs`. */
export function findWallClockMsAtWorkMinutes(
  events: TimelineEvent[],
  periodStartMs: number,
  targetWorkMins: number
): number {
  let accumulated = 0;
  for (let i = 0; i < events.length; i++) {
    if (!isWorkTimeEventType(events[i].type)) continue;
    const segStart = toMs(events[i].time);
    const segEnd = i + 1 < events.length ? toMs(events[i + 1].time) : Number.MAX_SAFE_INTEGER;
    if (segEnd <= periodStartMs) continue;
    const clipStart = Math.max(segStart, periodStartMs);
    if (segEnd <= clipStart) continue;
    const segWorkMins = Math.floor((segEnd - clipStart) / 60000);
    if (accumulated + segWorkMins >= targetWorkMins) {
      const needMins = targetWorkMins - accumulated;
      return clipStart + needMins * 60 * 1000;
    }
    accumulated += segWorkMins;
  }
  return periodStartMs + targetWorkMins * 60 * 1000;
}

/**
 * When the last event is work: wall-clock ms when a 20 min rest is due.
 * Due after **300 work minutes** (5h driving). Do not pull due time forward by the
 * remaining rest (that made 5h look like 4h40 — Jaydin Fri 21:06 → “due 01:46”).
 * Returns null when not in work or rest is already satisfied in the current work period.
 */
export function getBreakDueByTime(events: TimelineEvent[], nowMs: number): number | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  if (!isWorkTimeEventType(last.type)) return null;

  const period = computeWorkPeriodAtEnd(events, nowMs);
  if (period == null) return null;

  const { periodStartMs, workMins } = period;
  const slots = getRestSlotsForBreakRange(events, periodStartMs, nowMs);

  if (qualifyingRestComplete(slots) && workMins < WORK_WINDOW_MIN) return null;

  return findWallClockMsAtWorkMinutes(events, periodStartMs, WORK_WINDOW_MIN);
}

/** Minutes left to satisfy the rest rule if continuing this break (rough display). */
export function getRemainingBreakMinutesForDisplay(priorSlots: RestSlots, elapsedMin: number): number {
  const slots = { ...priorSlots };
  applyQualifyingBreakSegment(elapsedMin, slots);
  if (qualifyingRestComplete(slots)) return 0;
  if (priorSlots.slot1 && priorSlots.slot2) return 0;
  if (priorSlots.slot1 && !priorSlots.slot2) {
    return Math.max(0, 10 - Math.floor(elapsedMin));
  }
  return Math.max(0, 20 - Math.floor(elapsedMin));
}
