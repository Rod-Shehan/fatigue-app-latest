/**
 * Pre-trip daily ticks for the Weekly Trip Sheet (FFW / vehicle / load /
 * trailer / forklift / hook-up). Fault report stays off this strip.
 * When `checklists[]` has completed records, ticks are derived (scope A1).
 * @see docs/product/weekly-trip-sheet-pdf-project-scope.md
 * @see docs/product/compliance-checklist-modules-project-scope.md
 */

import { deriveTripChecklistFields, type DayWithChecklists } from "@/lib/checklist/derive-trip-ticks";
import {
  FORKLIFT_PRESTART_FORM_TITLE,
  HOOKUP_FORM_TITLE,
  PRESTART_FORM_TITLE,
  TRAILER_PRESTART_FORM_TITLE,
} from "@/lib/checklist/schema-stubs";

/** Week PDF tick rows — Weekly Trip Sheet (6 × 7). */
export const TRIP_CHECKLIST_KEYS = [
  "fitness_for_work",
  "daily_vehicle_checklist",
  "dimension_load_checklist",
  "trailer_prestart_checklist",
  "forklift_prestart_checklist",
  "hookup_checklist",
] as const;

/** Forms page checkboxes — same set as the week PDF tick strip. */
export const FORMS_CHECKLIST_KEYS = TRIP_CHECKLIST_KEYS;

export type TripChecklistKey = (typeof TRIP_CHECKLIST_KEYS)[number];
export type FormsChecklistKey = (typeof FORMS_CHECKLIST_KEYS)[number];

export type DayTripChecklistFields = {
  fitness_for_work?: boolean;
  dimension_load_checklist?: boolean;
  daily_vehicle_checklist?: boolean;
  trailer_prestart_checklist?: boolean;
  forklift_prestart_checklist?: boolean;
  hookup_checklist?: boolean;
};

/** Short labels for in-app toggles (paper wording is longer — used on PDF). */
export const TRIP_CHECKLIST_UI_LABELS: Record<FormsChecklistKey, string> = {
  fitness_for_work: "Fitness for work",
  daily_vehicle_checklist: PRESTART_FORM_TITLE,
  dimension_load_checklist: "Dimension & load checklist",
  trailer_prestart_checklist: TRAILER_PRESTART_FORM_TITLE,
  forklift_prestart_checklist: FORKLIFT_PRESTART_FORM_TITLE,
  hookup_checklist: HOOKUP_FORM_TITLE,
};

export function isTripChecklistTicked(
  day: DayTripChecklistFields | Record<string, unknown> | null | undefined,
  key: FormsChecklistKey
): boolean {
  if (!day || typeof day !== "object") return false;
  const derived = deriveTripChecklistFields(day as DayWithChecklists);
  return derived[key] === true;
}

/** 6 rows × 7 days — week PDF tick strip. */
export function checklistMatrixFromDays(
  days: Array<DayTripChecklistFields | Record<string, unknown>>
): boolean[][] {
  const list = Array.isArray(days) ? days : [];
  return TRIP_CHECKLIST_KEYS.map((key) =>
    Array.from({ length: 7 }, (_, i) => isTripChecklistTicked(list[i], key))
  );
}
