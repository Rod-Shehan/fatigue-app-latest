/**
 * Pre-trip daily ticks for the Weekly Trip Sheet (FFW / load / vehicle).
 * Stored on each day card; week PDF header shows Sun–Sat columns.
 * When `checklists[]` has completed records, ticks are derived (scope A1).
 * @see docs/product/weekly-trip-sheet-pdf-project-scope.md
 * @see docs/product/compliance-checklist-modules-project-scope.md
 */

import { deriveTripChecklistFields, type DayWithChecklists } from "@/lib/checklist/derive-trip-ticks";

export const TRIP_CHECKLIST_KEYS = [
  "fitness_for_work",
  "dimension_load_checklist",
  "daily_vehicle_checklist",
] as const;

export type TripChecklistKey = (typeof TRIP_CHECKLIST_KEYS)[number];

export type DayTripChecklistFields = {
  fitness_for_work?: boolean;
  dimension_load_checklist?: boolean;
  daily_vehicle_checklist?: boolean;
};

/** Short labels for in-app toggles (paper wording is longer — used on PDF). */
export const TRIP_CHECKLIST_UI_LABELS: Record<TripChecklistKey, string> = {
  fitness_for_work: "Fitness for work",
  dimension_load_checklist: "Dimension & load checklist",
  daily_vehicle_checklist: "Daily vehicle checklist",
};

export function isTripChecklistTicked(
  day: DayTripChecklistFields | Record<string, unknown> | null | undefined,
  key: TripChecklistKey
): boolean {
  if (!day || typeof day !== "object") return false;
  const derived = deriveTripChecklistFields(day as DayWithChecklists);
  return derived[key] === true;
}

/** 3 rows × 7 days — true when that day has the tick set (derived or legacy). */
export function checklistMatrixFromDays(
  days: Array<DayTripChecklistFields | Record<string, unknown>>
): boolean[][] {
  const list = Array.isArray(days) ? days : [];
  return TRIP_CHECKLIST_KEYS.map((key) =>
    Array.from({ length: 7 }, (_, i) => isTripChecklistTicked(list[i], key))
  );
}
