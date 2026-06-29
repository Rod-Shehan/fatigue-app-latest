"use client";

import { useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { commandCard } from "@/components/command/command-styles";
import type { TriageShiftPublic, TriageShiftSnapshot } from "@/lib/triage-shift";
import { formatShiftAssigneeSummary } from "@/lib/triage-shift";

export type TriageShiftBannerProps = {
  snapshot: TriageShiftSnapshot;
  onShift: boolean;
};

function ShiftDetail({ shift }: { shift: TriageShiftPublic }) {
  return (
    <div className="mt-2 space-y-1 text-xs text-slate-400">
      <p>
        <span className="font-medium text-slate-300">Window:</span> {shift.startsAtLabel} →{" "}
        {shift.endsAtLabel} AWST
      </p>
      <p>
        <span className="font-medium text-slate-300">On shift:</span>{" "}
        {formatShiftAssigneeSummary(shift)}
      </p>
      {shift.handoffNote ? (
        <p>
          <span className="font-medium text-slate-300">Handoff:</span> {shift.handoffNote}
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
        className={`${commandCard} border-dashed border-amber-500/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100`}
      >
        <p className="font-medium">No triage shift scheduled</p>
        <p className="mt-1 text-xs text-amber-200/80">
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
          ? "border-teal-500/50 bg-teal-950/30"
          : "border-slate-600/80 bg-slate-900/60"
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
            <Users className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="font-semibold text-slate-100">
              On shift until {current.endsAtLabel} AWST
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                onShift
                  ? "bg-teal-600 text-white"
                  : "bg-slate-700 text-slate-200"
              }`}
            >
              {onShift ? "You are on shift" : "View only"}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-400">{formatShiftAssigneeSummary(current)}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {expanded ? <ShiftDetail shift={current} /> : null}
      {snapshot.next ? (
        <p className="mt-2 text-xs text-slate-500">
          Next: {snapshot.next.startsAtLabel} AWST — {formatShiftAssigneeSummary(snapshot.next)}
        </p>
      ) : null}
    </div>
  );
}
