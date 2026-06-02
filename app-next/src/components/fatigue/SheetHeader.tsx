"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { driverSegmentBtn } from "@/components/driver/driver-ui-classes";

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
  /** Right side of driver-type row (e.g. More menu, save status). */
  headerActions,
}: {
  sheetData: SheetData;
  onChange: (s: Partial<SheetData>) => void;
  readOnly?: boolean;
  hidePrimaryDriverField?: boolean;
  headerActions?: React.ReactNode;
}) {
  const last24hDateInputRef = useRef<HTMLInputElement>(null);
  const [confirmLast24hOpen, setConfirmLast24hOpen] = useState(false);
  const [pendingLast24hDate, setPendingLast24hDate] = useState<string>("");
  const [confirmLast24hChecked, setConfirmLast24hChecked] = useState(false);
  const [last24hPickerResetKey, setLast24hPickerResetKey] = useState(0);

  const openLast24hPicker = useCallback(() => {
    const el = last24hDateInputRef.current;
    if (!el || readOnly) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.click();
  }, [readOnly]);

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
      {/* Row 1: Driver type + optional primary name; actions (More) on the right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end flex-1 min-w-0">
        <div className="space-y-1.5 shrink-0">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block">
            Driver Type
          </Label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden dark:border-slate-500 dark:bg-slate-950 dark:p-1 dark:gap-1">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => handleChange("driver_type", "solo")}
              className={`min-w-[5rem] ${driverSegmentBtn} rounded-none dark:rounded-md ${
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
              className={`min-w-[5rem] ${driverSegmentBtn} transition-colors border-l border-slate-200 dark:border-0 rounded-none dark:rounded-md ${
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
        {headerActions != null && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:ml-auto">{headerActions}</div>
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
              disabled
              className="h-14 min-h-[56px] w-full justify-start gap-3 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-base text-slate-700 dark:text-slate-200 font-medium opacity-100 cursor-not-allowed"
            >
              <Calendar className="w-6 h-6 shrink-0 text-slate-500 dark:text-slate-400" />
              <span className="tabular-nums font-semibold text-slate-600 dark:text-slate-300">
                {formatSheetDisplayDate(sheetData.last_24h_break!)}
              </span>
              <span className="ml-auto text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Locked
              </span>
            </Button>
          ) : (
            <>
              <input
                key={last24hPickerResetKey}
                ref={last24hDateInputRef}
                type="date"
                disabled={readOnly}
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    setPendingLast24hDate(v);
                    setConfirmLast24hChecked(false);
                    setConfirmLast24hOpen(true);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={readOnly}
                onClick={openLast24hPicker}
                className="h-14 min-h-[56px] w-full justify-start gap-3 border-2 border-amber-400 dark:border-amber-600 bg-amber-50 hover:bg-amber-100/90 dark:bg-amber-950/50 dark:hover:bg-amber-950/70 text-base font-semibold text-amber-950 dark:text-amber-50 shadow-sm"
                aria-label="Open calendar to set last 24 hour break date"
              >
                <Calendar className="w-6 h-6 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                <span className="text-left leading-tight">
                  Tap to choose date
                  <span className="block text-xs font-normal text-amber-800/80 dark:text-amber-200/80 mt-0.5">
                    Opens your phone calendar — no typing
                  </span>
                </span>
              </Button>
              <Dialog
                open={confirmLast24hOpen}
                onOpenChange={(open) => {
                  setConfirmLast24hOpen(open);
                  if (!open) {
                    setPendingLast24hDate("");
                    setConfirmLast24hChecked(false);
                    setLast24hPickerResetKey((k) => k + 1);
                  }
                }}
              >
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Confirm last 24 hour break</DialogTitle>
                    <DialogDescription>
                      Set this date as your last 24 hour break? Once set, it will be locked for this sheet (manager amendment required to change).
                    </DialogDescription>
                  </DialogHeader>
                  {pendingLast24hDate && (
                    <p className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100 py-1">
                      {formatSheetDisplayDate(pendingLast24hDate)}
                    </p>
                  )}
                  <label className="flex items-start gap-3 pt-1 text-base text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0"
                      checked={confirmLast24hChecked}
                      onChange={(e) => setConfirmLast24hChecked(e.target.checked)}
                    />
                    <span>I confirm this date is correct.</span>
                  </label>
                  <div className="flex flex-col-reverse sm:flex-row flex-wrap gap-2 justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 text-base sm:mr-auto"
                      onClick={() => {
                        setConfirmLast24hChecked(false);
                        openLast24hPicker();
                      }}
                    >
                      Pick another date
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 text-base"
                      onClick={() => {
                        setConfirmLast24hOpen(false);
                        setPendingLast24hDate("");
                        setConfirmLast24hChecked(false);
                        setLast24hPickerResetKey((k) => k + 1);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={!confirmLast24hChecked}
                      onClick={() => {
                        handleChange("last_24h_break", pendingLast24hDate);
                        setConfirmLast24hOpen(false);
                        setPendingLast24hDate("");
                        setConfirmLast24hChecked(false);
                        setLast24hPickerResetKey((k) => k + 1);
                      }}
                      className="min-h-11 text-base min-w-28 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40"
                    >
                      Confirm
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
