"use client";

import { cn } from "@/lib/utils";
import type { ChecklistItemValue, ChecklistPassFailItemState } from "@/lib/checklist";
import { setPassFailValue, tapPassFailItem, updateDefect } from "@/lib/checklist";
import { ChecklistDefectCard } from "./ChecklistDefectCard";

const DEFAULT_SEGMENTS: { value: ChecklistItemValue; label: string; activeClass: string }[] = [
  { value: "pass", label: "PASS", activeClass: "bg-ck-emerald text-ck-on-accent border-ck-emerald" },
  { value: "fail", label: "FAIL", activeClass: "bg-ck-red text-ck-on-accent border-ck-red" },
  { value: "na", label: "N/A", activeClass: "bg-ck-steel text-ck-on-accent border-ck-steel" },
];

export function ChecklistItemControl({
  label,
  state,
  onChange,
  notes,
  className,
  /** Display label for the fail segment (Prestart uses FAULT). */
  failLabel = "FAIL",
  defectCardTitle = "Defect",
  defectDescriptionLabel = "Description (required)",
  defectDescriptionPlaceholder = "Describe the defect",
}: {
  label: string;
  state: ChecklistPassFailItemState;
  onChange: (next: ChecklistPassFailItemState) => void;
  /** Optional prompt bullets under the heading (not separately scored). */
  notes?: string[];
  className?: string;
  failLabel?: string;
  defectCardTitle?: string;
  defectDescriptionLabel?: string;
  defectDescriptionPlaceholder?: string;
}) {
  const segments = DEFAULT_SEGMENTS.map((seg) =>
    seg.value === "fail" ? { ...seg, label: failLabel } : seg
  );

  return (
    <div className={cn("rounded-lg border border-ck-border bg-ck-slate/80 p-3", className)}>
      <button
        type="button"
        className="w-full text-left text-sm font-medium text-ck-fg min-h-[44px]"
        onClick={() => {
          const nextVal = tapPassFailItem(state.value);
          if (nextVal !== state.value) onChange(setPassFailValue(state, nextVal));
        }}
      >
        {label}
        {state.value === "unselected" ? (
          <span className="mt-1 block text-xs text-ck-steel">Tap label for Pass · or choose below</span>
        ) : null}
      </button>
      {notes && notes.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs leading-snug text-ck-steel">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={`${label} result`}>
        {segments.map((seg) => {
          const active = state.value === seg.value;
          return (
            <button
              key={seg.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(setPassFailValue(state, seg.value))}
              className={cn(
                "min-h-[44px] rounded-md border text-xs font-bold tracking-wide transition-colors",
                active
                  ? seg.activeClass
                  : "border-ck-border bg-ck-midnight/40 text-ck-steel hover:border-ck-cobalt hover:text-ck-fg"
              )}
            >
              {seg.label}
            </button>
          );
        })}
      </div>
      {state.value === "fail" && state.defect ? (
        <ChecklistDefectCard
          defect={state.defect}
          title={defectCardTitle}
          descriptionLabel={defectDescriptionLabel}
          descriptionPlaceholder={defectDescriptionPlaceholder}
          onChange={(defect) => onChange(updateDefect(state, defect))}
        />
      ) : null}
    </div>
  );
}
