import type { DayData } from "@/lib/api";
import { sheetDayEndMs } from "@/lib/sheet-day-time";

export type CorrectEndShiftValidation =
  | { valid: true }
  | { valid: false; message: string };

const OPEN_SEGMENT_TYPES = new Set(["work", "break"]);

/** Last event on this day is open work or break (no end-shift marker yet). */
export function dayHasOpenWorkOrBreakSegment(day: DayData | undefined): boolean {
  const events = day?.events ?? [];
  const last = events[events.length - 1];
  return !!last && OPEN_SEGMENT_TYPES.has(last.type);
}

/**
 * Validate a driver-chosen end-shift time on a sheet calendar day.
 * Rules use event timestamps on the rolling timeline — not calendar rollovers.
 */
export function validateCorrectEndShiftTime(
  day: DayData | undefined,
  sheetDayYmd: string,
  chosenIso: string,
  asOfMs: number = Date.now()
): CorrectEndShiftValidation {
  if (!dayHasOpenWorkOrBreakSegment(day)) {
    return { valid: false, message: "This day has no open work or break segment to end." };
  }

  const chosenMs = new Date(chosenIso).getTime();
  if (!Number.isFinite(chosenMs)) {
    return { valid: false, message: "Enter a valid end time." };
  }

  const events = day?.events ?? [];
  const last = events[events.length - 1]!;
  const lastMs = new Date(last.time).getTime();
  if (chosenMs <= lastMs) {
    return {
      valid: false,
      message: "End time must be after your last logged event on this day.",
    };
  }

  const maxMs = Math.min(asOfMs, sheetDayEndMs(sheetDayYmd));
  if (chosenMs > maxMs) {
    return { valid: false, message: "End time cannot be in the future." };
  }

  const dayStartMs = new Date(`${sheetDayYmd}T00:00:00`).getTime();
  if (chosenMs < dayStartMs) {
    return { valid: false, message: "End time must fall on this day's record." };
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
