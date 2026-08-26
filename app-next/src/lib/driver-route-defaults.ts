import type { DayData } from "@/lib/api";
import { getDayWithCarriedOverCardInfo, isTrueShiftContinuation } from "@/lib/day-route-carry";
import { hasRunPlanContent, type RouteSource } from "@/lib/route-plan";
import { getSheetDayDateString } from "@/lib/weeks";

/** Which route setup the driver used last — carry forward one mode, not both. */
export type RouteCarryMode = "manual" | "run_plan";

/** Repeat-route fields — never includes odometer (start/end km). */
export type DriverRouteDefaults = {
  carry_mode?: RouteCarryMode;
  truck_rego?: string;
  start_location?: string;
  destination?: string;
  shift_label?: "A" | "B" | "";
  route_label?: string;
  planned_distance_km?: number | null;
  planned_on_duty_hours?: number | null;
  route_preset_id?: string;
  route_source?: RouteSource;
};

const STORAGE_PREFIX = "circadia-driver-route-defaults:";

export function inferRouteCarryMode(source: Partial<DayData>): RouteCarryMode {
  if ((source.route_preset_id ?? "").trim()) return "run_plan";
  if (hasRunPlanContent(source)) return "run_plan";
  return "manual";
}

function hasAutofillableValue(defaults: DriverRouteDefaults): boolean {
  const mode = defaults.carry_mode ?? inferRouteCarryMode(defaults);
  if (mode === "manual") {
    return (
      !!(defaults.truck_rego ?? "").trim() ||
      !!(defaults.start_location ?? "").trim() ||
      !!(defaults.destination ?? "").trim() ||
      !!defaults.shift_label
    );
  }
  return (
    !!(defaults.truck_rego ?? "").trim() ||
    !!(defaults.start_location ?? "").trim() ||
    !!(defaults.destination ?? "").trim() ||
    !!(defaults.route_label ?? "").trim() ||
    defaults.planned_distance_km != null ||
    defaults.planned_on_duty_hours != null ||
    !!defaults.shift_label ||
    !!(defaults.route_preset_id ?? "").trim()
  );
}

function sanitizeStoredDefaults(defaults: DriverRouteDefaults): DriverRouteDefaults {
  const mode = defaults.carry_mode ?? inferRouteCarryMode(defaults);
  const out: DriverRouteDefaults = { ...defaults, carry_mode: mode };
  if (mode !== "manual") return out;
  delete out.route_label;
  delete out.planned_distance_km;
  delete out.planned_on_duty_hours;
  delete out.route_preset_id;
  delete out.route_source;
  return out;
}

export function driverRouteDefaultsStorageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey.trim().toLowerCase()}`;
}

export function loadDriverRouteDefaults(userKey: string): DriverRouteDefaults | null {
  if (typeof window === "undefined" || !userKey.trim()) return null;
  try {
    const raw = localStorage.getItem(driverRouteDefaultsStorageKey(userKey));
    if (!raw) return null;
    const parsed = sanitizeStoredDefaults(JSON.parse(raw) as DriverRouteDefaults);
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
  const carry_mode = inferRouteCarryMode(source);
  const truck_rego = (source.truck_rego ?? "").toString().trim();
  const start_location = (source.start_location ?? "").toString().trim();
  const destination = (source.destination ?? "").toString().trim();
  const shift_label = source.shift_label === "A" || source.shift_label === "B" ? source.shift_label : "";

  const out: DriverRouteDefaults = { carry_mode };
  if (truck_rego) out.truck_rego = truck_rego;
  if (start_location) out.start_location = start_location;
  if (destination) out.destination = destination;
  if (shift_label) out.shift_label = shift_label;

  if (carry_mode === "run_plan") {
    const route_label = (source.route_label ?? "").toString().trim();
    const route_preset_id = (source.route_preset_id ?? "").toString().trim();
    const planned_distance_km =
      source.planned_distance_km != null && !Number.isNaN(Number(source.planned_distance_km))
        ? Number(source.planned_distance_km)
        : null;
    const planned_on_duty_hours =
      source.planned_on_duty_hours != null && !Number.isNaN(Number(source.planned_on_duty_hours))
        ? Number(source.planned_on_duty_hours)
        : null;
    if (route_label) out.route_label = route_label;
    if (route_preset_id) out.route_preset_id = route_preset_id;
    if (source.route_source) out.route_source = source.route_source;
    if (planned_distance_km != null) out.planned_distance_km = planned_distance_km;
    if (planned_on_duty_hours != null) out.planned_on_duty_hours = planned_on_duty_hours;
  }

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
  if (fromWeek) return fromWeek;
  return stored && hasAutofillableValue(stored) ? stored : null;
}

export function applyDriverRouteDefaultsToDay<T extends DayData>(
  day: T,
  defaults: DriverRouteDefaults | null
): T {
  if (!defaults) return day;

  const carry_mode = defaults.carry_mode ?? inferRouteCarryMode(defaults);

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
  // When the day already has a run plan / catalogue preset, that plan owns From/To —
  // do not refill empty places from a prior trip's defaults (would mix two runs).
  const dayOwnsRoutePlaces =
    !!(day.route_preset_id ?? "").trim() || hasRunPlanContent(day);
  const start_location = dayOwnsRoutePlaces
    ? day.start_location
    : pickStr(day.start_location, defaults.start_location);
  const destination = dayOwnsRoutePlaces
    ? day.destination
    : pickStr(day.destination, defaults.destination);
  const shift_label =
    day.shift_label === "A" || day.shift_label === "B"
      ? day.shift_label
      : defaults.shift_label || day.shift_label;

  if (carry_mode === "manual") {
    const appliedAny =
      !!(truck_rego ?? "").trim() !== !!(day.truck_rego ?? "").trim() ||
      !!(start_location ?? "").trim() !== !!(day.start_location ?? "").trim() ||
      !!(destination ?? "").trim() !== !!(day.destination ?? "").trim() ||
      (defaults.shift_label && !day.shift_label) ||
      hasRunPlanContent(day);

    return {
      ...day,
      truck_rego,
      start_location,
      destination,
      shift_label,
      ...(hasRunPlanContent(day)
        ? {
            route_label: undefined,
            planned_distance_km: undefined,
            planned_on_duty_hours: undefined,
            route_preset_id: undefined,
            route_source: undefined,
          }
        : null),
      ...(appliedAny && !day.route_source && !hasRunPlanContent(day)
        ? { route_source: "driver_saved" as const }
        : null),
    };
  }

  const route_label = pickStr(day.route_label, defaults.route_label);
  const route_preset_id = pickStr(day.route_preset_id, defaults.route_preset_id);
  const appliedAny =
    !!(truck_rego ?? "").trim() !== !!(day.truck_rego ?? "").trim() ||
    !!(start_location ?? "").trim() !== !!(day.start_location ?? "").trim() ||
    !!(destination ?? "").trim() !== !!(day.destination ?? "").trim() ||
    (defaults.route_label && !(day.route_label ?? "").trim()) ||
    (defaults.shift_label && !day.shift_label) ||
    (defaults.planned_distance_km != null && day.planned_distance_km == null) ||
    (defaults.planned_on_duty_hours != null && day.planned_on_duty_hours == null) ||
    (defaults.route_preset_id && !(day.route_preset_id ?? "").trim());

  return {
    ...day,
    truck_rego,
    start_location,
    destination,
    route_label: route_label || day.route_label,
    route_preset_id: route_preset_id || day.route_preset_id,
    shift_label,
    planned_distance_km: pickNum(day.planned_distance_km, defaults.planned_distance_km),
    planned_on_duty_hours: pickNum(day.planned_on_duty_hours, defaults.planned_on_duty_hours),
    route_source: day.route_source ?? defaults.route_source,
    ...(appliedAny && !day.route_source && defaults.route_source
      ? { route_source: defaults.route_source }
      : appliedAny && !day.route_source
        ? { route_source: "driver_saved" as const }
        : null),
  };
}

/** Run plan left over from an older carry-forward — clear when last shift was manual-only. */
export function hasStaleRunPlanCarry(day: DayData, defaults: DriverRouteDefaults | null): boolean {
  if (!defaults || !hasRunPlanContent(day)) return false;
  return (defaults.carry_mode ?? inferRouteCarryMode(defaults)) === "manual";
}

export function dayNeedsRouteAutofill(day: DayData, defaults?: DriverRouteDefaults | null): boolean {
  if (hasStaleRunPlanCarry(day, defaults ?? null)) return true;
  const mode = defaults?.carry_mode ?? inferRouteCarryMode(defaults ?? day);
  if (mode === "manual") return !hasRouteExceptKms(day);
  return !hasRouteExceptKms(day) || !hasRunPlanContent(day);
}

/**
 * Form-seed only: suggest prior-trip / stored defaults into a day object for Set up day.
 * Day-card display and PDF use getDayWithCarriedOverCardInfo (open-shift route) without a new Confirm.
 */
export function seedRouteSetupFormDefaults<T extends DayData>(
  days: T[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string,
  storedDefaults: DriverRouteDefaults | null
): T {
  const day = days[dayIndex] ?? ({} as T);
  // Already confirmed on this day card — keep the driver's choice (including blanks).
  if (day.route_confirmed) return day;

  const carried = getDayWithCarriedOverCardInfo(days, dayIndex, weekStarting, todayYmd) as T;
  // Open shift already has a route — do not overlay last-trip defaults because a label changed.
  if (isTrueShiftContinuation(days, dayIndex, weekStarting, todayYmd)) return carried;
  const sheetDayYmd = getSheetDayDateString(weekStarting, dayIndex);
  if (sheetDayYmd < todayYmd) return carried;

  const weekDefaults = findLastRouteDefaultsFromDays(days, dayIndex);
  const merged = mergeRouteDefaults(storedDefaults, weekDefaults);
  if (!merged) return carried;
  if (!dayNeedsRouteAutofill(carried, merged) && !hasStaleRunPlanCarry(carried, merged)) return carried;
  return applyDriverRouteDefaultsToDay(carried, merged);
}

/** @deprecated Use seedRouteSetupFormDefaults — name kept for call-site migration. */
export const getDayWithMergedRouteContext = seedRouteSetupFormDefaults;

/**
 * @deprecated No longer applied on sheet hydrate. Route fields persist only via Set up day Confirm.
 * Kept as a no-op so older callers do not silently rewrite day JSON.
 */
export function applyRouteDefaultsToWeekDays<T extends DayData>(
  days: T[],
  _weekStarting: string,
  _todayYmd: string,
  _storedDefaults: DriverRouteDefaults | null
): { days: T[]; changed: boolean } {
  return { days, changed: false };
}

export function hasRouteExceptKms(day: DayData): boolean {
  return (
    !!(day.truck_rego ?? "").trim() &&
    !!(day.start_location ?? "").trim() &&
    !!(day.destination ?? "").trim()
  );
}
