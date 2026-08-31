import type { DayData } from "@/lib/api";
import { isOpenShiftEventType } from "@/lib/activity-kind";
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

/** Open shift on the rolling timeline (includes two-up passenger / sleeper / Parked). */

/**
 * @deprecated Prefer {@link timelineHasOpenWorkOrBreak}. Calendar-day last-event
 * checks are not the End shift gate on a rolling timeline.
 */
export function dayHasOpenWorkOrBreakSegment(day: DayData | undefined): boolean {
  const events = day?.events ?? [];
  const last = events[events.length - 1];
  return !!last && isOpenShiftEventType(last.type);
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
  if (!last || !isOpenShiftEventType(last.type)) return null;
  const match = [...ordered].reverse().find((ev) => ev.time === last.time && ev.type === last.type);
  return match ?? null;
}

/**
 * First Work that opened the current open shift (after the last End shift), or the
 * current open work/break if no Work is found. Day-card paint on later days is not an event.
 * Used for End shift finish-date min bound — not a timeline rule change.
 */
export function findOpenShiftEpisodeStart(
  days: TimelineSlice[],
  asOfMs: number = Date.now()
): RollingEvent | null {
  const open = findOpenWorkOrBreakOnTimeline(days, asOfMs);
  if (!open) return null;
  const ordered = getEventsInTimeOrder(days);
  const openMs = new Date(open.time).getTime();
  if (!Number.isFinite(openMs)) return open;

  let lastStopMs = -Infinity;
  for (const ev of ordered) {
    const t = new Date(ev.time).getTime();
    if (!Number.isFinite(t) || t >= openMs) break;
    if (ev.type === "stop") lastStopMs = t;
  }

  for (const ev of ordered) {
    const t = new Date(ev.time).getTime();
    if (!Number.isFinite(t) || t <= lastStopMs) continue;
    if (t > openMs) break;
    if (ev.type === "work") return ev;
  }
  return open;
}

export type OpenShiftMetadata = {
  /** Card that stores this shift's start km and rego. */
  metadataDayIndex: number;
  startKms: number | null;
  truckRego: string;
};

function finiteShiftKm(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

/**
 * Start km and rego belong to the open shift, not the day card of the last event.
 * One shift → one start km. Later rest/drive on the next label does not start a new reading.
 */
export function resolveOpenShiftMetadata(
  days: Array<{ start_kms?: number | null; truck_rego?: string | null }>,
  episodeStartDayIndex: number | null,
  fallbackDayIndex: number
): OpenShiftMetadata {
  const home = episodeStartDayIndex ?? fallbackDayIndex;
  let startKms = finiteShiftKm(days[home]?.start_kms);
  if (startKms == null) {
    for (let i = home + 1; i < days.length; i++) {
      startKms = finiteShiftKm(days[i]?.start_kms);
      if (startKms != null) break;
    }
  }
  return {
    metadataDayIndex: home,
    startKms,
    truckRego: (days[home]?.truck_rego ?? "").trim(),
  };
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
      return last && isOpenShiftEventType(last.type) ? last.time : null;
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
  /**
   * Day card that holds start km for this open shift. End km is written here
   * (driver habit: end km on the day the shift started, even if finish time is next morning).
   * Defaults to the stop's dayIndex.
   */
  endKmsDayIndex?: number;
  /** GPS pin at End shift — required for two-up 184E(3)(b) credit. */
  lat?: number;
  lng?: number;
  accuracy?: number;
  history_1m?: Array<{ lat: number; lng: number; t: string }>;
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

  const stopEvent: NonNullable<DayData["events"]>[number] = { time: stopTimeIso, type: "stop" };
  if (typeof options?.lat === "number" && Number.isFinite(options.lat)) stopEvent.lat = options.lat;
  if (typeof options?.lng === "number" && Number.isFinite(options.lng)) stopEvent.lng = options.lng;
  if (typeof options?.accuracy === "number" && Number.isFinite(options.accuracy)) {
    stopEvent.accuracy = options.accuracy;
  }
  if (options?.history_1m && options.history_1m.length > 0) stopEvent.history_1m = options.history_1m;
  events.push(stopEvent);
  const { assume_idle_from: _drop, ...rest } = d;
  const next = [...days];
  const kmIdx =
    options?.endKmsDayIndex != null &&
    options.endKmsDayIndex >= 0 &&
    options.endKmsDayIndex < next.length
      ? options.endKmsDayIndex
      : dayIndex;

  if (kmIdx === dayIndex) {
    next[dayIndex] = { ...rest, events, end_kms: endKms };
  } else {
    // Stop on the finish-date card; end km on the open-shift start card.
    next[dayIndex] = { ...rest, events };
    const kmDay = next[kmIdx] ?? {};
    next[kmIdx] = { ...kmDay, end_kms: endKms };
  }

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
