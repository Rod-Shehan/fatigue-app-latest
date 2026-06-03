import type { DayData } from "@/lib/api";
import { getDayWithCarriedOverCardInfo } from "@/lib/day-route-carry";
import { getSheetDayDateString } from "@/lib/weeks";

/** Repeat-route fields — never includes odometer (start/end km). */
export type DriverRouteDefaults = {
  truck_rego?: string;
  start_location?: string;
  destination?: string;
  shift_label?: "A" | "B" | "";
  route_label?: string;
  planned_distance_km?: number | null;
  planned_on_duty_hours?: number | null;
};

const STORAGE_PREFIX = "circadia-driver-route-defaults:";

function hasAutofillableValue(defaults: DriverRouteDefaults): boolean {
  return (
    !!(defaults.truck_rego ?? "").trim() ||
    !!(defaults.start_location ?? "").trim() ||
    !!(defaults.destination ?? "").trim() ||
    !!(defaults.route_label ?? "").trim() ||
    defaults.planned_distance_km != null ||
    defaults.planned_on_duty_hours != null ||
    !!defaults.shift_label
  );
}

export function driverRouteDefaultsStorageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey.trim().toLowerCase()}`;
}

export function loadDriverRouteDefaults(userKey: string): DriverRouteDefaults | null {
  if (typeof window === "undefined" || !userKey.trim()) return null;
  try {
    const raw = localStorage.getItem(driverRouteDefaultsStorageKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DriverRouteDefaults;
    return hasAutofillableValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDriverRouteDefaults(userKey: string, source: Partial<DayData>): void {
  if (typeof window === "undefined" || !userKey.trim()) return;
  const next = extractDriverRouteDefaults(source);
  if (!next) return;
  try {
    localStorage.setItem(driverRouteDefaultsStorageKey(userKey), JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

/** From a saved day — omits start_kms / end_kms on purpose. */
export function extractDriverRouteDefaults(source: Partial<DayData>): DriverRouteDefaults | null {
  const truck_rego = (source.truck_rego ?? "").toString().trim();
  const start_location = (source.start_location ?? "").toString().trim();
  const destination = (source.destination ?? "").toString().trim();
  const route_label = (source.route_label ?? "").toString().trim();
  const shift_label = source.shift_label === "A" || source.shift_label === "B" ? source.shift_label : "";
  const planned_distance_km =
    source.planned_distance_km != null && !Number.isNaN(Number(source.planned_distance_km))
      ? Number(source.planned_distance_km)
      : null;
  const planned_on_duty_hours =
    source.planned_on_duty_hours != null && !Number.isNaN(Number(source.planned_on_duty_hours))
      ? Number(source.planned_on_duty_hours)
      : null;

  const out: DriverRouteDefaults = {};
  if (truck_rego) out.truck_rego = truck_rego;
  if (start_location) out.start_location = start_location;
  if (destination) out.destination = destination;
  if (route_label) out.route_label = route_label;
  if (shift_label) out.shift_label = shift_label;
  if (planned_distance_km != null) out.planned_distance_km = planned_distance_km;
  if (planned_on_duty_hours != null) out.planned_on_duty_hours = planned_on_duty_hours;

  return hasAutofillableValue(out) ? out : null;
}

/** Most recent prior day in this week with route fields (same sheet). */
export function findLastRouteDefaultsFromDays(
  days: DayData[],
  beforeDayIndex: number
): DriverRouteDefaults | null {
  for (let i = beforeDayIndex - 1; i >= 0; i--) {
    const extracted = extractDriverRouteDefaults(days[i] ?? {});
    if (extracted) return extracted;
  }
  return null;
}

/** In-week defaults beat login-stored defaults (yesterday on this sheet wins). */
export function mergeRouteDefaults(
  stored: DriverRouteDefaults | null,
  fromWeek: DriverRouteDefaults | null
): DriverRouteDefaults | null {
  const merged: DriverRouteDefaults = { ...(stored ?? {}), ...(fromWeek ?? {}) };
  return hasAutofillableValue(merged) ? merged : null;
}

export function applyDriverRouteDefaultsToDay<T extends DayData>(
  day: T,
  defaults: DriverRouteDefaults | null
): T {
  if (!defaults) return day;

  const pickStr = (current: string | undefined, fallback: string | undefined) => {
    const c = (current ?? "").trim();
    if (c) return current;
    const f = (fallback ?? "").trim();
    return f || current;
  };

  const pickNum = (current: number | null | undefined, fallback: number | null | undefined) => {
    if (current != null && !Number.isNaN(Number(current))) return current;
    if (fallback != null && !Number.isNaN(Number(fallback))) return fallback;
    return current;
  };

  const truck_rego = pickStr(day.truck_rego, defaults.truck_rego);
  const start_location = pickStr(day.start_location, defaults.start_location);
  const destination = pickStr(day.destination, defaults.destination);
  const route_label = pickStr(day.route_label, defaults.route_label);
  const shift_label =
    day.shift_label === "A" || day.shift_label === "B"
      ? day.shift_label
      : defaults.shift_label || day.shift_label;

  const appliedAny =
    !!(truck_rego ?? "").trim() !== !!(day.truck_rego ?? "").trim() ||
    !!(start_location ?? "").trim() !== !!(day.start_location ?? "").trim() ||
    !!(destination ?? "").trim() !== !!(day.destination ?? "").trim() ||
    (defaults.route_label && !(day.route_label ?? "").trim()) ||
    (defaults.shift_label && !day.shift_label) ||
    (defaults.planned_distance_km != null && day.planned_distance_km == null) ||
    (defaults.planned_on_duty_hours != null && day.planned_on_duty_hours == null);

  return {
    ...day,
    truck_rego,
    start_location,
    destination,
    route_label: route_label || day.route_label,
    shift_label,
    planned_distance_km: pickNum(day.planned_distance_km, defaults.planned_distance_km),
    planned_on_duty_hours: pickNum(day.planned_on_duty_hours, defaults.planned_on_duty_hours),
    ...(appliedAny && !day.route_source ? { route_source: "driver_saved" as const } : null),
  };
}

export function dayNeedsRouteAutofill(day: DayData): boolean {
  const hasRego = !!(day.truck_rego ?? "").trim();
  const hasFrom = !!(day.start_location ?? "").trim();
  const hasTo = !!(day.destination ?? "").trim();
  const hasPlan =
    !!(day.route_label ?? "").trim() ||
    day.planned_on_duty_hours != null ||
    day.planned_distance_km != null;
  return !(hasRego && hasFrom && hasTo) || !hasPlan;
}

/** Overnight carry, then this-week history, then per-login stored defaults. */
export function getDayWithMergedRouteContext<T extends DayData>(
  days: T[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string,
  storedDefaults: DriverRouteDefaults | null
): T {
  const carried = getDayWithCarriedOverCardInfo(days, dayIndex, weekStarting, todayYmd) as T;
  const sheetDayYmd = getSheetDayDateString(weekStarting, dayIndex);
  if (sheetDayYmd < todayYmd) return carried;

  const weekDefaults = findLastRouteDefaultsFromDays(days, dayIndex);
  const merged = mergeRouteDefaults(storedDefaults, weekDefaults);
  return applyDriverRouteDefaultsToDay(carried, merged);
}

/** Apply defaults to today and future days in the week (not past days). */
export function applyRouteDefaultsToWeekDays<T extends DayData>(
  days: T[],
  weekStarting: string,
  todayYmd: string,
  storedDefaults: DriverRouteDefaults | null
): { days: T[]; changed: boolean } {
  let changed = false;
  const next = days.map((day, idx) => {
    const sheetDayYmd = getSheetDayDateString(weekStarting, idx);
    if (sheetDayYmd < todayYmd) return day;
    if (!dayNeedsRouteAutofill(day)) return day;
    const withContext = getDayWithMergedRouteContext(days, idx, weekStarting, todayYmd, storedDefaults);
    if (JSON.stringify(withContext) !== JSON.stringify(day)) {
      changed = true;
      return withContext;
    }
    return day;
  });
  return { days: next, changed };
}

export function hasRouteExceptKms(day: DayData): boolean {
  return (
    !!(day.truck_rego ?? "").trim() &&
    !!(day.start_location ?? "").trim() &&
    !!(day.destination ?? "").trim()
  );
}
