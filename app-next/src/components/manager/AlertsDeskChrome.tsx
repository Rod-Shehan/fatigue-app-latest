"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, FlaskConical, Menu, Radio, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CircadiaLogo } from "@/components/branding/CircadiaLogo";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { formatRoleBadge, getDisplayNameFromSession } from "@/lib/session-display-name";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ManagerNavPanel } from "@/components/manager/ManagerNavPanel";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSection, setMenuSection] = useState<"nav" | "shift" | "options">("nav");
  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const sessionDisplayName = getDisplayNameFromSession(session ?? null);
  const roleBadgeText =
    session?.user && role
      ? role === "owner"
        ? formatRoleBadge("Owner", sessionDisplayName)
        : role === "manager"
          ? formatRoleBadge("Manager", sessionDisplayName)
          : formatRoleBadge("Driver", sessionDisplayName)
      : null;

  function openMenu(section: "nav" | "shift" | "options") {
    setMenuSection(section);
    setMenuOpen(true);
  }

  const shiftSummary = shiftSnapshot?.current
    ? onShift
      ? "On shift"
      : "View only"
    : "No shift";
  const queueSummary =
    triageFilter === "pending"
      ? `${activePending} active · ${visibleCount} need review`
      : `${visibleCount} in ${browseHours ?? hours}h · ${activePending} still active`;

  return (
    <header className="mb-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <CircadiaLogo variant="icon" size={36} className="shrink-0" />
        <Link
          href="/manager"
          className="flex shrink-0 items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label={MANAGER_EXPERIENCE.NAV_RISK_BRIEF}
        >
          <span className="flex h-9 w-9 items-center justify-center">
            <ArrowLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </span>
          <span className="-ml-1 pr-1 text-sm font-medium whitespace-nowrap">
            {MANAGER_EXPERIENCE.NAV_OVERVIEW}
          </span>
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-slate-800 dark:text-slate-100">
          {MANAGER_EXPERIENCE.NAV_ALERTS}
        </h1>

        {roleBadgeText ? (
          <span
            className={cn(
              "hidden max-w-[9rem] shrink-0 truncate rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider sm:inline",
              role === "owner"
                ? "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200"
                : "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200"
            )}
            title={roleBadgeText}
          >
            {roleBadgeText}
          </span>
        ) : null}

        {alertSoundToggle ? <div className="shrink-0">{alertSoundToggle}</div> : null}

        <Link
          href="/manager/test-desk"
          className="hidden h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:inline-flex dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Live alert test desk"
        >
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          Test
        </Link>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 shrink-0 px-0"
          onClick={() => openMenu("options")}
          aria-label="Alert type options"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs"
          onClick={() => openMenu("nav")}
          aria-expanded={menuOpen}
        >
          <Menu className="h-3.5 w-3.5" aria-hidden />
          Menu
        </Button>
      </div>

      <button
        type="button"
        onClick={() => openMenu("shift")}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-1.5 text-left text-xs text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-300"
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            onShift ? "bg-teal-500" : shiftSnapshot?.current ? "bg-amber-400" : "bg-slate-400"
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-slate-800 dark:text-slate-100">{shiftSummary}</span>
          <span className="text-slate-500 dark:text-slate-400"> · {queueSummary}</span>
          {triageFilter === "pending" && pendingCount > 0 ? (
            <span className="text-amber-700 dark:text-amber-400"> · {pendingCount} awaiting</span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-slate-500 dark:text-slate-400">
          <Radio
            className={cn("h-3.5 w-3.5", liveLabel === "Live" ? "text-emerald-600" : "text-slate-400")}
            aria-hidden
          />
          <span>{liveLabel}</span>
          {dataUpdatedAt > 0 ? (
            <span className="tabular-nums">
              {new Date(dataUpdatedAt).toLocaleTimeString("en-AU", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
          ) : null}
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-1.5">
        {(["pending", "all", "decided"] as const).map((filter) => (
          <Button
            key={filter}
            type="button"
            size="sm"
            variant={triageFilter === filter ? "default" : "outline"}
            className="h-8 px-2.5 text-xs"
            onClick={() => onTriageFilterChange(filter)}
          >
            {filter === "pending" ? "Need review" : filter === "decided" ? "Closed" : "All"}
          </Button>
        ))}

        {triageFilter !== "pending" ? (
          <select
            value={hours}
            onChange={(e) => onHoursChange(Number(e.target.value))}
            className="ml-auto h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            aria-label="History time range"
          >
            {HOURS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent
          className="fixed inset-y-0 right-0 left-auto top-0 flex h-full w-[min(100vw,22rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-l p-0 sm:rounded-none [&>button.absolute]:hidden"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <DialogTitle className="text-base font-semibold">Live alerts desk</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <div className="flex gap-1 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
            {(
              [
                { id: "nav" as const, label: "Go to" },
                { id: "shift" as const, label: "Shift" },
                { id: "options" as const, label: "Alert types" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMenuSection(tab.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  menuSection === tab.id
                    ? "bg-teal-700 text-white dark:bg-teal-600"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {menuSection === "nav" ? <ManagerNavPanel dense fill={false} /> : null}
            {menuSection === "shift" && shiftSnapshot ? (
              <TriageShiftBanner snapshot={shiftSnapshot} onShift={onShift} />
            ) : null}
            {menuSection === "shift" && !shiftSnapshot ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading shift…</p>
            ) : null}
            {menuSection === "options" ? (
              <CameraAlertEventTypesPanel diagnostics={diagnostics} embedded />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
