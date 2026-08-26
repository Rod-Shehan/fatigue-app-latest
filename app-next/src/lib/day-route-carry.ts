import type { DayData } from "@/lib/api";
import { isBreakFromDrivingEventType, isOpenShiftEventType } from "@/lib/activity-kind";
import { hasRunPlanContent } from "@/lib/route-plan";

export function todayHasLoggedWorkOrBreak(day: DayData | undefined): boolean {
  return (day?.events ?? []).some((e) => e.type === "work" || isBreakFromDrivingEventType(e.type));
}

function lastEventBeforeDayIndex(
  days: DayData[],
  dayIndex: number
): { time: string; type: string } | null {
  let best: { time: string; type: string } | null = null;
  let bestMs = -Infinity;
  for (let i = 0; i < dayIndex; i++) {
    for (const event of days[i]?.events ?? []) {
      const ms = new Date(event.time).getTime();
      if (!Number.isFinite(ms) || ms < bestMs) continue;
      bestMs = ms;
      best = event;
    }
  }
  return best;
}

function dayHasOpenShiftRoute(day: DayData | undefined): boolean {
  if (!day) return false;
  if ((day.truck_rego ?? "").toString().trim() !== "") return true;
  if ((day.start_location ?? "").toString().trim() !== "") return true;
  if ((day.destination ?? "").toString().trim() !== "") return true;
  return hasRunPlanContent(day);
}

/**
 * Last driver event on an earlier descriptor. The shift is still the same while that
 * event is work / rest / other work / passenger / sleeper — End shift (`stop`) closes it.
 * Empty cards in between do not matter. Clock midnight is not consulted.
 */
export function isTrueShiftContinuation(
  days: DayData[],
  dayIndex: number,
  _weekStarting?: string,
  _todayYmd?: string
): boolean {
  if (dayIndex <= 0) return false;
  const last = lastEventBeforeDayIndex(days, dayIndex);
  return isOpenShiftEventType(last?.type);
}

function findOpenShiftRouteSource(days: DayData[], dayIndex: number): DayData | null {
  if (!isTrueShiftContinuation(days, dayIndex)) return null;
  for (let i = dayIndex - 1; i >= 0; i--) {
    const candidate = days[i];
    if (dayHasOpenShiftRoute(candidate)) return candidate ?? null;
    if (i === 0 || !isTrueShiftContinuation(days, i)) return candidate ?? null;
  }
  return null;
}

function copyOpenShiftRoute(day: DayData, source: DayData): DayData {
  const hasOwnRego = (day.truck_rego ?? "").toString().trim() !== "";
  const hasOwnStartLocation = (day.start_location ?? "").toString().trim() !== "";
  const hasOwnDestination = (day.destination ?? "").toString().trim() !== "";
  const dayOwnsRoutePlaces =
    !!(day.route_preset_id ?? "").toString().trim() || hasRunPlanContent(day);
  const next: DayData = {
    ...day,
    truck_rego: hasOwnRego ? day.truck_rego : (source.truck_rego ?? day.truck_rego ?? ""),
    start_location:
      dayOwnsRoutePlaces || hasOwnStartLocation
        ? day.start_location
        : (source.start_location ?? day.start_location ?? ""),
    destination:
      dayOwnsRoutePlaces || hasOwnDestination
        ? day.destination
        : (source.destination ?? day.destination ?? ""),
  };
  if (!dayOwnsRoutePlaces && hasRunPlanContent(source)) {
    next.route_label = source.route_label;
    next.planned_distance_km = source.planned_distance_km;
    next.planned_on_duty_hours = source.planned_on_duty_hours;
    next.route_source = source.route_source;
    next.route_preset_id = source.route_preset_id;
  }
  return next;
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
 * Display/PDF only: rego and route stay on the open shift. Later day-card labels show
 * the same fields until End shift. Does not persist, and does not invent a midnight cut.
 */
export function getDayWithCarriedOverCardInfo(
  days: DayData[],
  dayIndex: number,
  _weekStarting?: string,
  _todayYmd?: string
): DayData {
  const day = days[dayIndex] ?? {};
  if (dayIndex === 0) return day;
  const source = findOpenShiftRouteSource(days, dayIndex);
  if (!source) return day;
  return copyOpenShiftRoute(day, source);
}

/** Apply open-shift rego/route onto every descriptor for PDF / week chrome (not persisted). */
export function daysWithOpenShiftRoute<T extends DayData>(
  days: T[],
  _weekStarting?: string,
  _todayYmd?: string
): T[] {
  return days.map((_, i) => getDayWithCarriedOverCardInfo(days, i) as T);
}

/**
 * @deprecated Always null. Requiring a new day’s route confirm because the clock rolled
 * treats midnight as a shift cut. Rego and route stay on the open shift.
 */
export function getContinuedShiftRoutePrompt(
  _days: DayData[],
  _dayIndex: number,
  _weekStarting: string,
  _todayYmd: string
): { previousDayName: string } | null {
  return null;
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
