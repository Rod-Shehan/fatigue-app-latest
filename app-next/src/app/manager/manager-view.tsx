"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type FatigueSheet, type ManagerComplianceItem, type SheetUpdatePayload } from "@/lib/api";
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
import { LayoutDashboard, Save, Loader2, CheckCircle2, FileEdit, Truck, Users, Trash2, UserPlus, AlertTriangle, Coffee, Moon, Clock, TrendingUp, ExternalLink, MapPin, Map as MapIcon, LogOut } from "lucide-react";

const COMPLIANCE_ICON_MAP = {
  Coffee,
  AlertTriangle,
  Moon,
  Clock,
  TrendingUp,
  CheckCircle2,
} as const;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatWeekLabel(weekStarting: string): string {
  return new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format compliance result day for display (e.g. "Sun" + week -> "Sun, 22 Feb"). */
function formatResultDay(day: string, weekStarting: string): string {
  const i = DAY_LABELS.indexOf(day);
  if (i >= 0 && weekStarting) {
    const d = new Date(weekStarting + "T12:00:00");
    d.setDate(d.getDate() + i);
    return `${day}, ${d.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
  }
  return day;
}

const LAST_SHEET_KEY = "fatigue-last-sheet-id";

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

function formatDayDateLabel(weekStarting: string, dayIndex: number): string {
  if (!weekStarting) return DAY_LABELS[dayIndex] ?? `D${dayIndex + 1}`;
  const d = new Date(weekStarting + "T12:00:00");
  d.setDate(d.getDate() + dayIndex);
  const day = DAY_LABELS[dayIndex] ?? `D${dayIndex + 1}`;
  const date = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return `${day} ${date}`;
}

export function ManagerView() {
  const queryClient = useQueryClient();
  const [selectedSheetId, setSelectedSheetId] = useState<string>("");
  const [lastSheetId, setLastSheetId] = useState<string | null>(null);
  const [showAmendDialog, setShowAmendDialog] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [activeWeekStarting, setActiveWeekStarting] = useState<string>("");
  const [activeDayIndex, setActiveDayIndex] = useState<number>(new Date().getDay());
  const [driverSearch, setDriverSearch] = useState("");
  const [filterOnlyViolations, setFilterOnlyViolations] = useState(false);
  const [filterOnlyWarnings, setFilterOnlyWarnings] = useState(false);
  const [filterOnlyIncomplete, setFilterOnlyIncomplete] = useState(false);
  const [expandedDrivers, setExpandedDrivers] = useState<Record<string, boolean>>({});

  const [editWeekStarting, setEditWeekStarting] = useState<string>("");
  const [editDayIndex, setEditDayIndex] = useState<number>(new Date().getDay());
  const [editDriverSearch, setEditDriverSearch] = useState("");
  const [expandedEditDrivers, setExpandedEditDrivers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const id = sessionStorage.getItem(LAST_SHEET_KEY);
      if (id) setLastSheetId(id);
    } catch {
      /* ignore */
    }
  }, []);

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

  useEffect(() => {
    if (activeWeekStarting) return;
    if (weekOptions.length > 0) setActiveWeekStarting(weekOptions[0]!);
  }, [activeWeekStarting, weekOptions]);

  useEffect(() => {
    if (editWeekStarting) return;
    if (weekOptions.length > 0) setEditWeekStarting(weekOptions[0]!);
  }, [editWeekStarting, weekOptions]);

  const { data: selectedSheet, isLoading: sheetLoading } = useQuery({
    queryKey: ["sheet", selectedSheetId],
    queryFn: () => api.sheets.get(selectedSheetId),
    enabled: !!selectedSheetId,
  });

  const { data: complianceOversight, isLoading: oversightLoading } = useQuery({
    queryKey: ["manager", "compliance"],
    queryFn: () => api.manager.compliance(),
    refetchOnWindowFocus: true,
  });
  const oversightItems: ManagerComplianceItem[] = complianceOversight?.items ?? [];
  const itemsWithIssues = oversightItems.filter((i) => i.results.length > 0);

  const oversightBySheetId = useMemo(() => {
    const map = new Map<string, ManagerComplianceItem>();
    for (const item of oversightItems) map.set(item.sheetId, item);
    return map;
  }, [oversightItems]);

  const sheetsForActiveWeek = useMemo(() => {
    const base = activeWeekStarting ? sheets.filter((s) => s.week_starting === activeWeekStarting) : sheets;
    return [...base].sort((a, b) => (a.driver_name || "").localeCompare(b.driver_name || "") || a.id.localeCompare(b.id));
  }, [sheets, activeWeekStarting]);

  const sheetsForEditWeek = useMemo(() => {
    const base = editWeekStarting ? sheets.filter((s) => s.week_starting === editWeekStarting) : sheets;
    return [...base].sort((a, b) => (a.driver_name || "").localeCompare(b.driver_name || "") || a.id.localeCompare(b.id));
  }, [sheets, editWeekStarting]);

  const editPicker = useMemo(() => {
    const dayLabel = DAY_LABELS[editDayIndex] ?? "Sun";
    const normalizedSearch = editDriverSearch.trim().toLowerCase();

    const rows = sheetsForEditWeek
      .map((s) => {
        const oversight = oversightBySheetId.get(s.id);
        // Use day selection to narrow to sheets with compliance activity on that day,
        // but still allow editing any sheet via the dropdown below.
        const dayResults = (oversight?.results ?? []).filter((r) => r.day === dayLabel);
        const hasDaySignals = dayResults.length > 0;
        const isIncomplete = (s.status ?? "").toLowerCase() !== "completed";
        return { sheet: s, oversight, hasDaySignals, isIncomplete };
      })
      .filter((r) => {
        if (normalizedSearch && !(r.sheet.driver_name || "").toLowerCase().includes(normalizedSearch)) return false;
        // If there are compliance signals for the day, surface those first; otherwise show all.
        return true;
      })
      .sort((a, b) => {
        if (a.hasDaySignals !== b.hasDaySignals) return a.hasDaySignals ? -1 : 1;
        if (a.isIncomplete !== b.isIncomplete) return a.isIncomplete ? -1 : 1;
        return (a.sheet.driver_name || "").localeCompare(b.sheet.driver_name || "") || a.sheet.id.localeCompare(b.sheet.id);
      });

    const drivers = new Map<string, { driver: string; rows: typeof rows; totals: { sheets: number; incomplete: number; withSignals: number } }>();
    for (const r of rows) {
      const driver = r.sheet.driver_name || "Unnamed driver";
      const entry = drivers.get(driver) ?? { driver, rows: [], totals: { sheets: 0, incomplete: 0, withSignals: 0 } };
      entry.rows.push(r);
      entry.totals.sheets += 1;
      if (r.isIncomplete) entry.totals.incomplete += 1;
      if (r.hasDaySignals) entry.totals.withSignals += 1;
      drivers.set(driver, entry);
    }

    const driverGroups = [...drivers.values()].sort((a, b) => {
      if (a.totals.withSignals !== b.totals.withSignals) return b.totals.withSignals - a.totals.withSignals;
      if (a.totals.incomplete !== b.totals.incomplete) return b.totals.incomplete - a.totals.incomplete;
      return a.driver.localeCompare(b.driver);
    });

    const summary = driverGroups.reduce(
      (acc, g) => {
        acc.drivers += 1;
        acc.sheets += g.totals.sheets;
        acc.incomplete += g.totals.incomplete;
        acc.withSignals += g.totals.withSignals;
        return acc;
      },
      { drivers: 0, sheets: 0, incomplete: 0, withSignals: 0 }
    );

    return { dayLabel, driverGroups, summary };
  }, [sheetsForEditWeek, oversightBySheetId, editDayIndex, editDriverSearch]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const g of editPicker.driverGroups) {
      next[g.driver] = g.totals.withSignals > 0;
    }
    setExpandedEditDrivers(next);
  }, [editPicker.dayLabel, editWeekStarting]);

  const dayBucket = useMemo(() => {
    const dayLabel = DAY_LABELS[activeDayIndex] ?? "Sun";
    const normalizedSearch = driverSearch.trim().toLowerCase();

    const rows = sheetsForActiveWeek
      .map((s) => {
        const oversight = oversightBySheetId.get(s.id);
        const dayResults = (oversight?.results ?? []).filter((r) => r.day === dayLabel);
        const violations = dayResults.filter((r) => r.type === "violation").length;
        const warnings = dayResults.filter((r) => r.type === "warning").length;
        const isIncomplete = (s.status ?? "").toLowerCase() !== "completed";
        return { sheet: s, oversight, dayResults, violations, warnings, isIncomplete };
      })
      .filter((r) => {
        if (normalizedSearch && !(r.sheet.driver_name || "").toLowerCase().includes(normalizedSearch)) return false;
        if (filterOnlyIncomplete && !r.isIncomplete) return false;
        if (filterOnlyViolations && r.violations === 0) return false;
        if (filterOnlyWarnings && r.warnings === 0) return false;
        return true;
      });

    const drivers = new Map<
      string,
      {
        driver: string;
        rows: typeof rows;
        totals: { violations: number; warnings: number; sheets: number; incomplete: number };
      }
    >();
    for (const r of rows) {
      const driver = r.sheet.driver_name || "Unnamed driver";
      const entry = drivers.get(driver) ?? {
        driver,
        rows: [],
        totals: { violations: 0, warnings: 0, sheets: 0, incomplete: 0 },
      };
      entry.rows.push(r);
      entry.totals.sheets += 1;
      entry.totals.violations += r.violations;
      entry.totals.warnings += r.warnings;
      if (r.isIncomplete) entry.totals.incomplete += 1;
      drivers.set(driver, entry);
    }

    const driverGroups = [...drivers.values()].sort((a, b) => {
      const aIssue = a.totals.violations + a.totals.warnings;
      const bIssue = b.totals.violations + b.totals.warnings;
      if (aIssue !== bIssue) return bIssue - aIssue;
      return a.driver.localeCompare(b.driver);
    });

    const summary = driverGroups.reduce(
      (acc, g) => {
        acc.drivers += 1;
        acc.sheets += g.totals.sheets;
        acc.violations += g.totals.violations;
        acc.warnings += g.totals.warnings;
        acc.incomplete += g.totals.incomplete;
        return acc;
      },
      { drivers: 0, sheets: 0, violations: 0, warnings: 0, incomplete: 0 }
    );

    return { dayLabel, driverGroups, summary };
  }, [
    sheetsForActiveWeek,
    oversightBySheetId,
    activeDayIndex,
    driverSearch,
    filterOnlyIncomplete,
    filterOnlyViolations,
    filterOnlyWarnings,
  ]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const g of dayBucket.driverGroups) {
      const hasIssues = g.totals.violations + g.totals.warnings > 0;
      next[g.driver] = hasIssues;
    }
    setExpandedDrivers(next);
  }, [dayBucket.dayLabel, activeWeekStarting, filterOnlyIncomplete, filterOnlyViolations, filterOnlyWarnings]);

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

        <div className="flex gap-2 flex-wrap mb-6">
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
          <Link href="/drivers">
            <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-300">
              <Users className="w-4 h-4" /> Manage Drivers
            </Button>
          </Link>
          <Link href="/manager/map">
            <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-300">
              <MapIcon className="w-4 h-4" /> Event map
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileEdit className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Edit sheet inputs
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Select a sheet to edit driver-entered fields such as last 24 hour
              break date, driver type, week starting, and destination.
            </p>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end justify-between">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Work week
                  </Label>
                  <Select
                    value={editWeekStarting || "all"}
                    onValueChange={(v) => setEditWeekStarting(v === "all" ? "" : v)}
                    disabled={sheetsLoading}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select week…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All weeks</SelectItem>
                      {weekOptions.map((w) => (
                        <SelectItem key={w} value={w}>
                          Week of {formatWeekLabel(w)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Driver
                  </Label>
                  <Input
                    value={editDriverSearch}
                    onChange={(e) => setEditDriverSearch(e.target.value)}
                    placeholder="Search driver…"
                    className="w-[220px]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((d, idx) => {
                  const active = idx === editDayIndex;
                  const weekForLabel = editWeekStarting || weekOptions[0] || "";
                  return (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => setEditDayIndex(idx)}
                      className="rounded-full"
                    >
                      {formatDayDateLabel(weekForLabel, idx)}
                    </Button>
                  );
                })}
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {editPicker.dayLabel}: {editPicker.summary.sheets} sheets across {editPicker.summary.drivers} drivers
                  </span>
                  <span className="flex gap-3">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {editPicker.summary.incomplete} incomplete
                    </span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {editPicker.summary.withSignals} with day flags
                    </span>
                  </span>
                </div>

                {editPicker.driverGroups.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No matching drivers for this week/day. Try clearing the driver search.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editPicker.driverGroups.map((g) => {
                      const isOpen = expandedEditDrivers[g.driver] ?? false;
                      return (
                        <div key={g.driver} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedEditDrivers((s) => ({ ...s, [g.driver]: !(s[g.driver] ?? false) }))}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                          >
                            <div className="text-left">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">{g.driver}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {g.totals.sheets} sheet{g.totals.sheets === 1 ? "" : "s"}
                                {g.totals.incomplete ? ` • ${g.totals.incomplete} incomplete` : ""}
                              </p>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {isOpen ? "Hide" : "Show"}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4 space-y-2">
                              {g.rows.map((r) => {
                                const isSelected = r.sheet.id === selectedSheetId;
                                const status = (r.sheet.status ?? "").toLowerCase();
                                const statusLabel =
                                  status === "completed"
                                    ? "Completed"
                                    : status
                                      ? status[0].toUpperCase() + status.slice(1)
                                      : "Draft";
                                return (
                                  <button
                                    key={r.sheet.id}
                                    type="button"
                                    onClick={() => setSelectedSheetId(r.sheet.id)}
                                    className={[
                                      "w-full text-left rounded-lg border px-3 py-2 transition",
                                      isSelected
                                        ? "border-slate-900 dark:border-slate-100 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200",
                                    ].join(" ")}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-semibold">
                                        {statusLabel}
                                      </span>
                                      {r.hasDaySignals ? (
                                        <span className={isSelected ? "text-xs opacity-90" : "text-xs text-amber-600 dark:text-amber-300 font-semibold"}>
                                          Has day items
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className={isSelected ? "text-xs opacity-90" : "text-xs text-slate-500 dark:text-slate-400"}>
                                      Week of {formatWeekLabel(r.sheet.week_starting)}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

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
                    <SelectValue placeholder={sheets.length === 0 ? "No sheets yet" : "Select a sheet…"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Select a sheet —</SelectItem>
                    {sheets.map((s) => (
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
                          type="date"
                          value={form.last_24h_break}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              last_24h_break: e.target.value,
                            }))
                          }
                          className="h-9 font-mono max-w-xs"
                        />
                        <p className="text-xs text-slate-400">
                          Date of last 24h non-work time; resets 17h and 72h rules. Leave
                          empty if not set.
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
                          className="rounded-full"
                        >
                          Solo
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={form.driver_type === "two_up" ? "default" : "outline"}
                          onClick={() => setForm((f) => ({ ...f, driver_type: "two_up" }))}
                          className="rounded-full"
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

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Compliance oversight
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Review a work week by day. Use filters to focus on non-compliant or incomplete sheets, then open a sheet to edit.
            </p>
            {oversightLoading ? (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <Loader2 className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 animate-spin" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Loading compliance…</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end justify-between">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      Work week
                    </Label>
                    <Select
                      value={activeWeekStarting || "all"}
                      onValueChange={(v) => setActiveWeekStarting(v === "all" ? "" : v)}
                      disabled={sheetsLoading}
                    >
                      <SelectTrigger className="w-[240px]">
                        <SelectValue placeholder="Select week…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All weeks</SelectItem>
                        {weekOptions.map((w) => (
                          <SelectItem key={w} value={w}>
                            Week of {formatWeekLabel(w)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Driver
                      </Label>
                      <Input
                        value={driverSearch}
                        onChange={(e) => setDriverSearch(e.target.value)}
                        placeholder="Search driver…"
                        className="w-[220px]"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={filterOnlyViolations ? "default" : "outline"}
                      onClick={() => setFilterOnlyViolations((v) => !v)}
                      className="rounded-full"
                    >
                      Violations only
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={filterOnlyWarnings ? "default" : "outline"}
                      onClick={() => setFilterOnlyWarnings((v) => !v)}
                      className="rounded-full"
                    >
                      Warnings only
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={filterOnlyIncomplete ? "default" : "outline"}
                      onClick={() => setFilterOnlyIncomplete((v) => !v)}
                      className="rounded-full"
                    >
                      Incomplete only
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((d, idx) => {
                    const active = idx === activeDayIndex;
                    const weekForLabel = activeWeekStarting || weekOptions[0] || "";
                    return (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() => setActiveDayIndex(idx)}
                        className="rounded-full"
                      >
                        {formatDayDateLabel(weekForLabel, idx)}
                      </Button>
                    );
                  })}
                </div>

                {sheets.length === 0 ? (
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <AlertTriangle className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No sheets yet</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Ask drivers to create a sheet from the driver app: Your Sheets → Start New Week.
                      </p>
                    </div>
                  </div>
                ) : dayBucket.driverGroups.length === 0 ? (
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No matches</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Try clearing filters or searching a different driver.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        {dayBucket.dayLabel} summary: {dayBucket.summary.sheets} sheets across {dayBucket.summary.drivers} drivers
                      </span>
                      <span className="flex gap-3">
                        <span className="text-red-600 dark:text-red-300 font-semibold">
                          {dayBucket.summary.violations} violations
                        </span>
                        <span className="text-amber-600 dark:text-amber-300 font-semibold">
                          {dayBucket.summary.warnings} warnings
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 font-semibold">
                          {dayBucket.summary.incomplete} incomplete
                        </span>
                      </span>
                    </div>

                    {dayBucket.driverGroups.map((g) => {
                      const isOpen = expandedDrivers[g.driver] ?? false;
                      const issues = g.totals.violations + g.totals.warnings;
                      return (
                        <div
                          key={g.driver}
                          className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDrivers((s) => ({ ...s, [g.driver]: !(s[g.driver] ?? false) }))
                            }
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <div className="text-left">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">{g.driver}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {g.totals.sheets} sheet{g.totals.sheets === 1 ? "" : "s"}
                                {g.totals.incomplete ? ` • ${g.totals.incomplete} incomplete` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {g.totals.violations > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 font-semibold">
                                  {g.totals.violations} V
                                </span>
                              )}
                              {g.totals.warnings > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200 font-semibold">
                                  {g.totals.warnings} W
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                                {issues === 0 ? "OK" : "Issues"}
                              </span>
                              <span className="text-slate-400">{isOpen ? "Hide" : "Show"}</span>
                            </div>
                          </button>

                          {isOpen && (
                            <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
                              {g.rows.map((r) => {
                                const status = (r.sheet.status ?? "").toLowerCase();
                                const statusLabel =
                                  status === "completed"
                                    ? "Completed"
                                    : status
                                      ? status[0].toUpperCase() + status.slice(1)
                                      : "Draft";
                                return (
                                  <div key={r.sheet.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                          <span>{statusLabel}</span>
                                          {(r.violations > 0 || r.warnings > 0) && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                              {r.violations > 0 ? `${r.violations} violations` : ""}
                                              {r.violations > 0 && r.warnings > 0 ? " • " : ""}
                                              {r.warnings > 0 ? `${r.warnings} warnings` : ""}
                                            </span>
                                          )}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                          Week of {formatWeekLabel(r.sheet.week_starting)}
                                          {r.oversight?.totalEvents != null && r.oversight.totalEvents > 0 ? (
                                            <>
                                              {" "}
                                              • <MapPin className="inline w-3 h-3 -mt-0.5" aria-hidden />{" "}
                                              {r.oversight.eventsWithLocation ?? 0}/{r.oversight.totalEvents} events with location
                                            </>
                                          ) : null}
                                        </p>
                                      </div>
                                      <div className="flex gap-2">
                                        <Link href={`/sheets/${r.sheet.id}`}>
                                          <Button variant="outline" size="sm" className="gap-1.5">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Open sheet
                                          </Button>
                                        </Link>
                                        <a href={api.sheets.exportPdfUrl(r.sheet.id)} target="_blank" rel="noreferrer">
                                          <Button variant="outline" size="sm" className="gap-1.5">
                                            <FileEdit className="w-3.5 h-3.5" />
                                            PDF
                                          </Button>
                                        </a>
                                      </div>
                                    </div>

                                    {(r.dayResults?.length ?? 0) > 0 && (
                                      <div className="mt-3 space-y-1.5">
                                        {r.dayResults.map((res, idx) => {
                                          const Icon = COMPLIANCE_ICON_MAP[res.iconKey as keyof typeof COMPLIANCE_ICON_MAP];
                                          const isViolation = res.type === "violation";
                                          const bg = isViolation
                                            ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800"
                                            : "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800";
                                          const fg = isViolation
                                            ? "text-red-700 dark:text-red-200"
                                            : "text-amber-700 dark:text-amber-200";
                                          const iconFg = isViolation
                                            ? "text-red-500 dark:text-red-400"
                                            : "text-amber-500 dark:text-amber-400";
                                          return (
                                            <div key={idx} className={`flex items-start gap-2 border rounded-lg p-2.5 ${bg}`}>
                                              {Icon && <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconFg}`} />}
                                              <p className={`text-xs ${fg}`}>{res.message}</p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
