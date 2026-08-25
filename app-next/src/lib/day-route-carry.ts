import type { DayData } from "@/lib/api";
import { getEffectiveOpenActivityAtDayEnd } from "@/lib/event-rollover";
import { isBreakFromDrivingEventType, isOpenShiftEventType } from "@/lib/activity-kind";
import { hasRunPlanContent } from "@/lib/route-plan";
import { getSheetDayDateString } from "@/lib/weeks";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function todayHasLoggedWorkOrBreak(day: DayData | undefined): boolean {
  return (day?.events ?? []).some((e) => e.type === "work" || isBreakFromDrivingEventType(e.type));
}

function previousDayEndedWithOpenWorkOrBreak(
  days: DayData[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string
): boolean {
  if (dayIndex === 0) return false;
  const prev = days[dayIndex - 1];
  if (!prev) return false;
  const dateStrPrev = getSheetDayDateString(weekStarting, dayIndex - 1);
  const open = getEffectiveOpenActivityAtDayEnd(prev, dateStrPrev, todayYmd);
  return isOpenShiftEventType(open);
}

/**
 * Rolling continuation across a calendar-day descriptor: prior bucket still ends open on
 * work/break (no End shift). Day/week labels do not reset the timeline — open activity
 * continues until the next driver-logged event.
 */
export function isTrueShiftContinuation(
  days: DayData[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string
): boolean {
  return previousDayEndedWithOpenWorkOrBreak(days, dayIndex, weekStarting, todayYmd);
}

/**
 * @deprecated Always null. Calendar “forgot End shift on [prior day]” prompts violate the
 * rolling timeline: open work/break continues until the next event; End shift is logged
 * on the timeline at the finish time, not forced onto the prior day card.
 */
export function getPriorDayUnclosedShiftPrompt(
  _days: DayData[],
  _dayIndex: number,
  _weekStarting: string,
  _todayYmd: string
): { previousDayName: string; previousDayIndex: number } | null {
  return null;
}

/**
 * Day card route fields when the previous calendar day still has open work/break
 * (rolling continuation into this descriptor day).
 */
export function getDayWithCarriedOverCardInfo(
  days: DayData[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string
): DayData {
  const day = days[dayIndex] ?? {};
  if (dayIndex === 0) return day;
  const sheetDayYmd = getSheetDayDateString(weekStarting, dayIndex);
  if (sheetDayYmd > todayYmd) return day;
  if (!isTrueShiftContinuation(days, dayIndex, weekStarting, todayYmd)) return day;
  const prev = days[dayIndex - 1];
  const hasOwnRego = (day.truck_rego ?? "").toString().trim() !== "";
  const hasOwnStartLocation = (day.start_location ?? "").toString().trim() !== "";
  const hasOwnDestination = (day.destination ?? "").toString().trim() !== "";
  // A run plan / catalogue preset owns From/To — do not refill from the prior day trip.
  const dayOwnsRoutePlaces =
    !!(day.route_preset_id ?? "").toString().trim() || hasRunPlanContent(day);
  return {
    ...day,
    truck_rego: hasOwnRego ? day.truck_rego : (prev?.truck_rego ?? day.truck_rego ?? ""),
    start_location:
      dayOwnsRoutePlaces || hasOwnStartLocation
        ? day.start_location
        : (prev?.start_location ?? day.start_location ?? ""),
    destination:
      dayOwnsRoutePlaces || hasOwnDestination
        ? day.destination
        : (prev?.destination ?? day.destination ?? ""),
  };
}

/** Prompt driver to confirm route on this day while an open segment continues from the prior day. */
export function getContinuedShiftRoutePrompt(
  days: DayData[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string
): { previousDayName: string } | null {
  const day = days[dayIndex] ?? {};
  const sheetDayYmd = getSheetDayDateString(weekStarting, dayIndex);
  if (sheetDayYmd !== todayYmd) return null;
  if (!isTrueShiftContinuation(days, dayIndex, weekStarting, todayYmd)) return null;
  if (day.route_confirmed) return null;
  return { previousDayName: DAY_NAMES[dayIndex - 1] ?? "previous day" };
}

/** One minute after the last logged segment — preserves rest continuity (not calendar midnight). */
const STOP_AFTER_LAST_EVENT_MS = 60_000;

/**
 * When the prior day was left open, End shift belongs at the end of the last logged work/break,
 * not at midnight (avoids false 7h gaps and clashes with the event record).
 */
export function suggestedEndShiftTimeAfterLastEvent(day: DayData): string | null {
  const events = day.events ?? [];
  const last = events[events.length - 1];
  if (!last || last.type === "stop") return null;
  if (!isOpenShiftEventType(last.type) && last.type !== "non_work") return null;
  const lastMs = new Date(last.time).getTime();
  if (!Number.isFinite(lastMs)) return null;
  return new Date(lastMs + STOP_AFTER_LAST_EVENT_MS).toISOString();
}

/**
 * Programmatic close at suggested last-event time (tests / migration only).
 * Drivers use the end-shift correction dialog, which records end km and a chosen time.
 * @deprecated Prefer applyStopAtCorrectedTime from shift-timeline-correction.ts
 */
export function closePriorDayShiftAfterLastEvent(
  days: DayData[],
  dayIndex: number
): DayData[] {
  if (dayIndex <= 0) return days;
  const prevIdx = dayIndex - 1;
  const prev = days[prevIdx] ?? {};
  const events = [...(prev.events ?? [])];
  if (events[events.length - 1]?.type === "stop") return days;

  const stopIso = suggestedEndShiftTimeAfterLastEvent(prev);
  if (!stopIso) return days;

  const next = [...days];
  next[prevIdx] = { ...prev, events: [...events, { time: stopIso, type: "stop" }] };
  next[dayIndex] = { ...days[dayIndex], route_confirmed: true };
  return next;
}
