import type { DayData } from "@/lib/api";
import { getEffectiveOpenActivityAtDayEnd } from "@/components/fatigue/EventLogger";
import { getSheetDayDateString } from "@/lib/weeks";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  return getEffectiveOpenActivityAtDayEnd(prev, dateStrPrev, todayYmd) != null;
}

/**
 * Day card route fields when the previous calendar day ended with open work/break
 * (same end-of-day rule as deriveDaysWithRollover). Display-only until the driver confirms route on this day.
 */
export function getDayWithCarriedOverCardInfo(
  days: DayData[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string
): DayData {
  const day = days[dayIndex] ?? {};
  if (dayIndex === 0) return day;
  if (!previousDayEndedWithOpenWorkOrBreak(days, dayIndex, weekStarting, todayYmd)) return day;
  const prev = days[dayIndex - 1];
  const hasOwnRego = (day.truck_rego ?? "").toString().trim() !== "";
  const hasOwnStartLocation = (day.start_location ?? "").toString().trim() !== "";
  const hasOwnDestination = (day.destination ?? "").toString().trim() !== "";
  const hasOwnStartKms = day.start_kms != null && !Number.isNaN(Number(day.start_kms));
  return {
    ...day,
    truck_rego: hasOwnRego ? day.truck_rego : (prev?.truck_rego ?? day.truck_rego ?? ""),
    start_location: hasOwnStartLocation
      ? day.start_location
      : (prev?.start_location ?? day.start_location ?? ""),
    destination: hasOwnDestination ? day.destination : (prev?.destination ?? day.destination ?? ""),
    start_kms: hasOwnStartKms ? day.start_kms : (prev?.start_kms ?? day.start_kms),
  };
}

/** Prompt driver to confirm route on this day after an overnight shift continuation. */
export function getContinuedShiftRoutePrompt(
  days: DayData[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string
): { previousDayName: string } | null {
  const day = days[dayIndex] ?? {};
  if (!previousDayEndedWithOpenWorkOrBreak(days, dayIndex, weekStarting, todayYmd)) return null;
  if (day.route_confirmed) return null;
  return { previousDayName: DAY_NAMES[dayIndex - 1] ?? "previous day" };
}
