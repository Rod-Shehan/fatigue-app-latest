/**
 * Rolling time model: events are a single continuous timeline.
 * Days are only used to know "where" events came from (for display); rules use time only.
 */

export type RollingEvent = {
  time: string;
  type: string;
  dayIndex: number;
  driver?: "primary" | "second";
};

type DayWithEvents = { events?: { time: string; type: string; driver?: "primary" | "second" }[] };

/**
 * Flatten all events from all days and sort by time (ascending).
 * Each event gets dayIndex so callers can still attribute to a day for display.
 */
export function getEventsInTimeOrder(days: DayWithEvents[]): RollingEvent[] {
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
  days: DayWithEvents[],
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
 * Non-work time (hours) since the last stop event, as of asOfMs.
 * Returns null if there has never been a stop (no "last shift").
 */
export function getNonWorkHoursSinceLastStop(events: RollingEvent[], asOfMs: number): number | null {
  const lastStop = getLastStopTime(events, asOfMs + 1);
  if (lastStop === null) return null;
  return (asOfMs - lastStop) / (3600 * 1000);
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
  minNonWorkHours: number = DEFAULT_MIN_NON_WORK_HOURS
): string | null {
  const nonWorkHours = getNonWorkHoursSinceLastStop(events, asOfMs);
  if (nonWorkHours === null) return null;
  if (nonWorkHours >= minNonWorkHours) return null;
  return `Less than ${minNonWorkHours} hours non-work time since last shift. Starting work may not meet non-work time requirements.`;
}
