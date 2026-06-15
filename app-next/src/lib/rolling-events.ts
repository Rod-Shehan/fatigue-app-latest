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
 * Events in chronological order for a single driver (two-up) or all events (solo).
 * Missing driver on an event is treated as primary.
 */
export function getEventsForDriverInOrder(
  days: TimelineSlice[],
  activeDriver?: "primary" | "second"
): { time: string; type: string }[] {
  const ordered = getEventsInTimeOrder(days);
  const filtered =
    activeDriver === undefined
      ? ordered
      : ordered.filter((ev) => (ev.driver ?? "primary") === activeDriver);
  return filtered.map(({ time, type }) => ({ time, type }));
}

/**
 * Last "stop" (end shift) time in ms before optional cutoff, or null if none.
 */
export function getLastStopTime(events: RollingEvent[], beforeTimeMs?: number): number | null {
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
export function getLastShiftEndTime(events: RollingEvent[], beforeTimeMs?: number): number | null {
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
export function getNonWorkHoursSinceLastStop(events: RollingEvent[], asOfMs: number): number | null {
  const lastStop = getLastStopTime(events, asOfMs + 1);
  if (lastStop === null) return null;
  return (asOfMs - lastStop) / (3600 * 1000);
}

/**
 * Non-work time (hours) since the last shift end marker (stop or non_work), as of asOfMs.
 * Returns null if none exists (no shift end marker recorded).
 */
export function getNonWorkHoursSinceLastShiftEnd(events: RollingEvent[], asOfMs: number): number | null {
  const lastEnd = getLastShiftEndTime(events, asOfMs + 1);
  if (lastEnd === null) return null;
  return (asOfMs - lastEnd) / (3600 * 1000);
}

/** Non-work minutes since the last shift end marker (stop or non_work), rolling from event time. */
export function getNonWorkMinutesSinceLastShiftEnd(
  events: RollingEvent[],
  asOfMs: number
): number | null {
  const lastEnd = getLastShiftEndTime(events, asOfMs + 1);
  if (lastEnd === null) return null;
  return Math.max(0, Math.floor((asOfMs - lastEnd) / 60000));
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
  events: RollingEvent[],
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
  events: RollingEvent[],
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
