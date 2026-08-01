"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
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
  /** View saved FFW record(s) for this day. */
  onViewFfw?: () => void;
  /** True when a completed ffw checklist record exists for this day. */
  ffwFormCompleted?: boolean;
  /** Phase 4 — open voluntary Prestart form (optional; no Start-shift gate). */
  onOpenPrestart?: () => void;
  onViewPrestart?: () => void;
  /** True when any completed prestart record exists (inspection or not-responsible note). */
  prestartFormCompleted?: boolean;
  /** Phase 5 — open voluntary Dimension & Load form (optional; multi-load; no post-load gate). */
  onOpenDimensionLoad?: () => void;
  onViewDimensionLoad?: () => void;
  /** True when ≥1 completed dimension_load record exists for this day. */
  dimensionLoadFormCompleted?: boolean;
};

function checklistSummary(
  value: DayTripChecklistFields,
  ffwFormCompleted: boolean,
  prestartFormCompleted: boolean,
  dimensionLoadFormCompleted: boolean
): string {
  const done = TRIP_CHECKLIST_KEYS.filter((k) => value[k] === true).length;
  const total = TRIP_CHECKLIST_KEYS.length;
  const forms: string[] = [];
  if (ffwFormCompleted) forms.push("FFW");
  if (prestartFormCompleted) forms.push("Prestart");
  if (dimensionLoadFormCompleted) forms.push("Load");
  const tickPart = `${done}/${total} ticked`;
  if (forms.length === 0) return tickPart;
  return `${tickPart} · ${forms.join(", ")} saved`;
}

export function DayTripChecklist({
  value,
  onChange,
  readOnly = false,
  variant = "card",
  className,
  onOpenFfw,
  onViewFfw,
  ffwFormCompleted = false,
  onOpenPrestart,
  onViewPrestart,
  prestartFormCompleted = false,
  onOpenDimensionLoad,
  onViewDimensionLoad,
  dimensionLoadFormCompleted = false,
}: Props) {
  const collapsible = variant === "card";
  const [expanded, setExpanded] = useState(!collapsible);

  const setKey = (key: TripChecklistKey, checked: boolean) => {
    onChange({ ...value, [key]: checked ? true : false });
  };

  const hasFormOpen = Boolean(
    onOpenFfw ||
      onViewFfw ||
      onOpenPrestart ||
      onViewPrestart ||
      onOpenDimensionLoad ||
      onViewDimensionLoad
  );
  const summary = checklistSummary(
    value,
    ffwFormCompleted,
    prestartFormCompleted,
    dimensionLoadFormCompleted
  );

  return (
    <fieldset
      className={cn(
        "min-w-0 rounded-lg border border-slate-200 dark:border-slate-700",
        variant === "card" ? "px-3 py-2" : "px-3 py-3",
        className
      )}
      disabled={readOnly && !hasFormOpen}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          className="flex w-full min-h-[44px] items-center gap-2 py-0.5 text-left"
          aria-expanded={expanded}
        >
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Daily checks</span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {summary}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      ) : (
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Daily checks
        </legend>
      )}

      {expanded ? (
        <>
          <p
            className={cn(
              "mb-2 text-slate-500 dark:text-slate-400",
              variant === "card" ? "text-[11px] leading-snug" : "text-xs leading-snug",
              collapsible && "mt-1"
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
                    {isFfw && (onViewFfw || onOpenFfw) ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        {ffwFormCompleted && onViewFfw ? (
                          <button
                            type="button"
                            onClick={onViewFfw}
                            className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                          >
                            View
                          </button>
                        ) : null}
                        {onOpenFfw && !readOnly ? (
                          <button
                            type="button"
                            onClick={onOpenFfw}
                            className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                          >
                            {ffwFormCompleted ? "Redo" : "Open form"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {isPrestart && (onViewPrestart || onOpenPrestart) ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        {prestartFormCompleted && onViewPrestart ? (
                          <button
                            type="button"
                            onClick={onViewPrestart}
                            className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                          >
                            View
                          </button>
                        ) : null}
                        {onOpenPrestart && !readOnly ? (
                          <button
                            type="button"
                            onClick={onOpenPrestart}
                            className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                          >
                            {prestartFormCompleted ? "Redo" : "Open form"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {isLoad && (onViewDimensionLoad || onOpenDimensionLoad) ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        {dimensionLoadFormCompleted && onViewDimensionLoad ? (
                          <button
                            type="button"
                            onClick={onViewDimensionLoad}
                            className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                          >
                            View
                          </button>
                        ) : null}
                        {onOpenDimensionLoad && !readOnly ? (
                          <button
                            type="button"
                            onClick={onOpenDimensionLoad}
                            className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                          >
                            {dimensionLoadFormCompleted ? "Add another" : "Open form"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </fieldset>
  );
}
