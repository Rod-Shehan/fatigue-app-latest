"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChecklistAcknowledgeItemState } from "@/lib/checklist";
import { toggleAcknowledge } from "@/lib/checklist";

export function ChecklistAcknowledgeItem({
  label,
  state,
  onChange,
  className,
}: {
  label: string;
  state: ChecklistAcknowledgeItemState;
  onChange: (next: ChecklistAcknowledgeItemState) => void;
  className?: string;
}) {
  const on = state.value === "acknowledged";
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(toggleAcknowledge(state))}
      className={cn(
        "flex w-full min-h-[56px] items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        on
          ? "border-ck-emerald bg-ck-emerald/15"
          : "border-ck-border bg-ck-slate/80 hover:border-ck-cobalt",
        className
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border",
          on ? "border-ck-emerald bg-ck-emerald text-ck-on-accent" : "border-ck-border bg-ck-midnight"
        )}
      >
        {on ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
      </span>
      <span className="text-sm font-medium text-ck-fg leading-snug">{label}</span>
    </button>
  );
}
