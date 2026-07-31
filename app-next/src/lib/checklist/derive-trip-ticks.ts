/**
 * Derive Weekly Trip Sheet day ticks from completed checklist records (scope A1).
 * Legacy manual booleans remain if no completed record of that type exists yet.
 */

import type { ChecklistRecord, ChecklistRecordType } from "./record";
import { hasCompletedChecklistOfType } from "./record";

export type DerivedTripChecklistFields = {
  fitness_for_work?: boolean;
  dimension_load_checklist?: boolean;
  daily_vehicle_checklist?: boolean;
};

export const CHECKLIST_TYPE_TO_TRIP_KEY: Record<
  ChecklistRecordType,
  keyof DerivedTripChecklistFields
> = {
  ffw: "fitness_for_work",
  dimension_load: "dimension_load_checklist",
  prestart: "daily_vehicle_checklist",
};

export type DayWithChecklists = DerivedTripChecklistFields & {
  checklists?: ChecklistRecord[];
};

/**
 * Completed record forces tick true; otherwise keep legacy/manual boolean.
 */
export function deriveTripChecklistFields(
  day: DayWithChecklists | null | undefined
): Required<DerivedTripChecklistFields> {
  const d = day ?? {};
  const checklists = d.checklists;
  return {
    fitness_for_work:
      hasCompletedChecklistOfType(checklists, "ffw") || d.fitness_for_work === true,
    dimension_load_checklist:
      hasCompletedChecklistOfType(checklists, "dimension_load") ||
      d.dimension_load_checklist === true,
    daily_vehicle_checklist:
      hasCompletedChecklistOfType(checklists, "prestart") || d.daily_vehicle_checklist === true,
  };
}

/** Merge derived ticks onto a day object (preserves other fields). */
export function applyDerivedTripTicksToDay<T extends DayWithChecklists>(day: T): T {
  const ticks = deriveTripChecklistFields(day);
  return {
    ...day,
    fitness_for_work: ticks.fitness_for_work || undefined,
    dimension_load_checklist: ticks.dimension_load_checklist || undefined,
    daily_vehicle_checklist: ticks.daily_vehicle_checklist || undefined,
  };
}

/** Apply derive across a 7-day sheet array. */
export function applyDerivedTripTicksToDays(days: unknown): unknown[] {
  const list = Array.isArray(days) ? days : [];
  return list.map((day) => {
    if (!day || typeof day !== "object") return day;
    return applyDerivedTripTicksToDay(day as DayWithChecklists);
  });
}

export function appendChecklistToDay<T extends DayWithChecklists>(
  day: T,
  record: ChecklistRecord
): T {
  const prev = Array.isArray(day.checklists) ? day.checklists : [];
  const withoutDup = prev.filter((c) => c?.id !== record.id);
  return applyDerivedTripTicksToDay({
    ...day,
    checklists: [...withoutDup, record],
  });
}
