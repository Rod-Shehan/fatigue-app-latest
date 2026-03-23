"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type FatigueSheet, type SheetUpdatePayload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signOut } from "next-auth/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  Save,
  Loader2,
  CheckCircle2,
  FileEdit,
  Truck,
  Users,
  Trash2,
  UserPlus,
  AlertTriangle,
  Map as MapIcon,
  LogOut,
  MessageSquare,
  XCircle,
  Calendar,
} from "lucide-react";
import {
  ManagerMonthCalendar,
  parseYMD,
  startOfWeekSunday,
  toYMD,
} from "@/app/manager/manager-month-calendar";
import { getPreviousWeekSunday, getSheetDayDateString, parseLocalDate, sheetWeeksOverlap } from "@/lib/weeks";
import { last24hBreakToDatetimeLocalValue } from "@/lib/last-24h-break";
import type { ManagerComplianceItem } from "@/lib/api";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatWeekLabel(weekStarting: string): string {
  return new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSheetLabel(sheet: FatigueSheet): string {
  const driver = sheet.driver_name || "Draft";
  const week = sheet.week_starting
    ? new Date(sheet.week_starting + "T12:00:00").toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
  return `${driver} — week of ${week}`;
}

type ViolationLine = { sheetId: string; driver: string; day: string; message: string };

function violationLinesForWeek(
  items: ManagerComplianceItem[] | undefined,
  weekStarting: string
): ViolationLine[] {
  if (!items?.length || !weekStarting) return [];
  const filtered = items.filter((i) => i.week_starting === weekStarting);
  const lines: ViolationLine[] = [];
  for (const item of filtered) {
    for (const r of item.results) {
      if (r.type === "violation") {
        lines.push({
          sheetId: item.sheetId,
          driver: item.driver_name,
          day: r.day,
          message: r.message,
        });
      }
    }
  }
  return lines;
}

function ViolationListBlock({
  lines,
  emptyLabel,
}: {
  lines: ViolationLine[];
  emptyLabel: string;
}) {
  if (lines.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-violet-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-600 dark:border-violet-800/40 dark:bg-slate-900/50 dark:text-slate-300">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <span>{emptyLabel}</span>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-violet-200/70 dark:divide-violet-800/50">
      {lines.map((line, idx) => (
        <li
          key={`${line.sheetId}-${idx}-${line.day}`}
          className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-start sm:gap-4"
        >
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:w-[min(100%,14rem)] sm:shrink-0">
            <Link
              href={`/sheets/${line.sheetId}`}
              className="text-sm font-semibold text-violet-950 underline-offset-2 hover:underline dark:text-violet-100"
            >
              {line.driver || "—"}
            </Link>
            <span className="text-[11px] font-medium uppercase tracking-wide text-violet-700/85 dark:text-violet-400/90">
              {line.day}
            </span>
          </div>
          <p className="min-w-0 flex-1 text-sm leading-snug text-slate-700 dark:text-slate-200">{line.message}</p>
        </li>
      ))}
    </ul>
  );
}

function formatDayDateLabel(weekStarting: string, dayIndex: number): string {
  if (!weekStarting) return DAY_LABELS[dayIndex] ?? `D${dayIndex + 1}`;
  const ymd = getSheetDayDateString(weekStarting, dayIndex);
  const d = parseLocalDate(ymd);
  const day = d.toLocaleDateString("en-AU", { weekday: "short" });
  const date = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return `${day} ${date}`;
}

export function ManagerView() {
  const queryClient = useQueryClient();
  const [selectedSheetId, setSelectedSheetId] = useState<string>("");
  const [showAmendDialog, setShowAmendDialog] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [activeWeekStarting, setActiveWeekStarting] = useState<string>(() =>
    toYMD(startOfWeekSunday(new Date()))
  );
  const [activeDayIndex, setActiveDayIndex] = useState<number>(new Date().getDay());
  /** Driver filter: exact name from dropdown, or "" = all */
  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");
  /** Rego filter: exact value from selected day, or "" = all */
  const [selectedRegoFilter, setSelectedRegoFilter] = useState("");
  const [filterOnlyViolations, setFilterOnlyViolations] = useState(false);
  const [filterOnlyWarnings, setFilterOnlyWarnings] = useState(false);
  const [filterOnlyIncomplete, setFilterOnlyIncomplete] = useState(false);
  const [managerTab, setManagerTab] = useState<"compliance" | "edit">("compliance");
  const [calView, setCalView] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  const [form, setForm] = useState<{
    last_24h_break: string;
    driver_type: string;
    week_starting: string;
    destination: string;
    driver_name: string;
    second_driver: string;
  }>({
    last_24h_break: "",
    driver_type: "solo",
    week_starting: "",
    destination: "",
    driver_name: "",
    second_driver: "",
  });

  const { data: sheets = [], isLoading: sheetsLoading } = useQuery({
    queryKey: ["sheets"],
    queryFn: () => api.sheets.list(),
  });

  const weekOptions = useMemo(() => {
    const weeks = [...new Set(sheets.map((s) => s.week_starting).filter(Boolean))];
    return weeks.sort().reverse();
  }, [sheets]);

  const firstWeekOption = weekOptions[0];

  const weekSelectOptions = useMemo(() => {
    const set = new Set<string>(weekOptions);
    const cur = toYMD(startOfWeekSunday(new Date()));
    set.add(cur);
    if (activeWeekStarting) set.add(activeWeekStarting);
    return [...set].sort().reverse();
  }, [weekOptions, activeWeekStarting]);

  /**
   * Driver / rego dropdowns follow the same **week overlap** rule as the sheet picker: any sheet whose
   * Sun–Sat range overlaps the selected work week (not only exact `week_starting` string match).
   */
  const { driverOptions, regoOptions } = useMemo(() => {
    if (!activeWeekStarting) {
      return { driverOptions: [] as string[], regoOptions: [] as string[] };
    }
    const drivers = new Set<string>();
    const regos = new Set<string>();
    for (const s of sheets) {
      if (!sheetWeeksOverlap(s.week_starting, activeWeekStarting)) continue;
      const name = (s.driver_name ?? "").trim();
      if (name) drivers.add(name);
      const second = (s.second_driver ?? "").trim();
      if (second) drivers.add(second);
      const days = Array.isArray(s.days) ? s.days : [];
      for (const day of days) {
        const rego = typeof day?.truck_rego === "string" ? day.truck_rego.trim() : "";
        if (rego) regos.add(rego);
      }
    }
    return {
      driverOptions: [...drivers].sort((a, b) => a.localeCompare(b)),
      regoOptions: [...regos].sort((a, b) => a.localeCompare(b)),
    };
  }, [sheets, activeWeekStarting]);

  useEffect(() => {
    if (selectedDriverFilter && !driverOptions.includes(selectedDriverFilter)) {
      setSelectedDriverFilter("");
    }
  }, [selectedDriverFilter, driverOptions]);

  useEffect(() => {
    if (selectedRegoFilter && !regoOptions.includes(selectedRegoFilter)) {
      setSelectedRegoFilter("");
    }
  }, [selectedRegoFilter, regoOptions]);

  /**
   * Sheets for the edit picker: any sheet whose week overlaps the selected work week (shares a calendar day).
   * Handles off-by-one `week_starting` values vs the calendar. No requirement for grid rows — header-only
   * saves must still list the sheet.
   */
  const filteredSheetsForPicker = useMemo(() => {
    if (!activeWeekStarting) return sheets;
    return sheets.filter((s) => {
      if (!sheetWeeksOverlap(s.week_starting, activeWeekStarting)) return false;
      const days = Array.isArray(s.days) ? s.days : [];
      if (selectedDriverFilter) {
        const primary = (s.driver_name ?? "").trim();
        const second = (s.second_driver ?? "").trim();
        if (primary !== selectedDriverFilter && second !== selectedDriverFilter) return false;
      }
      if (selectedRegoFilter) {
        const match = days.some(
          (d) => (typeof d?.truck_rego === "string" ? d.truck_rego.trim() : "") === selectedRegoFilter
        );
        if (!match) return false;
      }
      return true;
    });
  }, [sheets, activeWeekStarting, selectedDriverFilter, selectedRegoFilter]);

  useEffect(() => {
    if (!selectedSheetId) return;
    if (!filteredSheetsForPicker.some((s) => s.id === selectedSheetId)) {
      setSelectedSheetId("");
    }
  }, [selectedSheetId, filteredSheetsForPicker]);

  useEffect(() => {
    const w = activeWeekStarting || firstWeekOption;
    if (w) {
      const d = parseYMD(w);
      setCalView({ y: d.getFullYear(), m: d.getMonth() });
    }
  }, [activeWeekStarting, firstWeekOption]);

  const calendarWeekAnchor = useMemo(() => {
    return (
      activeWeekStarting ||
      firstWeekOption ||
      toYMD(startOfWeekSunday(new Date()))
    );
  }, [activeWeekStarting, firstWeekOption]);

  /** Week used for the violations snapshot (selected work week, or calendar anchor). */
  const weekForSnapshot = activeWeekStarting || calendarWeekAnchor;

  const prevWeekForSnapshot = useMemo(
    () => (weekForSnapshot ? getPreviousWeekSunday(weekForSnapshot) : ""),
    [weekForSnapshot]
  );

  const { data: managerCompliance, isLoading: complianceLoading } = useQuery({
    queryKey: ["manager", "compliance"],
    queryFn: () => api.manager.compliance(),
  });

  const weekViolationLines = useMemo(
    () => violationLinesForWeek(managerCompliance?.items, weekForSnapshot),
    [managerCompliance, weekForSnapshot]
  );

  const prevWeekViolationLines = useMemo(
    () => violationLinesForWeek(managerCompliance?.items, prevWeekForSnapshot),
    [managerCompliance, prevWeekForSnapshot]
  );

  const { data: selectedSheet, isLoading: sheetLoading } = useQuery({
    queryKey: ["sheet", selectedSheetId],
    queryFn: () => api.sheets.get(selectedSheetId),
    enabled: !!selectedSheetId,
  });

  useEffect(() => {
    if (!selectedSheet || selectedSheet.id !== selectedSheetId) return;
    setForm({
      last_24h_break: selectedSheet.last_24h_break ?? "",
      driver_type: selectedSheet.driver_type ?? "solo",
      week_starting: selectedSheet.week_starting ?? "",
      destination: selectedSheet.destination ?? "",
      driver_name: selectedSheet.driver_name ?? "",
      second_driver: selectedSheet.second_driver ?? "",
    });
  }, [selectedSheet, selectedSheetId]);

  const saveMutation = useMutation({
    mutationFn: (payload: SheetUpdatePayload) =>
      api.sheets.update(selectedSheetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheet", selectedSheetId] });
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      queryClient.invalidateQueries({ queryKey: ["manager", "compliance"] });
    },
  });

  const amendMutation = useMutation({
    mutationFn: (reason: string) =>
      api.sheets.update(selectedSheetId, { amendment_reason: reason.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheet", selectedSheetId] });
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      queryClient.invalidateQueries({ queryKey: ["manager", "compliance"] });
      setShowAmendDialog(false);
      setAmendmentReason("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.sheets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      queryClient.invalidateQueries({ queryKey: ["sheet", selectedSheetId] });
      queryClient.invalidateQueries({ queryKey: ["manager", "compliance"] });
      setSelectedSheetId("");
    },
  });

  const handleDelete = () => {
    if (!selectedSheetId) return;
    if (!confirm("Delete this sheet? This cannot be undone.")) return;
    deleteMutation.mutate(selectedSheetId);
  };

  const handleSave = () => {
    if (!selectedSheetId) return;
    saveMutation.mutate({
      last_24h_break: form.last_24h_break || undefined,
      driver_type: form.driver_type,
      week_starting: form.week_starting || undefined,
      destination: form.destination || undefined,
      driver_name: form.driver_name || undefined,
      second_driver: form.second_driver || undefined,
    });
  };

  const canAmend = !!selectedSheetId && (selectedSheet?.status ?? "") === "completed";

  const hasChanges =
    selectedSheet &&
    (form.last_24h_break !== (selectedSheet.last_24h_break ?? "") ||
      form.driver_type !== (selectedSheet.driver_type ?? "solo") ||
      form.week_starting !== (selectedSheet.week_starting ?? "") ||
      form.destination !== (selectedSheet.destination ?? "") ||
      form.driver_name !== (selectedSheet.driver_name ?? "") ||
      form.second_driver !== (selectedSheet.second_driver ?? ""));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <PageHeader
          title="Manager dashboard"
          subtitle="View sheets, map events, and compliance across drivers"
          icon={<LayoutDashboard className="w-5 h-5" />}
          actions={
            <Button
              variant="outline"
              className="gap-2 text-slate-600 dark:text-slate-300"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          }
        />

        <nav
          className="mb-6 flex flex-col gap-5 md:flex-row md:flex-wrap md:items-stretch md:gap-0"
          aria-label="Manager shortcuts"
        >
          <div className="space-y-2 md:pr-6">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 px-0.5">
              Team &amp; fleet
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/drivers">
                <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-300">
                  <Users className="w-4 h-4" /> Manage Drivers
                </Button>
              </Link>
              <Link href="/manager/add-managers">
                <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-300">
                  <UserPlus className="w-4 h-4" /> Add Managers
                </Button>
              </Link>
              <Link href="/admin/regos">
                <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-300">
                  <Truck className="w-4 h-4" /> Manage Regos
                </Button>
              </Link>
            </div>
          </div>

          {/* Solid bar so the divider stays visible in light mode (border-slate-* is overridden in globals.css) */}
          <div
            className="hidden md:block w-px shrink-0 self-stretch min-h-[2.75rem] bg-slate-400/90 dark:bg-slate-600"
            aria-hidden="true"
          />

          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700 md:border-t-0 md:pt-0 md:px-6">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 px-0.5">
              Map
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/manager/map">
                <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-300">
                  <MapIcon className="w-4 h-4" /> Event map
                </Button>
              </Link>
            </div>
          </div>

          <div
            className="hidden md:block w-px shrink-0 self-stretch min-h-[2.75rem] bg-slate-400/90 dark:bg-slate-600"
            aria-hidden="true"
          />

          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700 md:border-t-0 md:pt-0 md:pl-6">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 px-0.5">
              Messages
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/manager/messages">
                <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-300">
                  <MessageSquare className="w-4 h-4" /> Messages
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        <section
          className="mb-5 rounded-2xl border-2 border-violet-300/70 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-4 shadow-sm shadow-violet-200/50 dark:border-violet-500/45 dark:from-violet-950/50 dark:via-slate-900 dark:to-sky-950/40 dark:shadow-violet-900/20 sm:p-5"
          aria-label="Compliance snapshot — this week and previous week violations"
        >
          <div className="mb-4 border-b border-violet-300/70 pb-4 dark:border-violet-700/50">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">
              Compliance snapshot
            </p>
            <p className="mt-1 text-xs text-violet-800/80 dark:text-violet-300/80">
              Selected work week and the Sunday week immediately before it.
            </p>
          </div>

          {complianceLoading ? (
            <div className="flex items-center gap-2 text-sm text-violet-800/90 dark:text-violet-200/90">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Loading compliance…
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                    <h2 className="text-lg font-bold tracking-tight text-violet-950 dark:text-violet-100">
                      This week — violations
                    </h2>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-violet-800 dark:text-violet-300">
                    {formatWeekLabel(weekForSnapshot)}
                  </span>
                </div>
                <ViolationListBlock
                  lines={weekViolationLines}
                  emptyLabel="No violations recorded for this week across visible sheets."
                />
              </div>

              <div className="border-t border-violet-300/70 pt-4 dark:border-violet-700/50">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                    <h2 className="text-lg font-bold tracking-tight text-violet-950 dark:text-violet-100">
                      Previous week — violations
                    </h2>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-violet-800 dark:text-violet-300">
                    {formatWeekLabel(prevWeekForSnapshot)}
                  </span>
                </div>
                <ViolationListBlock
                  lines={prevWeekViolationLines}
                  emptyLabel="No violations recorded for the previous week across visible sheets."
                />
              </div>
            </div>
          )}
        </section>

        <div className="overflow-hidden rounded-2xl border-2 border-violet-300/70 bg-white shadow-sm shadow-violet-200/50 dark:border-violet-500/45 dark:bg-slate-900 dark:shadow-violet-900/20">
          <div className="border-b border-violet-200/80 bg-gradient-to-r from-violet-50/90 via-white to-sky-50/50 px-4 py-4 dark:border-violet-800/50 dark:from-violet-950/40 dark:via-slate-900 dark:to-sky-950/30 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                    Manager workbench
                  </p>
                  <h2 className="text-lg font-bold tracking-tight text-violet-950 dark:text-violet-100">
                    Week review &amp; sheets
                  </h2>
                </div>
              </div>
              <div
                role="tablist"
                aria-label="Manager workbench"
                className="flex flex-shrink-0 flex-wrap gap-2"
              >
                <Button
                  type="button"
                  role="tab"
                  aria-selected={managerTab === "compliance"}
                  variant={managerTab === "compliance" ? "default" : "outline"}
                  size="sm"
                  className={
                    managerTab === "compliance"
                      ? "gap-2"
                      : "gap-2 border-violet-300/80 bg-white/80 text-slate-700 hover:bg-violet-50 dark:border-violet-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-violet-950/50"
                  }
                  onClick={() => setManagerTab("compliance")}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Compliance oversight
                </Button>
                <Button
                  type="button"
                  role="tab"
                  aria-selected={managerTab === "edit"}
                  variant={managerTab === "edit" ? "default" : "outline"}
                  size="sm"
                  className={
                    managerTab === "edit"
                      ? "gap-2"
                      : "gap-2 border-violet-300/80 bg-white/80 text-slate-700 hover:bg-violet-50 dark:border-violet-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-violet-950/50"
                  }
                  onClick={() => setManagerTab("edit")}
                >
                  <FileEdit className="h-4 w-4 shrink-0" />
                  Edit sheet inputs
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 pt-5">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {managerTab === "compliance"
              ? "Review a work week by day. Use filters to focus on non-compliant or incomplete sheets, then switch to Edit sheet to open or amend a sheet."
              : "Every sheet for the selected work week appears below (after the driver creates or saves it). Edit header fields such as last 24 hour break, driver type, week starting, and destination — even before any work time is logged."}
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start sm:gap-x-4">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Work week
                </Label>
                <Select
                  value={activeWeekStarting || "all"}
                  onValueChange={(v) => setActiveWeekStarting(v === "all" ? "" : v)}
                  disabled={sheetsLoading}
                >
                  <SelectTrigger className="h-9 w-full border-slate-200 bg-transparent text-sm font-medium dark:border-slate-600">
                    <SelectValue placeholder="Select week…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All weeks</SelectItem>
                    {weekSelectOptions.map((w) => (
                      <SelectItem key={w} value={w}>
                        Week of {formatWeekLabel(w)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Driver
                </Label>
                <Select
                  value={selectedDriverFilter || "__all__"}
                  onValueChange={(v) => setSelectedDriverFilter(v === "__all__" ? "" : v)}
                  disabled={sheetsLoading || !activeWeekStarting}
                >
                  <SelectTrigger className="h-9 w-full border-slate-200 bg-transparent text-sm font-medium dark:border-slate-600">
                    <SelectValue
                      placeholder={
                        !activeWeekStarting ? "Choose a work week first" : "All drivers"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All drivers</SelectItem>
                    {driverOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Rego
                </Label>
                <Select
                  value={selectedRegoFilter || "__all__"}
                  onValueChange={(v) => setSelectedRegoFilter(v === "__all__" ? "" : v)}
                  disabled={sheetsLoading || !activeWeekStarting}
                >
                  <SelectTrigger className="h-9 w-full border-slate-200 bg-transparent text-sm font-medium dark:border-slate-600">
                    <SelectValue
                      placeholder={
                        !activeWeekStarting ? "Choose a work week first" : "All regos"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All regos</SelectItem>
                    {regoOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeWeekStarting && !sheetsLoading ? (
              <div className="flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                {driverOptions.length === 0 ? (
                  <p>No sheets for this work week yet — the &quot;Week starting&quot; on the sheet must match the work week selected above.</p>
                ) : null}
                {regoOptions.length === 0 ? (
                  <p>No rego on any day in this work week (optional filter — sheets still appear below).</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Work day
              </Label>
              <ManagerMonthCalendar
                viewYear={calView.y}
                viewMonth={calView.m}
                onViewPrev={() =>
                  setCalView(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))
                }
                onViewNext={() =>
                  setCalView(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))
                }
                weekStartingYmd={calendarWeekAnchor}
                activeDayIndex={activeDayIndex}
                onSelectDate={(weekStartingYmd, dayIndex) => {
                  setActiveWeekStarting(weekStartingYmd);
                  setActiveDayIndex(dayIndex);
                }}
              />
            </div>

            {managerTab === "compliance" && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={filterOnlyViolations ? "default" : "outline"}
                    onClick={() => setFilterOnlyViolations((v) => !v)}
                  >
                    Violations only
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filterOnlyWarnings ? "default" : "outline"}
                    onClick={() => setFilterOnlyWarnings((v) => !v)}
                  >
                    Warnings only
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filterOnlyIncomplete ? "default" : "outline"}
                    onClick={() => setFilterOnlyIncomplete((v) => !v)}
                  >
                    Incomplete only
                  </Button>
                </div>
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/40 p-4 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-medium text-slate-800 dark:text-slate-100 mb-1">Filter context</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Week:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {activeWeekStarting ? formatWeekLabel(activeWeekStarting) : "All weeks"}
                    </span>
                    {" · "}
                    Day:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {formatDayDateLabel(
                        activeWeekStarting || calendarWeekAnchor,
                        activeDayIndex
                      )}
                    </span>
                    {selectedDriverFilter ? (
                      <>
                        {" · "}
                        Driver:{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {selectedDriverFilter}
                        </span>
                      </>
                    ) : null}
                    {selectedRegoFilter ? (
                      <>
                        {" · "}
                        Rego:{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {selectedRegoFilter}
                        </span>
                      </>
                    ) : null}
                    {(filterOnlyViolations || filterOnlyWarnings || filterOnlyIncomplete) && (
                      <span className="block mt-2 text-slate-500 dark:text-slate-400">
                        Active:{" "}
                        {[
                          filterOnlyViolations && "violations",
                          filterOnlyWarnings && "warnings",
                          filterOnlyIncomplete && "incomplete",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    )}
                  </p>
                </div>
              </>
            )}

            {managerTab === "edit" && (
              <div className="space-y-4 pt-1 border-t border-slate-100 dark:border-slate-700">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Sheet
                </Label>
                <Select
                  value={selectedSheetId || "__none__"}
                  onValueChange={(id) => setSelectedSheetId(id === "__none__" ? "" : id)}
                  disabled={sheetsLoading}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue
                      placeholder={
                        filteredSheetsForPicker.length === 0 && activeWeekStarting
                          ? "No matching sheets for this week / filters"
                          : sheets.length === 0
                            ? "No sheets yet"
                            : "Select a sheet…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Select a sheet —</SelectItem>
                    {filteredSheetsForPicker.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatSheetLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedSheetId && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Select a sheet above to edit driver details, last 24h break, and compliance-related fields.
                  </p>
                )}
                {activeWeekStarting &&
                  filteredSheetsForPicker.length === 0 &&
                  sheets.length > 0 &&
                  !sheetsLoading && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      No sheets overlap this work week with the current driver/rego filters. Set Driver/Rego to
                      &quot;All&quot;, pick the week that contains the driver&apos;s sheet, or wait for the list
                      to refresh after the driver saves. (Very old sheets may be beyond the loaded list limit.)
                    </p>
                  )}
                {sheets.length === 0 && !sheetsLoading && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No sheets yet. Ask drivers to create a sheet from the driver app first.
                  </p>
                )}
              </div>

              {selectedSheetId && (
                <>
                  {sheetLoading ? (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        Loading sheet…
                      </div>
                      <div className="space-y-3 animate-pulse">
                        <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-full max-w-xs" />
                        <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                        <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-full max-w-xs" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Last 24 hour break
                        </Label>
                        <Input
                          type="datetime-local"
                          value={last24hBreakToDatetimeLocalValue(form.last_24h_break)}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              last_24h_break: e.target.value,
                            }))
                          }
                          className="h-9 font-mono max-w-xs"
                        />
                        <p className="text-xs text-slate-400">
                          When the last continuous 24h non-work break ended (date and time). Use today with the
                          actual finish time if starting a shift after that break. Resets 17h and 72h rule
                          segments. Leave empty if not set. Legacy date-only values are treated as end of that
                          day.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Driver type
                        </Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={form.driver_type === "solo" ? "default" : "outline"}
                          onClick={() => setForm((f) => ({ ...f, driver_type: "solo" }))}
                        >
                          Solo
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={form.driver_type === "two_up" ? "default" : "outline"}
                          onClick={() => setForm((f) => ({ ...f, driver_type: "two_up" }))}
                        >
                          Two-Up
                        </Button>
                      </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Week starting
                        </Label>
                        <Input
                          type="date"
                          value={form.week_starting}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              week_starting: e.target.value,
                            }))
                          }
                          className="h-9 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Driver name
                        </Label>
                        <Input
                          value={form.driver_name}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              driver_name: e.target.value,
                            }))
                          }
                          placeholder="Driver name"
                          className="h-9 max-w-xs"
                        />
                      </div>
                      {form.driver_type === "two_up" && (
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                            Second driver
                          </Label>
                          <Input
                            value={form.second_driver}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                second_driver: e.target.value,
                              }))
                            }
                            placeholder="Second driver name"
                            className="h-9 max-w-xs"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Destination
                        </Label>
                        <Input
                          value={form.destination}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              destination: e.target.value,
                            }))
                          }
                          placeholder="Destination"
                          className="h-9 max-w-xs"
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-3 pt-2">
                        <Button
                          onClick={handleSave}
                          disabled={!hasChanges || saveMutation.isPending}
                          className="gap-2"
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : saveMutation.isSuccess ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Save changes
                        </Button>
                        {canAmend && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-50"
                            onClick={() => setShowAmendDialog(true)}
                            disabled={amendMutation.isPending || saveMutation.isPending}
                          >
                            <FileEdit className="w-4 h-4" />
                            Amend (unlock)
                          </Button>
                        )}
                        {saveMutation.isSuccess && (
                          <span className="text-sm text-green-600">
                            Saved.
                          </span>
                        )}
                        {saveMutation.isError && (
                          <span className="text-sm text-red-600">
                            {saveMutation.error instanceof Error
                              ? saveMutation.error.message
                              : "Save failed"}
                          </span>
                        )}
                        <Link href={selectedSheetId ? `/sheets/${selectedSheetId}` : "/sheets"}>
                          <Button variant="outline" size="sm">
                            Open sheet
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50 hover:border-red-300 dark:hover:border-red-700 gap-1"
                          disabled={deleteMutation.isPending}
                          onClick={handleDelete}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Delete sheet
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            )}
          </div>
          </div>
        </div>

        <Dialog open={showAmendDialog} onOpenChange={setShowAmendDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Amend completed sheet</DialogTitle>
              <DialogDescription>
                This will reopen the sheet as <strong>draft</strong> and clear the signature so it can be re-signed. An audit log entry will be recorded.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="amendment_reason" className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Amendment reason (required)
              </Label>
              <Input
                id="amendment_reason"
                value={amendmentReason}
                onChange={(e) => setAmendmentReason(e.target.value)}
                placeholder="e.g. Corrected start KM entered incorrectly by driver"
              />
              {amendMutation.isError && (
                <p className="text-sm text-red-600">
                  {amendMutation.error instanceof Error ? amendMutation.error.message : "Amendment failed."}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAmendDialog(false)} disabled={amendMutation.isPending}>
                Cancel
              </Button>
              <Button
                className="gap-2"
                onClick={() => amendMutation.mutate(amendmentReason)}
                disabled={amendMutation.isPending || amendmentReason.trim().length === 0}
              >
                {amendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Amend & unlock
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
