"use client";

import React, { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Users, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { formatSheetDisplayDate } from "@/lib/weeks";
import { DEFAULT_JURISDICTION_CODE, getJurisdictionOptions } from "@/lib/jurisdiction";
import { getDisplayNameFromSession } from "@/lib/session-display-name";
import { isFleetManagerRole } from "@/lib/roles";
import { resolveSheetDriverDisplayName } from "@/lib/sheet-driver-display-name";
import { cn } from "@/lib/utils";
import {
  driverDateChip,
  driverToggleSegment,
  driverToggleTrack,
} from "@/components/driver/driver-ui-classes";
import {
  LAST_24H_BREAK_CHIP_LABEL,
  Last24hBreakField,
} from "@/components/fatigue/Last24hBreakField";
import { isoToPerthYmd, type Last24hBreakRange } from "@/lib/last-24h-break-range";

type SheetData = {
  driver_name?: string;
  second_driver?: string;
  driver_type?: string;
  jurisdiction_code?: string;
  last_24h_break?: string;
  last_24h_break_start?: string;
  last_24h_break_end?: string;
  week_starting?: string;
};

function HeaderDateChip({
  label,
  value,
  locked,
  highlight,
  disabled,
  onClick,
  title,
  className: classNameProp,
}: {
  label: string;
  value: string;
  locked?: boolean;
  highlight?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const className = cn(
    driverDateChip,
    classNameProp,
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
  /**
   * Parent-known fleet oversight (manager/owner). Prefer this over session role alone so
   * owners on the manager desk never sync their login name onto the driver’s sheet.
   */
  fleetOversight = false,
  /** Right side of the compact row (e.g. gear drawer, save status). */
  headerActions,
}: {
  sheetData: SheetData;
  onChange: (s: Partial<SheetData>) => void;
  readOnly?: boolean;
  hidePrimaryDriverField?: boolean;
  fleetOversight?: boolean;
  headerActions?: React.ReactNode;
}) {
  const handleChange = (field: string, value: unknown) => {
    onChange({ ...sheetData, [field]: value });
  };
  const driverType = sheetData.driver_type || "solo";
  const last24hRange: Last24hBreakRange | null =
    sheetData.last_24h_break_start?.trim() && sheetData.last_24h_break_end?.trim()
      ? {
          startIso: sheetData.last_24h_break_start,
          endIso: sheetData.last_24h_break_end,
        }
      : null;
  const jurisdictionCode = sheetData.jurisdiction_code?.trim() ?? "";
  const jurisdictionOptions = getJurisdictionOptions();
  const showRuleSetPicker = !readOnly && !jurisdictionCode;

  const { data: session, status: sessionStatus } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const isFleetOversight = fleetOversight || isFleetManagerRole(role);
  const sessionDriverName = getDisplayNameFromSession(session ?? null);
  const primaryDriverDisplay = resolveSheetDriverDisplayName({
    sheetDriverName: sheetData.driver_name,
    sessionDisplayName: sessionDriverName,
    isFleetOversight,
    sessionLoading: sessionStatus === "loading",
  });

  /** Field drivers only: primary name comes from the account. Never rewrite under fleet oversight. */
  useEffect(() => {
    if (readOnly || isFleetOversight || sessionStatus !== "authenticated") return;
    if (!sessionDriverName) return;
    if (sheetData.driver_name === sessionDriverName) return;
    onChange({ driver_name: sessionDriverName });
  }, [readOnly, isFleetOversight, sessionStatus, sessionDriverName, sheetData.driver_name, onChange]);

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

  const driverToggleClass = (active: boolean) => driverToggleSegment(active, readOnly);

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
          className={driverToggleTrack}
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

        {last24hRange && readOnly ? (
          <HeaderDateChip
            label={LAST_24H_BREAK_CHIP_LABEL}
            value={`${new Date(last24hRange.startIso).toLocaleString("en-AU", {
              timeZone: "Australia/Perth",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })} → …`}
            locked
            className="max-w-[min(100%,22rem)] sm:max-w-[24rem]"
            title={`${LAST_24H_BREAK_CHIP_LABEL} (locked after sign-off)`}
          />
        ) : null}

        {headerActions != null && (
          <div className="flex items-center gap-2 shrink-0 ml-auto">{headerActions}</div>
        )}
      </div>

      {!readOnly || !last24hRange ? (
        <div className="pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
          <Last24hBreakField
            value={last24hRange}
            readOnly={readOnly}
            onChange={(range) => {
              if (!range) {
                onChange({
                  ...sheetData,
                  last_24h_break: "",
                  last_24h_break_start: "",
                  last_24h_break_end: "",
                });
                return;
              }
              onChange({
                ...sheetData,
                last_24h_break: isoToPerthYmd(range.startIso) ?? "",
                last_24h_break_start: range.startIso,
                last_24h_break_end: range.endIso,
              });
            }}
          />
        </div>
      ) : null}

      {!hidePrimaryDriverField && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
            <User className="w-3 h-3" /> Driver
          </Label>
          <div
            className="flex h-10 flex-1 min-w-[10rem] items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100"
            title={isFleetOversight ? "Driver name on this sheet" : "From your account (login name)"}
          >
            <span className="truncate">
              {readOnly || isFleetOversight
                ? sheetData.driver_name?.trim() || "—"
                : primaryDriverDisplay}
            </span>
          </div>
        </div>
      )}

      {driverType === "two_up" && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
            <Users className="w-3 h-3" /> Relief driver (name only)
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
              placeholder="Relief driver on this crew"
              className="h-10 flex-1 min-w-[10rem] border-amber-300 text-sm font-medium focus:border-amber-400"
              disabled={readOnly}
            />
          )}
          <p className="w-full text-xs text-slate-500 dark:text-slate-400 leading-snug">
            Context only — each driver keeps their own weekly record.
          </p>
        </div>
      )}
    </div>
  );
}
