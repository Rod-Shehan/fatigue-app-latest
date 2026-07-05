"use client";

import { useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { commandCard, commandTextMuted, commandTextPrimary } from "@/components/command/command-styles";
import type { TriageShiftPublic, TriageShiftSnapshot } from "@/lib/triage-shift";
import { formatShiftAssigneeSummary } from "@/lib/triage-shift";
import { cn } from "@/lib/utils";

export type TriageShiftBannerProps = {
  snapshot: TriageShiftSnapshot;
  onShift: boolean;
};

function ShiftDetail({ shift }: { shift: TriageShiftPublic }) {
  return (
    <div className={cn("mt-2 space-y-1 text-xs", commandTextMuted)}>
      <p>
        <span className="font-medium text-slate-700 dark:text-slate-300">Window:</span> {shift.startsAtLabel} →{" "}
        {shift.endsAtLabel} AWST
      </p>
      <p>
        <span className="font-medium text-slate-700 dark:text-slate-300">On shift:</span>{" "}
        {formatShiftAssigneeSummary(shift)}
      </p>
      {shift.handoffNote ? (
        <p>
          <span className="font-medium text-slate-700 dark:text-slate-300">Handoff:</span> {shift.handoffNote}
        </p>
      ) : null}
    </div>
  );
}

export function TriageShiftBanner({ snapshot, onShift }: TriageShiftBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const current = snapshot.current;

  if (!current) {
    return (
      <div
        className={`${commandCard} border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/20 dark:text-amber-100`}
      >
        <p className="font-medium">No triage shift scheduled</p>
        <p className="mt-1 text-xs text-amber-900 dark:text-amber-200/80">
          Owner sets who is on shift in the Circadia owner console. Until then, triage actions are
          view-only.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`${commandCard} px-4 py-3 text-sm ${
        onShift
          ? "border-teal-300 bg-teal-50 dark:border-teal-500/50 dark:bg-teal-950/30"
          : "border-slate-300 bg-slate-50 dark:border-slate-600/80 dark:bg-slate-900/60"
      }`}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Users className={cn("h-4 w-4 shrink-0", commandTextMuted)} aria-hidden />
            <span className={cn("font-semibold", commandTextPrimary)}>
              On shift until {current.endsAtLabel} AWST
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                onShift
                  ? "bg-teal-600 text-white"
                  : "bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
              }`}
            >
              {onShift ? "You are on shift" : "View only"}
            </span>
          </div>
          <p className={cn("mt-1 truncate text-xs", commandTextMuted)}>
            {formatShiftAssigneeSummary(current)}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            commandTextMuted,
            expanded ? "rotate-180" : ""
          )}
          aria-hidden
        />
      </button>
      {expanded ? <ShiftDetail shift={current} /> : null}
      {snapshot.next ? (
        <p className={cn("mt-2 text-xs", commandTextMuted)}>
          Next: {snapshot.next.startsAtLabel} AWST — {formatShiftAssigneeSummary(snapshot.next)}
        </p>
      ) : null}
    </div>
  );
}
