/**
 * RULE IP — Do not change fatigue time/compliance rule logic without explicit owner approval.
 * See .cursor/rules/time-rules-ip.mdc
 *
 * Rolling time model: events are a single continuous timeline.
 * Days are only used to know "where" events came from (for display); rules use time only.
 */

import { getSeventeenHourEpisodeStatus } from "@/lib/seventeen-hour-episode";

export type RollingEvent = {
  time: string;
  type: string;
  dayIndex: number;
  driver?: "primary" | "second";
};

export type TimelineSlice = {
  events?: { time: string; type: string; driver?: "primary" | "second" }[];
};

export type RollingEventPoint = { time: string; type: string };

/** Concatenate record slices in chronological order (storage layout only; rules use event timestamps). */
export function concatenateTimelineSlices(...parts: TimelineSlice[][]): TimelineSlice[] {
  return parts.flat();
}

/**
 * Flatten all events from all days and sort by time (ascending).
 * Each event gets dayIndex so callers can still attribute to a day for display.
 */
export function getEventsInTimeOrder(days: TimelineSlice[]): RollingEvent[] {
  const withDay = days.flatMap((day, dayIndex) =>
    (day.events ?? []).map((ev) => {
      const row: RollingEvent = { time: ev.time, type: ev.type, dayIndex };
      if (ev.driver) row.driver = ev.driver;
      return row;
    })
  );
  withDay.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return withDay;
}

/**
 * Events on this driver's sheet — excludes legacy `driver: "second"` rows from the
 * shared-logbook model. Each driver keeps their own record; relief driver is metadata only.
 */
export function getSheetOwnerEventsInOrder(
  days: TimelineSlice[]
): { time: string; type: string }[] {
  return getEventsInTimeOrder(days)
    .filter((ev) => ev.driver !== "second")
    .map(({ time, type }) => ({ time, type }));
}

/**
 * @deprecated Legacy shared-sheet filter. Prefer {@link getSheetOwnerEventsInOrder}.
 */
export function getEventsForDriverInOrder(
  days: TimelineSlice[],
  activeDriver?: "primary" | "second"
): { time: string; type: string }[] {
  if (activeDriver === undefined) return getSheetOwnerEventsInOrder(days);
  const ordered = getEventsInTimeOrder(days);
  return ordered
    .filter((ev) => (ev.driver ?? "primary") === activeDriver)
    .map(({ time, type }) => ({ time, type }));
}

/**
 * Last "stop" (end shift) time in ms before optional cutoff, or null if none.
 */
export function getLastStopTime(events: RollingEventPoint[], beforeTimeMs?: number): number | null {
  const cutoff = beforeTimeMs ?? Infinity;
  let last: number | null = null;
  for (const ev of events) {
    const t = new Date(ev.time).getTime();
    if (ev.type === "stop" && t < cutoff && (last === null || t > last)) last = t;
  }
  return last;
}

/**
 * Last "shift end marker" time in ms before optional cutoff.
 * We treat both explicit End shift (stop) and Non-work start as shift-ending markers for the 7h recovery check.
 * This avoids false blocks when the driver logs non-work between shifts but forgets (or cannot) log End shift.
 */
export function getLastShiftEndTime(events: RollingEventPoint[], beforeTimeMs?: number): number | null {
  const cutoff = beforeTimeMs ?? Infinity;
  let last: number | null = null;
  for (const ev of events) {
    const t = new Date(ev.time).getTime();
    if ((ev.type === "stop" || ev.type === "non_work") && t < cutoff && (last === null || t > last)) last = t;
  }
  return last;
}

/**
 * Non-work time (hours) since the last stop event, as of asOfMs.
 * Returns null if there has never been a stop (no "last shift").
 */
export function getNonWorkHoursSinceLastStop(events: RollingEventPoint[], asOfMs: number): number | null {
  const lastStop = getLastStopTime(events, asOfMs + 1);
  if (lastStop === null) return null;
  return (asOfMs - lastStop) / (3600 * 1000);
}

/**
 * Non-work time (hours) since the last shift end marker (stop or non_work), as of asOfMs.
 * Returns null if none exists (no shift end marker recorded).
 */
export function getNonWorkHoursSinceLastShiftEnd(events: RollingEventPoint[], asOfMs: number): number | null {
  const lastEnd = getLastShiftEndTime(events, asOfMs + 1);
  if (lastEnd === null) return null;
  return (asOfMs - lastEnd) / (3600 * 1000);
}

/** Non-work minutes since the last shift end marker (stop or non_work), rolling from event time. */
export function getNonWorkMinutesSinceLastShiftEnd(
  events: RollingEventPoint[],
  asOfMs: number
): number | null {
  const lastEnd = getLastShiftEndTime(events, asOfMs + 1);
  if (lastEnd === null) return null;
  return Math.max(0, Math.floor((asOfMs - lastEnd) / 60000));
}

/**
 * Last event at or before asOfMs on a rolling timeline (event timestamps only).
 */
export function getLastRollingEventAt(
  events: RollingEventPoint[],
  asOfMs: number
): RollingEventPoint | null {
  let last: RollingEventPoint | null = null;
  let lastMs = -Infinity;
  for (const ev of events) {
    const t = new Date(ev.time).getTime();
    if (!Number.isFinite(t) || t > asOfMs) continue;
    if (t >= lastMs) {
      lastMs = t;
      last = ev;
    }
  }
  return last;
}

