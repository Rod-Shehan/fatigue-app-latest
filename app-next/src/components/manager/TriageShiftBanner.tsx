"use client";

import { useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TriageShiftPublic, TriageShiftSnapshot } from "@/lib/triage-shift";
import { formatShiftAssigneeSummary } from "@/lib/triage-shift";

export type TriageShiftBannerProps = {
  snapshot: TriageShiftSnapshot;
  onShift: boolean;
  className?: string;
};

function ShiftDetail({ shift }: { shift: TriageShiftPublic }) {
  return (
    <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
      <p>
        <span className="font-medium text-slate-700 dark:text-slate-200">Window:</span>{" "}
        {shift.startsAtLabel} → {shift.endsAtLabel} AWST
      </p>
      <p>
        <span className="font-medium text-slate-700 dark:text-slate-200">On shift:</span>{" "}
        {formatShiftAssigneeSummary(shift)}
      </p>
      {shift.handoffNote ? (
        <p>
          <span className="font-medium text-slate-700 dark:text-slate-200">Handoff:</span>{" "}
          {shift.handoffNote}
        </p>
      ) : null}
    </div>
  );
}

export function TriageShiftBanner({ snapshot, onShift, className }: TriageShiftBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const current = snapshot.current;

  if (!current) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-amber-300 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100",
          className
        )}
      >
        <p className="font-medium">No triage shift scheduled</p>
        <p className="mt-1 text-xs opacity-90">
          Owner can set who is on shift in the Owner console. Until then, live alert actions are
          view-only.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        onShift
          ? "border-teal-600 bg-teal-50 dark:border-teal-500 dark:bg-teal-950/40"
          : "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/60",
        className
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              On shift until {current.endsAtLabel} AWST
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                onShift
                  ? "bg-teal-700 text-white"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              )}
            >
              {onShift ? "You are on shift" : "View only"}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">
            {formatShiftAssigneeSummary(current)}
          </p>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      {expanded ? <ShiftDetail shift={current} /> : null}
      {snapshot.next ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Next: {snapshot.next.startsAtLabel} AWST — {formatShiftAssigneeSummary(snapshot.next)}
        </p>
      ) : null}
    </div>
  );
}
