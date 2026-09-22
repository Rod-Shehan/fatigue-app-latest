"use client";

import { useState, type ReactNode } from "react";
import { Radio, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TriageShiftBanner } from "@/components/manager/TriageShiftBanner";
import {
  CameraAlertEventTypesPanel,
  type CameraAlertOptionsDiagnostics,
} from "@/app/manager/alerts/camera-alert-event-types-panel";
import type { TriageShiftSnapshot } from "@/lib/triage-shift";

const HOURS_OPTIONS = [
  { label: "1 hour", value: 1 },
  { label: "6 hours", value: 6 },
  { label: "12 hours", value: 12 },
  { label: "24 hours", value: 24 },
  { label: "48 hours", value: 48 },
  { label: "7 days", value: 168 },
  { label: "30 days", value: 720 },
] as const;

type TriageFilter = "pending" | "all" | "decided";

type Props = {
  triageFilter: TriageFilter;
  onTriageFilterChange: (filter: TriageFilter) => void;
  hours: number;
  onHoursChange: (hours: number) => void;
  liveLabel: string;
  dataUpdatedAt: number;
  pendingCount: number;
  activePending: number;
  visibleCount: number;
  browseHours: number | null;
  shiftSnapshot: TriageShiftSnapshot | null;
  onShift: boolean;
  diagnostics?: CameraAlertOptionsDiagnostics;
  alertSoundToggle?: ReactNode;
};

export function AlertsDeskChrome({
  triageFilter,
  onTriageFilterChange,
  hours,
  onHoursChange,
  liveLabel,
  dataUpdatedAt,
  pendingCount,
  activePending,
  visibleCount,
  browseHours,
  shiftSnapshot,
  onShift,
  diagnostics,
  alertSoundToggle,
}: Props) {
  const [optionsOpen, setOptionsOpen] = useState(false);

  const queueSummary =
    triageFilter === "pending"
      ? `${activePending} active · ${visibleCount} need review`
      : `${visibleCount} in ${browseHours ?? hours}h · ${activePending} still active`;

  return (
    <div className="mb-6 space-y-4">
      {shiftSnapshot ? (
        <TriageShiftBanner snapshot={shiftSnapshot} onShift={onShift} />
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/90 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60">
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Radio
            className={cn("h-4 w-4 shrink-0", liveLabel === "Live" ? "text-emerald-600" : "text-slate-400")}
            aria-hidden
          />
          <span className="font-medium text-slate-800 dark:text-slate-100">{liveLabel}</span>
          {dataUpdatedAt > 0 ? (
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {new Date(dataUpdatedAt).toLocaleTimeString("en-AU", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
          ) : null}
          <span className="text-slate-400" aria-hidden>
            ·
          </span>
          <span className="min-w-0 truncate">{queueSummary}</span>
          {triageFilter === "pending" && pendingCount > 0 ? (
            <span className="shrink-0 text-amber-700 dark:text-amber-400">
              · {pendingCount} awaiting
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(["pending", "all", "decided"] as const).map((filter) => (
            <Button
              key={filter}
              type="button"
              size="sm"
              variant={triageFilter === filter ? "default" : "outline"}
              className="h-9 px-3"
              onClick={() => onTriageFilterChange(filter)}
            >
              {filter === "pending" ? "Need review" : filter === "decided" ? "Closed" : "All"}
            </Button>
          ))}

          {triageFilter !== "pending" ? (
            <select
              value={hours}
              onChange={(e) => onHoursChange(Number(e.target.value))}
              className="h-9 rounded-md border border-slate-300 bg-[#ffffff] px-2 text-sm text-[#0f172a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              aria-label="History time range"
            >
              {HOURS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : null}

          {alertSoundToggle ? <div className="shrink-0">{alertSoundToggle}</div> : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-3"
            onClick={() => setOptionsOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Alert types
          </Button>
        </div>
      </div>

      <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,44rem)] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <DialogTitle className="text-base font-semibold">Alert types</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setOptionsOpen(false)}
              aria-label="Close alert types"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <CameraAlertEventTypesPanel diagnostics={diagnostics} embedded />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
