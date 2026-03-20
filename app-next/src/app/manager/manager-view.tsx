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
import { LayoutDashboard, Save, Loader2, CheckCircle2, FileEdit, Truck, Users, Trash2, UserPlus, AlertTriangle, Map as MapIcon, LogOut, MessageSquare } from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatWeekLabel(weekStarting: string): string {
  return new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const [regoSearch, setRegoSearch] = useState("");
  const [filterOnlyViolations, setFilterOnlyViolations] = useState(false);
  const [filterOnlyWarnings, setFilterOnlyWarnings] = useState(false);
  const [filterOnlyIncomplete, setFilterOnlyIncomplete] = useState(false);
  const [managerTab, setManagerTab] = useState<"compliance" | "edit">("compliance");

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
          <Link href="/manager/messages">
            <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-300">
              <MessageSquare className="w-4 h-4" /> Messages
            </Button>
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div
            role="tablist"
            aria-label="Manager workbench"
            className="flex flex-wrap gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 mb-4"
          >
            <Button
              type="button"
              role="tab"
              aria-selected={managerTab === "compliance"}
              variant={managerTab === "compliance" ? "default" : "ghost"}
              size="sm"
              className="gap-2 rounded-md"
              onClick={() => setManagerTab("compliance")}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Compliance oversight
            </Button>
            <Button
              type="button"
              role="tab"
              aria-selected={managerTab === "edit"}
              variant={managerTab === "edit" ? "default" : "ghost"}
              size="sm"
              className="gap-2 rounded-md"
              onClick={() => setManagerTab("edit")}
            >
              <FileEdit className="w-4 h-4 shrink-0" />
              Edit sheet inputs
            </Button>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {managerTab === "compliance"
              ? "Review a work week by day. Use filters to focus on non-compliant or incomplete sheets, then switch to Edit sheet to open or amend a sheet."
              : "Select a sheet to edit driver-entered fields such as last 24 hour break date, driver type, week starting, and destination."}
          </p>

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
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Rego
                  </Label>
                  <Input
                    value={regoSearch}
                    onChange={(e) => setRegoSearch(e.target.value)}
                    placeholder="Search rego…"
                    className="w-[220px]"
                  />
                </div>
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

            {managerTab === "compliance" && (
              <>
                <div className="flex flex-wrap gap-2">
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
                      {formatDayDateLabel(activeWeekStarting || weekOptions[0] || "", activeDayIndex)}
                    </span>
                    {driverSearch.trim() ? (
                      <>
                        {" · "}
                        Driver:{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {driverSearch.trim()}
                        </span>
                      </>
                    ) : null}
                    {regoSearch.trim() ? (
                      <>
                        {" · "}
                        Rego:{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {regoSearch.trim()}
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

      </div>
    </div>
  );
}
