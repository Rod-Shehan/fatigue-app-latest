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
};

export function DayTripChecklist({
  value,
  onChange,
  readOnly = false,
  variant = "card",
  className,
}: Props) {
  const setKey = (key: TripChecklistKey, checked: boolean) => {
    onChange({ ...value, [key]: checked ? true : false });
  };

  return (
    <fieldset
      className={cn(
        "min-w-0 rounded-lg border border-slate-200 dark:border-slate-700",
        variant === "card" ? "px-3 py-2.5" : "px-3 py-3",
        className
      )}
      disabled={readOnly}
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
        Tick when done for this day (shows on the week PDF). Leave blank if not done.
      </p>
      <ul className="space-y-1">
        {TRIP_CHECKLIST_KEYS.map((key) => {
          const id = `trip-check-${key}-${variant}`;
          const checked = value[key] === true;
          return (
            <li key={key}>
              <label
                htmlFor={id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 py-1.5",
                  readOnly && "cursor-default opacity-80",
                  !readOnly && "active:bg-slate-50 dark:active:bg-slate-800/60"
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
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