/** True when the rolling timeline ends in open work or break at asOfMs. */
export function isOpenWorkOrBreakAt(
  events: RollingEventPoint[],
  asOfMs: number = Date.now()
): boolean {
  const last = getLastRollingEventAt(events, asOfMs);
  return last?.type === "work" || last?.type === "break";
}

export type ShiftRestStatus = {
  consecutiveNonWorkMinutes: number;
  restRunStartedAtMs: number;
};

/**
 * 7h-before-Start-shift gate: rolling non-work since last shift end on the event timeline.
 * Returns null when no gate applies (no prior shift end, or solo resume inside active 17h episode).
 */
export function getShiftRestStatusFromTimeline(
  events: RollingEventPoint[],
  asOfMs: number,
  options?: { allowSeventeenHourEpisodeResume?: boolean }
): ShiftRestStatus | null {
  if (options?.allowSeventeenHourEpisodeResume !== false) {
    const episode = getSeventeenHourEpisodeStatus(events, asOfMs);
    if (episode.canResumeWithoutSevenHourRest) return null;
  }
  const lastEnd = getLastShiftEndTime(events, asOfMs + 1);
  if (lastEnd === null) return null;
  return {
    consecutiveNonWorkMinutes: Math.max(0, Math.floor((asOfMs - lastEnd) / 60000)),
    restRunStartedAtMs: lastEnd,
  };
}

/** Minimum non-work time (hours) required between shifts (e.g. WA 7h). */
const DEFAULT_MIN_NON_WORK_HOURS = 7;

/**
 * Returns an insufficient non-work-time message if, as of asOfMs, non-work time since last stop is below minHours.
 * Returns null if no stop exists or non-work time is sufficient.
 */
export function getInsufficientNonWorkMessage(
  events: RollingEventPoint[],
  asOfMs: number,
  minNonWorkHours: number = DEFAULT_MIN_NON_WORK_HOURS,
  options?: { allowSeventeenHourEpisodeResume?: boolean }
): string | null {
  if (options?.allowSeventeenHourEpisodeResume !== false) {
    const episode = getSeventeenHourEpisodeStatus(events, asOfMs);
    if (episode.canResumeWithoutSevenHourRest) return null;
  }
  const nonWorkHours = getNonWorkHoursSinceLastShiftEnd(events, asOfMs);
  if (nonWorkHours === null) return null;
  if (nonWorkHours >= minNonWorkHours) return null;
  return `Less than ${minNonWorkHours} hours non-work time since last shift. Starting work may not meet non-work time requirements.`;
}

const MS_24H = 24 * 60 * 60 * 1000;
const MIN_NON_WORK_MINUTES_TWO_UP_24H = 7 * 60;

type RollingSegmentKind = "work" | "break" | "non_work";

function openSegmentKindAfterEvent(type: string): RollingSegmentKind {
  if (type === "work") return "work";
  if (type === "break") return "break";
  return "non_work";
}

export type TwoUpRolling24hRestStatus = {
  nonWorkMinutes: number;
  workOrBreakMinutes: number;
  /** Non-work minutes still needed in the rolling 24h window (0 when met). */
  nonWorkMinutesShortfall: number;
};

/**
 * Two-Up Reg 184E(3)(a): ≥7h non-work in any rolling 24h when work/break exists in that window.
 * Returns null when the gate does not apply (no work/break in window, or non-work already ≥7h).
 */
export function getTwoUpRolling24hRestStatus(
  events: RollingEventPoint[],
  asOfMs: number
): TwoUpRolling24hRestStatus | null {
  const windowStart = asOfMs - MS_24H;
  const sorted = [...events]
    .filter((e) => Number.isFinite(new Date(e.time).getTime()))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const lastBefore = getLastRollingEventAt(sorted, windowStart);
  let segKind: RollingSegmentKind = lastBefore ? openSegmentKindAfterEvent(lastBefore.type) : "non_work";
  let segStart = windowStart;

  let nonWorkMinutes = 0;
  let workOrBreakMinutes = 0;

  const addMinutes = (kind: RollingSegmentKind, fromMs: number, toMs: number) => {
    const mins = Math.max(0, Math.floor((toMs - fromMs) / 60000));
    if (kind === "non_work") nonWorkMinutes += mins;
    else workOrBreakMinutes += mins;
  };

  for (const ev of sorted) {
    const t = new Date(ev.time).getTime();
    if (t <= windowStart) continue;
    if (t > asOfMs) break;
    addMinutes(segKind, segStart, t);
    segStart = t;
    segKind = openSegmentKindAfterEvent(ev.type);
  }
  addMinutes(segKind, segStart, asOfMs);

  if (workOrBreakMinutes === 0) return null;

  const shortfall = Math.max(0, MIN_NON_WORK_MINUTES_TWO_UP_24H - nonWorkMinutes);
  if (shortfall === 0) return null;

  return { nonWorkMinutes, workOrBreakMinutes, nonWorkMinutesShortfall: shortfall };
}

/** Prospective warning when Two-Up rolling 24h non-work is below 7h. */
export function getInsufficientTwoUp24hNonWorkMessage(
  events: RollingEventPoint[],
  asOfMs: number
): string | null {
  const status = getTwoUpRolling24hRestStatus(events, asOfMs);
  if (!status) return null;
  return "Less than 7 hours non-work in the rolling 24-hour period. Starting work may not meet Two-Up rest requirements.";
}
