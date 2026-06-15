/**
 * Driver-declared run plan fields (ADR 0003). Stored on day JSON; used for prospective risk only.
 */

import type { DayData } from "@/lib/api";

export type RouteSource = "adhoc" | "driver_saved" | "org_preset";

export type RunPlanFields = {
  route_label?: string;
  planned_distance_km?: number | null;
  planned_on_duty_hours?: number | null;
  route_source?: RouteSource;
  route_preset_id?: string;
};

export function hasRunPlanContent(day: RunPlanFields): boolean {
  const label = (day.route_label ?? "").trim();
  const km = day.planned_distance_km;
  const hrs = day.planned_on_duty_hours;
  return label !== "" || (km != null && !Number.isNaN(Number(km))) || (hrs != null && !Number.isNaN(Number(hrs)));
}

/** Planned on-duty hours from run-plan fields or manual day-card km/hours. */
export function resolvePlannedOnDutyHours(
  day: RunPlanFields & { start_kms?: number | null; end_kms?: number | null }
): number | null {
  const hrs = day.planned_on_duty_hours;
  if (hrs != null && !Number.isNaN(Number(hrs)) && Number(hrs) > 0) {
    return Number(hrs);
  }
  const km = day.planned_distance_km;
  if (km != null && !Number.isNaN(Number(km)) && Number(km) > 0) {
    return Math.max(4, Number(km) / 50);
  }
  const start = day.start_kms;
  const end = day.end_kms;
  if (
    start != null &&
    end != null &&
    !Number.isNaN(Number(start)) &&
    !Number.isNaN(Number(end))
  ) {
    const tripKm = Math.max(0, Number(end) - Number(start));
    if (tripKm > 0) return Math.max(4, tripKm / 50);
  }
  return null;
}

export function resolvePlannedDistanceKm(
  day: RunPlanFields & { start_kms?: number | null; end_kms?: number | null }
): number | null {
  const km = day.planned_distance_km;
  if (km != null && !Number.isNaN(Number(km)) && Number(km) > 0) return Number(km);
  const start = day.start_kms;
  const end = day.end_kms;
  if (
    start != null &&
    end != null &&
    !Number.isNaN(Number(start)) &&
    !Number.isNaN(Number(end))
  ) {
    const tripKm = Math.max(0, Number(end) - Number(start));
    return tripKm > 0 ? tripKm : null;
  }
  return null;
}

/** True when user started a run plan but it fails ADR validation. */
export function runPlanValidationError(day: RunPlanFields): string | null {
  if (!hasRunPlanContent(day)) return null;
  const label = (day.route_label ?? "").trim();
  if (!label) return "Route name is required when adding a run plan.";
  const km = day.planned_distance_km;
  const hrs = day.planned_on_duty_hours;
  const hasKm = km != null && !Number.isNaN(Number(km)) && Number(km) >= 0;
  const hasHrs = hrs != null && !Number.isNaN(Number(hrs)) && Number(hrs) > 0;
  if (!hasKm && !hasHrs) {
    return "Enter expected distance (km) and/or on-duty time (hours) for the run plan.";
  }
  return null;
}

export function formatRunPlanSummary(day: RunPlanFields): string | null {
  if (!hasRunPlanContent(day)) return null;
  const label = (day.route_label ?? "").trim() || "Run";
  const parts: string[] = [label];
  const hrs = day.planned_on_duty_hours;
  const km = day.planned_distance_km;
  if (hrs != null && !Number.isNaN(Number(hrs)) && Number(hrs) > 0) {
    parts.push(`~${Number(hrs)}h`);
  }
  if (km != null && !Number.isNaN(Number(km)) && Number(km) >= 0) {
    parts.push(`~${Number(km)} km`);
  }
  return parts.join(" · ");
}

export function isFutureSheetDay(
  weekStarting: string,
  dayIndex: number,
  todayYmd: string
): boolean {
  const [yw, mw, dw] = weekStarting.split("-").map(Number);
  const dayDate = new Date(yw, mw - 1, dw + dayIndex);
  const ds = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(dayDate.getDate()).padStart(2, "0")}`;
  return ds > todayYmd;
}

export function sheetDayYmdFromIndex(weekStarting: string, dayIndex: number): string {
  const [yw, mw, dw] = weekStarting.split("-").map(Number);
  const dayDate = new Date(yw, mw - 1, dw + dayIndex);
  return `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(dayDate.getDate()).padStart(2, "0")}`;
}

export type DayDataWithPlan = DayData & RunPlanFields;
