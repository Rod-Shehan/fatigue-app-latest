/**
 * When a driver backdates End shift on a prior day, Work/Break (and the orphan bout)
 * left on later day cards are not a new driver-started shift — remove them so the
 * record does not invent events after the closing stop.
 *
 * RULE IP — owner-approved: orphans after prior-day End shift must not remain.
 * @see .cursor/rules/time-rules-ip.mdc / rolling-timeline.mdc
 */

import type { DayData } from "@/lib/api";
import { getEventsInTimeOrder, type TimelineSlice } from "@/lib/rolling-events";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type OrphanFollowOnRemoval = {
  dayIndex: number;
  dayName: string;
  time: string;
  type: string;
};

function eventKey(dayIndex: number, time: string, type: string): string {
  return `${dayIndex}|${time}|${type}`;
}

/**
 * Latest End shift (`stop`) present on `after` that was not on `before`
 * (new stop added in Edit day / End shift correction).
 */
export function findNewlyAddedStopIso(
  before: DayData | undefined,
  after: DayData | undefined
): string | null {
  const beforeStops = new Set(
    (before?.events ?? []).filter((e) => e.type === "stop").map((e) => e.time)
  );
  const newStops = (after?.events ?? []).filter((e) => e.type === "stop" && !beforeStops.has(e.time));
  if (newStops.length === 0) return null;
  newStops.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return newStops[newStops.length - 1]?.time ?? null;
}

/**
 * After a closing stop at `stopTimeIso`, remove the next contiguous orphan bout:
 * work / break / non_work, and a trailing stop that only ends that bout.
 * Later intentional events (after that trailing stop) are kept.
 */
export function pruneOrphanFollowOnEventsAfterStop(
  days: DayData[],
  stopTimeIso: string
): { days: DayData[]; removed: OrphanFollowOnRemoval[] } {
  const stopMs = new Date(stopTimeIso).getTime();
  if (!Number.isFinite(stopMs)) return { days, removed: [] };

  const ordered = getEventsInTimeOrder(days as TimelineSlice[]);
  const startIdx = ordered.findIndex((ev) => {
    const t = new Date(ev.time).getTime();
    return Number.isFinite(t) && t > stopMs;
  });
  if (startIdx < 0) return { days, removed: [] };

  const removeKeys = new Set<string>();
  const removed: OrphanFollowOnRemoval[] = [];

  for (let i = startIdx; i < ordered.length; i++) {
    const ev = ordered[i]!;
    if (ev.type === "stop") {
      removeKeys.add(eventKey(ev.dayIndex, ev.time, ev.type));
      removed.push({
        dayIndex: ev.dayIndex,
        dayName: DAY_NAMES[ev.dayIndex] ?? `Day ${ev.dayIndex}`,
        time: ev.time,
        type: ev.type,
      });
      break;
    }
    if (ev.type === "work" || ev.type === "break" || ev.type === "other_work" || ev.type === "non_work") {
      removeKeys.add(eventKey(ev.dayIndex, ev.time, ev.type));
      removed.push({
        dayIndex: ev.dayIndex,
        dayName: DAY_NAMES[ev.dayIndex] ?? `Day ${ev.dayIndex}`,
        time: ev.time,
        type: ev.type,
      });
      continue;
    }
    break;
  }

  if (removeKeys.size === 0) return { days, removed: [] };

  const next = days.map((day, dayIndex) => {
    const events = day.events ?? [];
    const filtered = events.filter((ev) => !removeKeys.has(eventKey(dayIndex, ev.time, ev.type)));
    if (filtered.length === events.length) return day;
    return { ...day, events: filtered };
  });

  return { days: next, removed };
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  work: "Work",
  break: "Rest",
  other_work: "Other work",
  non_work: "Non-work",
  stop: "End shift",
};

/** True when a day still shows follow-on work/break (events or painted grids). */
export function dayHasFollowOnActivity(day: DayData | undefined): boolean {
  if (!day) return false;
  if ((day.events ?? []).some((e) => e.type === "work" || e.type === "break" || e.type === "other_work" || e.type === "non_work")) {
    return true;
  }
  if ((day.work_time ?? []).some(Boolean)) return true;
  if ((day.breaks ?? []).some(Boolean)) return true;
  return false;
}

/** Driver-facing note after orphan follow-on events were cleared. */
export function formatOrphanFollowOnClearedMessage(
  removed: OrphanFollowOnRemoval[],
  options?: { paintCleared?: boolean }
): string {
  if (removed.length === 0) {
    return options?.paintCleared
      ? "Cleared continued work on the next day that belonged to the shift you just ended."
      : "";
  }
  const actionable = removed.filter((r) => r.type === "work" || r.type === "break" || r.type === "other_work" || r.type === "non_work");
  const focus = actionable.length > 0 ? actionable : removed;
  const parts = focus.map((r) => {
    const label = EVENT_TYPE_LABEL[r.type] ?? r.type;
    return `${r.dayName} ${label}`;
  });
  if (parts.length === 1) {
    return `Removed ${parts[0]} that belonged to the shift you just ended.`;
  }
  if (parts.length === 2) {
    return `Removed ${parts[0]} and ${parts[1]} that belonged to the shift you just ended.`;
  }
  const last = parts[parts.length - 1];
  return `Removed ${parts.slice(0, -1).join(", ")}, and ${last} that belonged to the shift you just ended.`;
}
