"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { User, Users, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { formatSheetDisplayDate } from "@/lib/weeks";
import { DEFAULT_JURISDICTION_CODE, getJurisdictionOptions } from "@/lib/jurisdiction";
import { getDisplayNameFromSession } from "@/lib/session-display-name";

type SheetData = {
  driver_name?: string;
  second_driver?: string;
  driver_type?: string;
  jurisdiction_code?: string;
  last_24h_break?: string;
  week_starting?: string;
};

export default function SheetHeader({
  sheetData,
  onChange,
  readOnly = false,
  /** When true, primary driver is shown elsewhere (e.g. page title tile); keep second driver + rest. */
  hidePrimaryDriverField = false,
}: {
  sheetData: SheetData;
  onChange: (s: Partial<SheetData>) => void;
  readOnly?: boolean;
  hidePrimaryDriverField?: boolean;
}) {
  const last24hDateInputRef = useRef<HTMLInputElement>(null);
  const [confirmLast24hOpen, setConfirmLast24hOpen] = useState(false);
  const [pendingLast24hDate, setPendingLast24hDate] = useState<string>("");
  const [confirmLast24hChecked, setConfirmLast24hChecked] = useState(false);
  const [last24hPickerValue, setLast24hPickerValue] = useState("");
  const [last24hPickerResetKey, setLast24hPickerResetKey] = useState(0);

  const handleChange = (field: string, value: unknown) => {
    onChange({ ...sheetData, [field]: value });
  };
  const driverType = sheetData.driver_type || "solo";
  const last24hSet = !!sheetData.last_24h_break?.trim();

  const { data: session, status: sessionStatus } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const isManager = role === "manager";
  const sessionDriverName = getDisplayNameFromSession(session ?? null);

  /** Drivers: primary name always comes from the account; managers see the name stored on the sheet. */
  useEffect(() => {
    if (readOnly || isManager || sessionStatus !== "authenticated") return;
    if (!sessionDriverName) return;
    if (sheetData.driver_name === sessionDriverName) return;
    onChange({ driver_name: sessionDriverName });
  }, [readOnly, isManager, sessionStatus, sessionDriverName, sheetData.driver_name, onChange]);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
    /** Only need roster for Two-Up second driver picker */
    enabled: driverType === "two_up",
  });
  const activeDrivers = drivers.filter((d) => d.is_active);

  return (
    <div className="space-y-4">
      {/* Row 1: Driver type + optional primary name in form; Two-Up adds second driver */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5 shrink-0">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block">
            Driver Type
          </Label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden dark:border-slate-500 dark:bg-slate-950 dark:p-1 dark:gap-1">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => handleChange("driver_type", "solo")}
              className={`min-w-[4.5rem] px-4 py-1.5 text-xs font-semibold transition-colors rounded-none dark:rounded-md ${
                driverType === "solo"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:shadow-md dark:ring-1 dark:ring-white/30"
                  : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900/40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              }`}
            >
              Solo
            </button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => handleChange("driver_type", "two_up")}
              className={`min-w-[4.5rem] px-4 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 dark:border-0 rounded-none dark:rounded-md ${
                driverType === "two_up"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:shadow-md dark:ring-1 dark:ring-white/30"
                  : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900/40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              }`}
            >
              Two-Up
            </button>
          </div>
        </div>
        {!hidePrimaryDriverField && (
          <div className="space-y-1.5 flex-1 min-w-0 sm:min-w-[12rem]">
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <User className="w-3 h-3" /> Driver Name
            </Label>
            <div
              className="flex h-9 w-full items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100"
              title={isManager ? "Driver name on this sheet" : "From your account (login name)"}
            >
              <span className="truncate">
                {readOnly
                  ? sheetData.driver_name || "—"
                  : isManager
                    ? sheetData.driver_name || "—"
                    : sessionStatus === "loading"
                      ? "…"
                      : sessionDriverName || sheetData.driver_name || "—"}
              </span>
            </div>
          </div>
        )}
        {driverType === "two_up" && (
          <div className="space-y-1.5 flex-1 min-w-0 sm:min-w-[12rem] w-full sm:w-auto">
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Second Driver *
            </Label>
            {activeDrivers.length > 0 ? (
              <Select
                value={sheetData.second_driver === "" || sheetData.second_driver == null ? "__none__" : sheetData.second_driver}
                onValueChange={(val) => handleChange("second_driver", val === "__none__" ? "" : val)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-9 border-amber-300 w-full">
                  <SelectValue placeholder="Required for Two-Up" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {activeDrivers.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={sheetData.second_driver || ""}
                onChange={(e) => handleChange("second_driver", e.target.value)}
                placeholder="Required for Two-Up"
                className="h-9 border-amber-300 text-sm font-medium focus:border-amber-400"
                disabled={readOnly}
              />
            )}
          </div>
        )}
      </div>

      {/* Sheet-level rule set (Australia-wide roadmap); WA only for now */}
      <div className="space-y-1.5 max-w-md">
        <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block">
          Rule set
        </Label>
        <Select
          value={sheetData.jurisdiction_code || DEFAULT_JURISDICTION_CODE}
          onValueChange={(val) => handleChange("jurisdiction_code", val)}
          disabled={readOnly}
        >
          <SelectTrigger className="h-9 font-medium w-full">
            <SelectValue placeholder="Select rule set…" />
          </SelectTrigger>
          <SelectContent>
            {getJurisdictionOptions().map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          Additional states / NHVR-oriented packs will appear here as they are implemented.
        </p>
      </div>

      {/* Row 2: Week starting (left) + Last 24 hour break (right) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Week Starting
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Week is set when this sheet is created. Ask your manager if it needs to be changed."
            className="h-9 w-full justify-start gap-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 font-medium opacity-100 cursor-not-allowed"
          >
            <Calendar className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="tabular-nums font-normal text-slate-500 dark:text-slate-400">
              {sheetData.week_starting ? formatSheetDisplayDate(sheetData.week_starting) : "—"}
            </span>
            <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Locked
            </span>
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Last 24 Hour Break
          </Label>
          {last24hSet ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="h-9 w-full justify-start gap-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 font-medium opacity-100 cursor-not-allowed"
            >
              <Calendar className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
              <span className="tabular-nums font-normal text-slate-500 dark:text-slate-400">
                {formatSheetDisplayDate(sheetData.last_24h_break!)}
              </span>
              <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Locked
              </span>
            </Button>
          ) : (
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600" />
              <input
                key={last24hPickerResetKey}
                ref={last24hDateInputRef}
                type="date"
                value={last24hPickerValue}
                placeholder="Set last 24h break"
                disabled={readOnly}
                onChange={(e) => {
                  const v = e.target.value;
                  setLast24hPickerValue(v);
                  if (v) {
                    setPendingLast24hDate(v);
                    setConfirmLast24hChecked(false);
                    setConfirmLast24hOpen(true);
                  }
                }}
                className="h-9 w-full rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 pl-10 pr-3 text-sm font-medium tabular-nums text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300"
                aria-label="Set last 24 hour break date"
              />
              <Dialog
                open={confirmLast24hOpen}
                onOpenChange={(open) => {
                  setConfirmLast24hOpen(open);
                  if (!open) {
                    setPendingLast24hDate("");
                    setConfirmLast24hChecked(false);
                    setLast24hPickerValue("");
                    setLast24hPickerResetKey((k) => k + 1);
                  }
                }}
              >
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Confirm last 24 hour break</DialogTitle>
                    <DialogDescription>
                      Set this date as your last 24 hour break? Once set, it will be locked for this sheet (manager amendment required to change).
                    </DialogDescription>
                  </DialogHeader>
                  {pendingLast24hDate && (
                    <p className="text-sm font-medium tabular-nums text-slate-800 dark:text-slate-100">
                      {formatSheetDisplayDate(pendingLast24hDate)}
                    </p>
                  )}
                  <label className="flex items-start gap-2 pt-1 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={confirmLast24hChecked}
                      onChange={(e) => setConfirmLast24hChecked(e.target.checked)}
                    />
                    <span>I confirm this date is correct.</span>
                  </label>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setConfirmLast24hOpen(false);
                        setPendingLast24hDate("");
                        setConfirmLast24hChecked(false);
                        setLast24hPickerValue("");
                        setLast24hPickerResetKey((k) => k + 1);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!confirmLast24hChecked}
                      onClick={() => {
                        handleChange("last_24h_break", pendingLast24hDate);
                        setConfirmLast24hOpen(false);
                        setPendingLast24hDate("");
                        setConfirmLast24hChecked(false);
                        setLast24hPickerValue("");
                        setLast24hPickerResetKey((k) => k + 1);
                      }}
                      className="min-w-24 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40"
                    >
                      Confirm
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
