import type { DayData } from "@/lib/api";
import { getEffectiveOpenActivityAtDayEnd } from "@/components/fatigue/EventLogger";
import { getSheetDayDateString } from "@/lib/weeks";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function todayHasLoggedWorkOrBreak(day: DayData | undefined): boolean {
  return (day?.events ?? []).some((e) => e.type === "work" || e.type === "break");
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
  return open === "work" || open === "break";
}

/**
 * True overnight continuation: prior day still open on work/break AND driver has logged work/break today.
 * Auto-filled non-work on today alone does not count as continuation.
 */
export function isTrueShiftContinuation(
  days: DayData[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string
): boolean {
  if (!previousDayEndedWithOpenWorkOrBreak(days, dayIndex, weekStarting, todayYmd)) return false;
  return todayHasLoggedWorkOrBreak(days[dayIndex]);
}

/**
 * Prior calendar day still open (no End shift) but today is non-work / idle so far — common forgot-to-end case.
 */
export function getPriorDayUnclosedShiftPrompt(
  days: DayData[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string
): { previousDayName: string; previousDayIndex: number } | null {
  const sheetDayYmd = getSheetDayDateString(weekStarting, dayIndex);
  if (sheetDayYmd !== todayYmd) return null;
  if (dayIndex === 0) return null;
  if (!previousDayEndedWithOpenWorkOrBreak(days, dayIndex, weekStarting, todayYmd)) return null;
  if (isTrueShiftContinuation(days, dayIndex, weekStarting, todayYmd)) return null;
  const day = days[dayIndex] ?? {};
  if (day.route_confirmed) return null;
  return {
    previousDayName: DAY_NAMES[dayIndex - 1] ?? "previous day",
    previousDayIndex: dayIndex - 1,
  };
}

/**
 * Day card route fields when the previous calendar day ended with open work/break
 * and the driver has continued with work/break today.
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
  return {
    ...day,
    truck_rego: hasOwnRego ? day.truck_rego : (prev?.truck_rego ?? day.truck_rego ?? ""),
    start_location: hasOwnStartLocation
      ? day.start_location
      : (prev?.start_location ?? day.start_location ?? ""),
    destination: hasOwnDestination ? day.destination : (prev?.destination ?? day.destination ?? ""),
  };
}

/** Prompt driver to confirm route on this day after a genuine overnight shift continuation. */
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
  if (last.type !== "work" && last.type !== "break" && last.type !== "non_work") return null;
  const lastMs = new Date(last.time).getTime();
  if (!Number.isFinite(lastMs)) return null;
  return new Date(lastMs + STOP_AFTER_LAST_EVENT_MS).toISOString();
}

/**
 * Append End shift on the previous day immediately after the last logged event.
 * Marks today as route-confirmed (non-work day — no route carry needed).
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
