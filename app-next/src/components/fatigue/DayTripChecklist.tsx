"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FORMS_CHECKLIST_KEYS,
  TRIP_CHECKLIST_UI_LABELS,
  type DayTripChecklistFields,
  type FormsChecklistKey,
} from "@/lib/worksafe-day-sheet/trip-checklist";
import {
  FAULT_REPORT_FORM_TITLE,
  FORKLIFT_PRESTART_FORM_TITLE,
  HOOKUP_FORM_TITLE,
  PRESTART_FORM_TITLE,
  TRAILER_PRESTART_FORM_TITLE,
} from "@/lib/checklist";
import {
  DRIVER_FORMS_SECTION_LABEL,
  HOOKUP_PRIME_MOVER_REMINDER_HINT,
  HOOKUP_PRIME_MOVER_REMINDER_LABEL,
} from "@/lib/product-copy";

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
  /** True when any completed vehicle prestart record exists (inspection or not-responsible note). */
  prestartFormCompleted?: boolean;
  onOpenTrailerPrestart?: () => void;
  onViewTrailerPrestart?: () => void;
  trailerPrestartCompleted?: boolean;
  onOpenForkliftPrestart?: () => void;
  onViewForkliftPrestart?: () => void;
  forkliftPrestartCompleted?: boolean;
  /** Phase 5 — open voluntary Dimension & Load form (optional; multi-load; no post-load gate). */
  onOpenDimensionLoad?: () => void;
  onViewDimensionLoad?: () => void;
  /** True when ≥1 completed dimension_load record exists for this day. */
  dimensionLoadFormCompleted?: boolean;
  onOpenHookup?: () => void;
  onViewHookup?: () => void;
  hookupFormCompleted?: boolean;
  /** Day plate is a prime mover — highlight Hook up as a reminder, not a gate. */
  suggestHookup?: boolean;
  onOpenFaultReport?: () => void;
  onViewFaultReport?: () => void;
  faultReportFormCompleted?: boolean;
};

