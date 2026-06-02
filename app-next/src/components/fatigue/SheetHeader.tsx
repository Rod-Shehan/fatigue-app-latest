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
import { cn } from "@/lib/utils";

type SheetData = {
  driver_name?: string;
  second_driver?: string;
  driver_type?: string;
  jurisdiction_code?: string;
  last_24h_break?: string;
  week_starting?: string;
};

const dateChipBase =
  "inline-flex items-center gap-1.5 h-10 min-h-10 px-2.5 rounded-lg border text-sm font-medium shrink min-w-0 max-w-[11rem] sm:max-w-none";

function HeaderDateChip({
  label,
  value,
  locked,
  highlight,
  disabled,
  onClick,
  title,
}: {
  label: string;
  value: string;
  locked?: boolean;
  highlight?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const className = cn(
    dateChipBase,
    highlight
      ? "border-2 border-amber-400 dark:border-amber-600 bg-amber-50 hover:bg-amber-100/90 dark:bg-amber-950/50 dark:hover:bg-amber-950/70 text-amber-950 dark:text-amber-50"
      : locked
        ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 cursor-default"
        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
  );

  const content = (
    <>
      <Calendar
        className={cn(
          "w-3.5 h-3.5 shrink-0",
          highlight ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"
        )}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
      <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">
        {label}
      </span>
      <span className={cn("tabular-nums truncate", highlight ? "font-semibold" : "font-medium text-slate-600 dark:text-slate-300")}>
        {value}
      </span>
      {locked && (
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 shrink-0 ml-auto">
          Locked
        </span>
      )}
    </>
  );

  if (onClick && !locked) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={className}
        title={title}
        aria-label={title ?? label}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} title={title}>
      {content}
    </div>
  );
}

export default function SheetHeader({
  sheetData,
  onChange,
  readOnly = false,
  /** When true, primary driver is shown elsewhere (e.g. page title tile); keep second driver + rest. */
  hidePrimaryDriverField = false,
  /** Right side of the compact row (e.g. gear drawer, save status). */
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
  const jurisdictionCode = sheetData.jurisdiction_code?.trim() ?? "";
  const jurisdictionOptions = getJurisdictionOptions();
  const showRuleSetPicker = !readOnly && !jurisdictionCode;

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

  /** Auto-select when only one rule set exists (keeps picker hidden). */
  useEffect(() => {
    if (readOnly || jurisdictionCode) return;
    if (jurisdictionOptions.length === 1) {
      onChange({ jurisdiction_code: jurisdictionOptions[0].value });
    }
  }, [readOnly, jurisdictionCode, jurisdictionOptions, onChange]);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
    enabled: driverType === "two_up",
  });
  const activeDrivers = drivers.filter((d) => d.is_active);

  const driverToggleClass = (active: boolean) =>
    cn(
      "px-3 py-1.5 text-sm font-semibold min-h-[40px] min-w-[4.25rem] transition-colors",
      active
        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:shadow-md dark:ring-1 dark:ring-white/30"
        : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900/40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
    );

  return (
    <div className="space-y-2">
      {showRuleSetPicker && (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            Rule set
          </Label>
          <Select
            value={sheetData.jurisdiction_code || DEFAULT_JURISDICTION_CODE}
            onValueChange={(val) => handleChange("jurisdiction_code", val)}
          >
            <SelectTrigger className="h-10 flex-1 min-w-[12rem] font-medium">
              <SelectValue placeholder="Select rule set…" />
            </SelectTrigger>
            <SelectContent>
              {jurisdictionOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <div
          className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0 dark:border-slate-500 dark:bg-slate-950 dark:p-0.5 dark:gap-0.5"
          role="group"
          aria-label="Driver type"
        >
          <button
            type="button"
            disabled={readOnly}
            onClick={() => handleChange("driver_type", "solo")}
            className={cn(driverToggleClass(driverType === "solo"), "rounded-none dark:rounded-md")}
          >
            Solo
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => handleChange("driver_type", "two_up")}
            className={cn(
              driverToggleClass(driverType === "two_up"),
              "border-l border-slate-200 dark:border-0 rounded-none dark:rounded-md"
            )}
          >
            Two-Up
          </button>
        </div>

        <HeaderDateChip
          label="Week"
          value={sheetData.week_starting ? formatSheetDisplayDate(sheetData.week_starting) : "—"}
          locked
          title="Week is set when this sheet is created. Ask your manager if it needs to be changed."
        />

        {last24hSet ? (
          <HeaderDateChip
            label="Break"
            value={formatSheetDisplayDate(sheetData.last_24h_break!)}
            locked
            title="Last 24 hour break date (locked)"
          />
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
            <HeaderDateChip
              label="Break"
              value="Set date"
              highlight
              disabled={readOnly}
              onClick={openLast24hPicker}
              title="Tap to set last 24 hour break date"
            />
          </>
        )}

        {headerActions != null && (
          <div className="flex items-center gap-2 shrink-0 ml-auto">{headerActions}</div>
        )}
      </div>

      {!hidePrimaryDriverField && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
            <User className="w-3 h-3" /> Driver
          </Label>
          <div
            className="flex h-10 flex-1 min-w-[10rem] items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100"
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
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
            <Users className="w-3 h-3" /> 2nd driver
          </Label>
          {activeDrivers.length > 0 ? (
            <Select
              value={sheetData.second_driver === "" || sheetData.second_driver == null ? "__none__" : sheetData.second_driver}
              onValueChange={(val) => handleChange("second_driver", val === "__none__" ? "" : val)}
              disabled={readOnly}
            >
              <SelectTrigger className="h-10 flex-1 min-w-[10rem] border-amber-300 dark:border-amber-700">
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
              className="h-10 flex-1 min-w-[10rem] border-amber-300 text-sm font-medium focus:border-amber-400"
              disabled={readOnly}
            />
          )}
        </div>
      )}

      {!last24hSet && (
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
      )}
    </div>
  );
}
