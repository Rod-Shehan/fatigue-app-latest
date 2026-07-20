import type { DayData } from "@/lib/api";
import {
  getEventsInTimeOrder,
  getLastRollingEventAt,
  isOpenWorkOrBreakAt,
  type RollingEvent,
  type TimelineSlice,
} from "@/lib/rolling-events";
import { sheetDayEndMs } from "@/lib/sheet-day-time";

export type CorrectEndShiftValidation =
  | { valid: true }
  | { valid: false; message: string };

const OPEN_SEGMENT_TYPES = new Set(["work", "break"]);

/**
 * @deprecated Prefer {@link timelineHasOpenWorkOrBreak}. Calendar-day last-event
 * checks are not the End shift gate on a rolling timeline.
 */
export function dayHasOpenWorkOrBreakSegment(day: DayData | undefined): boolean {
  const events = day?.events ?? [];
  const last = events[events.length - 1];
  return !!last && OPEN_SEGMENT_TYPES.has(last.type);
}

/** Rolling timeline has an open work/break segment at asOfMs (End shift may close it). */
export function timelineHasOpenWorkOrBreak(
  days: TimelineSlice[],
  asOfMs: number = Date.now()
): boolean {
  const ordered = getEventsInTimeOrder(days).map(({ time, type }) => ({ time, type }));
  return isOpenWorkOrBreakAt(ordered, asOfMs);
}

/**
 * Day card that holds the last open work/break event on the rolling timeline.
 * Day index is a storage/display bucket only — not a timeline boundary.
 */
export function findOpenWorkOrBreakOnTimeline(
  days: TimelineSlice[],
  asOfMs: number = Date.now()
): RollingEvent | null {
  const ordered = getEventsInTimeOrder(days);
  const last = getLastRollingEventAt(
    ordered.map(({ time, type }) => ({ time, type })),
    asOfMs
  );
  if (!last || (last.type !== "work" && last.type !== "break")) return null;
  const match = [...ordered].reverse().find((ev) => ev.time === last.time && ev.type === last.type);
  return match ?? null;
}

export const END_SHIFT_ALREADY_ENDED_MESSAGE =
  "Your shift already ended on the record. Tap Start shift when you begin work again.";

export const END_SHIFT_NO_OPEN_MESSAGE =
  "There is no open work or break on your timeline to end. Tap Start shift when you begin work.";

/**
 * Validate a driver-chosen end-shift time against the rolling timeline.
 * `sheetDayYmd` is only the day-card bucket where the stop event will be stored
 * for display — it does not invent a midnight reset.
 */
export function validateCorrectEndShiftTime(
  day: DayData | undefined,
  sheetDayYmd: string,
  chosenIso: string,
  asOfMs: number = Date.now(),
  options?: {
    /** Last open work/break time on the rolling timeline (preferred over day-local last). */
    lastOpenEventIso?: string | null;
  }
): CorrectEndShiftValidation {
  const lastOpenIso =
    options?.lastOpenEventIso ??
    (() => {
      const events = day?.events ?? [];
      const last = events[events.length - 1];
      return last && OPEN_SEGMENT_TYPES.has(last.type) ? last.time : null;
    })();

  if (!lastOpenIso) {
    return { valid: false, message: END_SHIFT_NO_OPEN_MESSAGE };
  }

  const chosenMs = new Date(chosenIso).getTime();
  if (!Number.isFinite(chosenMs)) {
    return { valid: false, message: "Enter a valid end time." };
  }

  const lastMs = new Date(lastOpenIso).getTime();
  if (!Number.isFinite(lastMs) || chosenMs <= lastMs) {
    return {
      valid: false,
      message: "End time must be after your last logged work or break.",
    };
  }

  if (chosenMs > asOfMs) {
    return { valid: false, message: "End time cannot be in the future." };
  }

  // Soft display bound: stop is stored on this day card — finish time should not
  // be long after that card's clock end (same as before for same-day finishes).
  const dayEnd = sheetDayEndMs(sheetDayYmd);
  if (chosenMs > dayEnd) {
    return {
      valid: false,
      message: "End time is after this day's record ends — pick a finish time on the card that holds this End shift.",
    };
  }

  return { valid: true };
}

export type ApplyStopAtCorrectedTimeOptions = {
  /** When closing an open segment on the prior sheet day, mark route confirmed on this day index. */
  markRouteConfirmedOnDayIndex?: number;
};

/**
 * Append an end-shift event at the driver-chosen time and clear any legacy assume-idle cap.
 * Returns a new days array; does not re-derive grids (caller runs deriveDaysWithRollover).
 * `dayIndex` is the display bucket for the stop event (usually the card matching finish time).
 */
export function applyStopAtCorrectedTime(
  days: DayData[],
  dayIndex: number,
  stopTimeIso: string,
  endKms: number,
  options?: ApplyStopAtCorrectedTimeOptions
): DayData[] {
  const d = days[dayIndex] ?? {};
  const events = [...(d.events ?? [])];
  if (events[events.length - 1]?.type === "stop") return days;

  events.push({ time: stopTimeIso, type: "stop" });
  const { assume_idle_from: _drop, ...rest } = d;
  const next = [...days];
  next[dayIndex] = { ...rest, events, end_kms: endKms };

  const confirmIdx = options?.markRouteConfirmedOnDayIndex;
  if (confirmIdx != null && confirmIdx >= 0 && confirmIdx < next.length) {
    next[confirmIdx] = { ...next[confirmIdx], route_confirmed: true };
  }

  return next;
}

/** When ending shift on dayIndex from today's card (prior open segment), confirm route on todayIndex. */
export function routeConfirmDayAfterPriorEndShift(
  dayIndex: number,
  todayDayIndex: number
): number | undefined {
  return dayIndex === todayDayIndex - 1 && todayDayIndex > 0 ? todayDayIndex : undefined;
}