function PlantFormRow({
  title,
  completed,
  readOnly,
  variant,
  onView,
  onOpen,
  completedOpenLabel = "Redo",
}: {
  title: string;
  completed: boolean;
  readOnly: boolean;
  variant: "card" | "dialog";
  onView?: () => void;
  onOpen?: () => void;
  completedOpenLabel?: string;
}) {
  if (!onView && !onOpen) return null;
  return (
    <li>
      <div className="flex min-h-11 items-center gap-3 rounded-md px-1 py-1.5">
        <span
          className={cn(
            "min-w-0 flex-1 font-medium",
            variant === "card"
              ? "text-sm text-slate-800 dark:text-teal-50"
              : "text-base text-slate-800 dark:text-slate-100"
          )}
        >
          {title}
          {completed ? (
            <span
              className={cn(
                "ml-1.5 text-[10px] font-semibold uppercase tracking-wide",
                variant === "card"
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-emerald-700 dark:text-emerald-400"
              )}
            >
              Form saved
            </span>
          ) : null}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {completed && onView ? (
            <button
              type="button"
              onClick={onView}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-bold",
                variant === "card"
                  ? "border-slate-300 text-slate-800 dark:border-teal-400 dark:text-teal-50"
                  : "border-slate-300 text-slate-800 dark:border-slate-600 dark:text-slate-100"
              )}
            >
              View
            </button>
          ) : null}
          {onOpen && !readOnly ? (
            <button
              type="button"
              onClick={onOpen}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-bold",
                variant === "card"
                  ? "border-slate-300 text-slate-800 dark:border-teal-400 dark:text-teal-50"
                  : "border-slate-300 text-slate-800 dark:border-slate-600 dark:text-slate-100"
              )}
            >
              {completed ? completedOpenLabel : "Open form"}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function formTickRow(
  key: FormsChecklistKey,
  opts: {
    ffwFormCompleted: boolean;
    prestartFormCompleted: boolean;
    trailerPrestartCompleted: boolean;
    forkliftPrestartCompleted: boolean;
    dimensionLoadFormCompleted: boolean;
    hookupFormCompleted: boolean;
    onViewFfw?: () => void;
    onOpenFfw?: () => void;
    onViewPrestart?: () => void;
    onOpenPrestart?: () => void;
    onViewTrailerPrestart?: () => void;
    onOpenTrailerPrestart?: () => void;
    onViewForkliftPrestart?: () => void;
    onOpenForkliftPrestart?: () => void;
    onViewDimensionLoad?: () => void;
    onOpenDimensionLoad?: () => void;
    onViewHookup?: () => void;
    onOpenHookup?: () => void;
  }
): {
  completed: boolean;
  onView?: () => void;
  onOpen?: () => void;
  completedOpenLabel: string;
} {
  switch (key) {
    case "fitness_for_work":
      return {
        completed: opts.ffwFormCompleted,
        onView: opts.onViewFfw,
        onOpen: opts.onOpenFfw,
        completedOpenLabel: "Redo",
      };
    case "daily_vehicle_checklist":
      return {
        completed: opts.prestartFormCompleted,
        onView: opts.onViewPrestart,
        onOpen: opts.onOpenPrestart,
        completedOpenLabel: "Redo",
      };
    case "dimension_load_checklist":
      return {
        completed: opts.dimensionLoadFormCompleted,
        onView: opts.onViewDimensionLoad,
        onOpen: opts.onOpenDimensionLoad,
        completedOpenLabel: "Add another",
      };
    case "trailer_prestart_checklist":
      return {
        completed: opts.trailerPrestartCompleted,
        onView: opts.onViewTrailerPrestart,
        onOpen: opts.onOpenTrailerPrestart,
        completedOpenLabel: "Redo",
      };
    case "forklift_prestart_checklist":
      return {
        completed: opts.forkliftPrestartCompleted,
        onView: opts.onViewForkliftPrestart,
        onOpen: opts.onOpenForkliftPrestart,
        completedOpenLabel: "Redo",
      };
    case "hookup_checklist":
      return {
        completed: opts.hookupFormCompleted,
        onView: opts.onViewHookup,
        onOpen: opts.onOpenHookup,
        completedOpenLabel: "Add another",
      };
  }
}

