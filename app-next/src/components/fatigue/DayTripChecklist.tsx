"use client";

import { cn } from "@/lib/utils";
import {
  TRIP_CHECKLIST_KEYS,
  TRIP_CHECKLIST_UI_LABELS,
  type DayTripChecklistFields,
  type TripChecklistKey,
} from "@/lib/worksafe-day-sheet/trip-checklist";

type Props = {
  value: DayTripChecklistFields;
  onChange: (next: DayTripChecklistFields) => void;
  readOnly?: boolean;
  /** Compact strip on the day card vs fuller block in Set up day. */
  variant?: "card" | "dialog";
  className?: string;
  /** Phase 3 — open voluntary signed FFW form (optional; no Start-shift gate). */
  onOpenFfw?: () => void;
  /** True when a completed ffw checklist record exists for this day. */
  ffwFormCompleted?: boolean;
  /** Phase 4 — open voluntary Prestart form (optional; no Start-shift gate). */
  onOpenPrestart?: () => void;
  /** True when any completed prestart record exists (inspection or not-responsible note). */
  prestartFormCompleted?: boolean;
  /** Phase 5 — open voluntary Dimension & Load form (optional; multi-load; no post-load gate). */
  onOpenDimensionLoad?: () => void;
  /** True when ≥1 completed dimension_load record exists for this day. */
  dimensionLoadFormCompleted?: boolean;
};

export function DayTripChecklist({
  value,
  onChange,
  readOnly = false,
  variant = "card",
  className,
  onOpenFfw,
  ffwFormCompleted = false,
  onOpenPrestart,
  prestartFormCompleted = false,
  onOpenDimensionLoad,
  dimensionLoadFormCompleted = false,
}: Props) {
  const setKey = (key: TripChecklistKey, checked: boolean) => {
    onChange({ ...value, [key]: checked ? true : false });
  };

  const hasFormOpen = Boolean(onOpenFfw || onOpenPrestart || onOpenDimensionLoad);


  return (
    <fieldset
      className={cn(
        "min-w-0 rounded-lg border border-slate-200 dark:border-slate-700",
        variant === "card" ? "px-3 py-2.5" : "px-3 py-3",
        className
      )}
      disabled={readOnly && !hasFormOpen}
    >
      <legend
        className={cn(
          "px-1 font-semibold text-slate-700 dark:text-slate-200",
          variant === "card" ? "text-xs" : "text-sm"
        )}
      >
        Daily checks
      </legend>
      <p
        className={cn(
          "mb-2 text-slate-500 dark:text-slate-400",
          variant === "card" ? "text-[11px] leading-snug" : "text-xs leading-snug"
        )}
      >
        Optional in trial. Tick when done, or open signed Fitness for Work / Prestart / Dimension &
        Load forms. Shows on the week PDF when completed.
      </p>
      <ul className="space-y-1">
        {TRIP_CHECKLIST_KEYS.map((key) => {
          const id = `trip-check-${key}-${variant}`;
          const checked = value[key] === true;
          const isFfw = key === "fitness_for_work";
          const isPrestart = key === "daily_vehicle_checklist";
          const isLoad = key === "dimension_load_checklist";
          return (
            <li key={key}>
              <div
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-1 py-1.5",
                  !readOnly && "active:bg-slate-50 dark:active:bg-slate-800/60"
                )}
              >
                <label
                  htmlFor={id}
                  className={cn(
                    "flex flex-1 min-w-0 cursor-pointer items-center gap-3",
                    readOnly && "cursor-default opacity-80"
                  )}
                >
                  <input
                    id={id}
                    type="checkbox"
                    className="h-5 w-5 shrink-0 rounded border-slate-400 text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-500"
                    checked={checked}
                    disabled={readOnly}
                    onChange={(e) => setKey(key, e.target.checked)}
                  />
                  <span
                    className={cn(
                      "font-medium text-slate-800 dark:text-slate-100",
                      variant === "card" ? "text-sm" : "text-base"
                    )}
                  >
                    {TRIP_CHECKLIST_UI_LABELS[key]}
                    {isFfw && ffwFormCompleted ? (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Form saved
                      </span>
                    ) : null}
                    {isPrestart && prestartFormCompleted ? (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Form saved
                      </span>
                    ) : null}
                    {isLoad && dimensionLoadFormCompleted ? (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Form saved
                      </span>
                    ) : null}
                  </span>
                </label>
                {isFfw && onOpenFfw && !readOnly ? (
                  <button
                    type="button"
                    onClick={onOpenFfw}
                    className="shrink-0 rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    {ffwFormCompleted ? "View / redo" : "Open form"}
                  </button>
                ) : null}
                {isPrestart && onOpenPrestart && !readOnly ? (
                  <button
                    type="button"
                    onClick={onOpenPrestart}
                    className="shrink-0 rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    {prestartFormCompleted ? "View / redo" : "Open form"}
                  </button>
                ) : null}
                {isLoad && onOpenDimensionLoad && !readOnly ? (
                  <button
                    type="button"
                    onClick={onOpenDimensionLoad}
                    className="shrink-0 rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    {dimensionLoadFormCompleted ? "Add another" : "Open form"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
