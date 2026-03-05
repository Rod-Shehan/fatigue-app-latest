"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type FatigueSheet, type ManagerComplianceItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutDashboard, Save, Loader2, CheckCircle2, FileEdit, Truck, Users, Trash2, UserPlus, AlertTriangle, Coffee, Moon, Clock, TrendingUp, ExternalLink, MapPin, Map } from "lucide-react";

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

export function ManagerView() {
  const queryClient = useQueryClient();
  const [selectedSheetId, setSelectedSheetId] = useState<string>("");
  const [lastSheetId, setLastSheetId] = useState<string | null>(null);

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
    mutationFn: (payload: Partial<FatigueSheet>) =>
      api.sheets.update(selectedSheetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheet", selectedSheetId] });
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      queryClient.invalidateQueries({ queryKey: ["manager", "compliance"] });
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
          backHref={selectedSheetId ? `/sheets/${selectedSheetId}` : lastSheetId ? `/sheets/${lastSheetId}` : "/sheets"}
          backLabel={selectedSheetId || lastSheetId ? "Fatigue Record" : "Driver sheets"}
          title="Manager dashboard"
          subtitle="View sheets, map events, and compliance across drivers"
          icon={<LayoutDashboard className="w-5 h-5" />}
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
              <Map className="w-4 h-4" /> Event map
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
                        <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden w-fit">
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({ ...f, driver_type: "solo" }))
                            }
                            className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                              form.driver_type === "solo"
                                ? "bg-slate-900 dark:bg-slate-600 text-white dark:text-slate-100"
                                : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                          >
                            Solo
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                driver_type: "two_up",
                              }))
                            }
                            className={`px-4 py-1.5 text-xs font-bold transition-colors border-l border-slate-200 dark:border-slate-600 ${
                              form.driver_type === "two_up"
                                ? "bg-slate-900 dark:bg-slate-600 text-white dark:text-slate-100"
                                : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                          >
                            Two-Up
                          </button>
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

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Compliance oversight
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Violations and warnings from all drivers’ fatigue sheets. Click a sheet to open and edit.
            </p>
            {oversightLoading ? (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <Loader2 className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 animate-spin" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Loading compliance…</span>
              </div>
            ) : itemsWithIssues.length === 0 ? (
              <div className="rounded-lg p-4 space-y-2">
                {oversightItems.length === 0 ? (
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <AlertTriangle className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No sheets yet</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Ask drivers to create a sheet from the driver app: Your Sheets → Start New Week. Compliance will appear here once sheets exist.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-200">
                      All drivers compliant — no violations or warnings.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {itemsWithIssues.map((item) => {
                  const violations = item.results.filter((r) => r.type === "violation");
                  const warnings = item.results.filter((r) => r.type === "warning");
                  return (
                    <div
                      key={item.sheetId}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.driver_name || "Unnamed driver"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Week of {formatWeekLabel(item.week_starting)}
                          </p>
                          {item.totalEvents != null && item.totalEvents > 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" aria-hidden />
                              Location: {item.eventsWithLocation ?? 0}/{item.totalEvents} events
                            </p>
                          )}
                        </div>
                        <Link href={`/sheets/${item.sheetId}`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open sheet
                          </Button>
                        </Link>
                      </div>
                      {violations.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wider text-red-500 dark:text-red-400 font-bold">
                            Violations ({violations.length})
                          </p>
                          {violations.map((v, i) => {
                            const Icon = COMPLIANCE_ICON_MAP[v.iconKey as keyof typeof COMPLIANCE_ICON_MAP];
                            return (
                              <div
                                key={`v-${i}`}
                                className="flex items-start gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-2.5"
                              >
                                {Icon && <Icon className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />}
                                <p className="text-xs text-red-700 dark:text-red-200">
                                  {v.message} — {formatResultDay(v.day, item.week_starting)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {warnings.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wider text-amber-500 dark:text-amber-400 font-bold">
                            Warnings ({warnings.length})
                          </p>
                          {warnings.map((w, i) => {
                            const Icon = COMPLIANCE_ICON_MAP[w.iconKey as keyof typeof COMPLIANCE_ICON_MAP];
                            return (
                              <div
                                key={`w-${i}`}
                                className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5"
                              >
                                {Icon && <Icon className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />}
                                <p className="text-xs text-amber-700 dark:text-amber-200">
                                  {w.message}
                                  {w.message.includes("72h window ending") ? "" : ` — ${formatResultDay(w.day, item.week_starting)}`}
                                </p>
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
        </div>
      </div>
    </div>
  );
}