function checklistSummary(
  value: DayTripChecklistFields,
  ffwFormCompleted: boolean,
  prestartFormCompleted: boolean,
  trailerPrestartCompleted: boolean,
  forkliftPrestartCompleted: boolean,
  dimensionLoadFormCompleted: boolean,
  hookupFormCompleted: boolean,
  faultReportFormCompleted: boolean,
  suggestHookup: boolean
): string {
  const done = FORMS_CHECKLIST_KEYS.filter((k) => value[k] === true).length;
  const total = FORMS_CHECKLIST_KEYS.length;
  const forms: string[] = [];
  if (ffwFormCompleted) forms.push("FFW");
  if (prestartFormCompleted) forms.push(PRESTART_FORM_TITLE);
  if (trailerPrestartCompleted) forms.push(TRAILER_PRESTART_FORM_TITLE);
  if (forkliftPrestartCompleted) forms.push(FORKLIFT_PRESTART_FORM_TITLE);
  if (dimensionLoadFormCompleted) forms.push("Load");
  if (hookupFormCompleted) forms.push(HOOKUP_FORM_TITLE);
  if (faultReportFormCompleted) forms.push(FAULT_REPORT_FORM_TITLE);
  const tickPart = `${done}/${total} ticked`;
  const reminder =
    suggestHookup && !hookupFormCompleted ? ` · ${HOOKUP_FORM_TITLE} suggested` : "";
  if (forms.length === 0) return `${tickPart}${reminder}`;
  return `${tickPart} · ${forms.join(", ")} saved${reminder}`;
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
  onOpenTrailerPrestart,
  onViewTrailerPrestart,
  trailerPrestartCompleted = false,
  onOpenForkliftPrestart,
  onViewForkliftPrestart,
  forkliftPrestartCompleted = false,
  onOpenDimensionLoad,
  onViewDimensionLoad,
  dimensionLoadFormCompleted = false,
  onOpenHookup,
  onViewHookup,
  hookupFormCompleted = false,
  suggestHookup = false,
  onOpenFaultReport,
  onViewFaultReport,
  faultReportFormCompleted = false,
}: Props) {
  const collapsible = variant === "card";
  const [expanded, setExpanded] = useState(!collapsible);
  const showHookupReminder = suggestHookup && !hookupFormCompleted && !readOnly;

  useEffect(() => {
    if (collapsible && showHookupReminder) setExpanded(true);
  }, [collapsible, showHookupReminder]);

  const setKey = (key: FormsChecklistKey, checked: boolean) => {
    onChange({ ...value, [key]: checked ? true : false });
  };

  const hasFormOpen = Boolean(
    onOpenFfw ||
      onViewFfw ||
      onOpenPrestart ||
      onViewPrestart ||
      onOpenTrailerPrestart ||
      onViewTrailerPrestart ||
      onOpenForkliftPrestart ||
      onViewForkliftPrestart ||
      onOpenDimensionLoad ||
      onViewDimensionLoad ||
      onOpenHookup ||
      onViewHookup ||
      onOpenFaultReport ||
      onViewFaultReport
  );
  const summary = checklistSummary(
    value,
    ffwFormCompleted,
    prestartFormCompleted,
    trailerPrestartCompleted,
    forkliftPrestartCompleted,
    dimensionLoadFormCompleted,
    hookupFormCompleted,
    faultReportFormCompleted,
    suggestHookup
  );

  return (
    <fieldset
      className={cn(
        "min-w-0 rounded-lg border",
        variant === "card"
          ? "border-slate-300 bg-white px-3 py-2 dark:border-teal-500 dark:bg-teal-800"
          : "border-teal-200 bg-teal-50 px-3 py-3 dark:border-teal-800 dark:bg-teal-950/40",
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
          <span className="text-xs font-semibold text-slate-700 dark:text-teal-50">
            {DRIVER_FORMS_SECTION_LABEL}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-500 dark:text-teal-200">
            {summary}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-teal-300",
              expanded && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      ) : (
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {DRIVER_FORMS_SECTION_LABEL}
        </legend>
      )}

      {expanded ? (
        <>
          <p
            className={cn(
              "mb-2",
              variant === "card"
                ? "text-[11px] leading-snug text-slate-500 dark:text-teal-200"
                : "text-xs leading-snug text-slate-500 dark:text-slate-400",
              collapsible && "mt-1"
            )}
          >
            Fitness for Work is required before Start shift. Other forms are optional — use the ones
            that match this shift. Completed Fitness for work, {PRESTART_FORM_TITLE}, Dimension & load,{" "}
            {TRAILER_PRESTART_FORM_TITLE}, {FORKLIFT_PRESTART_FORM_TITLE}, and {HOOKUP_FORM_TITLE} ticks
            show on the week PDF and go in the weekly checklist pack. {FAULT_REPORT_FORM_TITLE} stays
            in the EWD only.
            {showHookupReminder ? (
              <span className="mt-1.5 block font-medium text-amber-800 dark:text-amber-300">
                {HOOKUP_PRIME_MOVER_REMINDER_LABEL}. {HOOKUP_PRIME_MOVER_REMINDER_HINT}
              </span>
            ) : null}
          </p>
          <ul className="space-y-1">
            {FORMS_CHECKLIST_KEYS.map((key) => {
              const id = `trip-check-${key}-${variant}`;
              const checked = value[key] === true;
              const row = formTickRow(key, {
                ffwFormCompleted,
                prestartFormCompleted,
                trailerPrestartCompleted,
                forkliftPrestartCompleted,
                dimensionLoadFormCompleted,
                hookupFormCompleted,
                onViewFfw,
                onOpenFfw,
                onViewPrestart,
                onOpenPrestart,
                onViewTrailerPrestart,
                onOpenTrailerPrestart,
                onViewForkliftPrestart,
                onOpenForkliftPrestart,
                onViewDimensionLoad,
                onOpenDimensionLoad,
                onViewHookup,
                onOpenHookup,
              });
              const highlightHookup = key === "hookup_checklist" && showHookupReminder;
              return (
                <li key={key}>
                  <div
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-1 py-1.5",
                      !readOnly &&
                        !highlightHookup &&
                        (variant === "card"
                          ? "active:bg-slate-50 dark:active:bg-teal-700"
                          : "active:bg-slate-50 dark:active:bg-slate-800/60"),
                      highlightHookup &&
                        (variant === "card"
                          ? "bg-amber-50 ring-1 ring-amber-300 dark:bg-amber-900/70 dark:ring-amber-500"
                          : "bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-300 dark:ring-amber-700")
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
                          "font-medium",
                          variant === "card"
                            ? "text-sm text-slate-800 dark:text-teal-50"
                            : "text-base text-slate-800 dark:text-slate-100"
                        )}
                      >
                        {TRIP_CHECKLIST_UI_LABELS[key]}
                        {key === "fitness_for_work" && !ffwFormCompleted && !readOnly ? (
                          <span
                            className={cn(
                              "ml-1.5 text-[10px] font-semibold uppercase tracking-wide",
                              variant === "card"
                                ? "text-amber-800 dark:text-amber-200"
                                : "text-amber-800 dark:text-amber-300"
                            )}
                          >
                            Required
                          </span>
                        ) : null}
                        {highlightHookup ? (
                          <span
                            className={cn(
                              "ml-1.5 text-[10px] font-semibold uppercase tracking-wide",
                              variant === "card"
                                ? "text-amber-800 dark:text-amber-200"
                                : "text-amber-800 dark:text-amber-300"
                            )}
                          >
                            Suggested
                          </span>
                        ) : null}
                        {row.completed ? (
                          <span
                            className={cn(
                              "ml-1.5 text-[10px] font-semibold uppercase tracking-wide",
                              variant === "card"
                                ? "text-emerald-800 dark:text-emerald-300"
                                : "text-emerald-700 dark:text-emerald-400"
                            )}
                          >
                            Form saved
                          </span>
                        ) : null}
                      </span>
                    </label>
                    {row.onView || row.onOpen ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        {row.completed && row.onView ? (
                          <button
                            type="button"
                            onClick={row.onView}
                            className={cn(
                              "rounded-md border px-2.5 py-1.5 text-xs font-bold",
                              variant === "card"
                                ? "border-slate-300 text-slate-800 dark:border-teal-400 dark:text-teal-50"
                                : "border-slate-300 text-slate-800 dark:border-slate-600 dark:text-slate-100"
                            )}
                          >
                            View
                          </button>
                        ) : null}
                        {row.onOpen && !readOnly ? (
                          <button
                            type="button"
                            onClick={row.onOpen}
                            className={cn(
                              "rounded-md border px-2.5 py-1.5 text-xs font-bold",
                              variant === "card"
                                ? "border-slate-300 text-slate-800 dark:border-teal-400 dark:text-teal-50"
                                : "border-slate-300 text-slate-800 dark:border-slate-600 dark:text-slate-100"
                            )}
                          >
                            {row.completed ? row.completedOpenLabel : "Open form"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {(onOpenFaultReport || onViewFaultReport) && (
            <ul
              className={cn(
                "mt-2 space-y-1 border-t pt-2",
                variant === "card"
                  ? "border-slate-200 dark:border-teal-600"
                  : "border-slate-200 dark:border-slate-700"
              )}
            >
              <PlantFormRow
                title={FAULT_REPORT_FORM_TITLE}
                completed={faultReportFormCompleted}
                readOnly={readOnly}
                variant={variant}
                onView={onViewFaultReport}
                onOpen={onOpenFaultReport}
                completedOpenLabel="Add another"
              />
            </ul>
          )}
        </>
      ) : null}
    </fieldset>
  );
}
