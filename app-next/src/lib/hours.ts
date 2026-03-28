/**
 * Client-safe helper for display totals only (e.g. stat cards).
 * Same semantics as `getHours` in compliance (48 half-hour slots vs 1440 minutes).
 */
import { getHours } from "./compliance";

const hoursStatFormatter = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function getHoursForDisplay(slots: boolean[] | undefined): number {
  return getHours(slots);
}

/** Formats total hours for stat cards and lists (at most one decimal; avoids long floats). */
export function formatHoursStatistic(hours: number): string {
  if (!Number.isFinite(hours)) return "0";
  return hoursStatFormatter.format(hours);
}
