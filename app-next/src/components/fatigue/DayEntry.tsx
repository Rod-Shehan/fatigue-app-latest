"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowRight, ChevronDown } from "lucide-react";
import TimeGrid from "./TimeGrid";
import { motion } from "framer-motion";
import type { Rego } from "@/lib/api";
import { formatSheetDisplayDate, getSheetDayDateString } from "@/lib/weeks";
import { getHours } from "@/lib/compliance";
import { formatHoursStatistic } from "@/lib/hours";
import { SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS } from "@/lib/shift-change";
import { DayCardDetailsDialog, type DayCardFields } from "./DayCardDetailsDialog";
import { cn } from "@/lib/utils";
import {
  CONTINUED_SHIFT_ROUTE_CARD_NOTE,
  formatContinuedShiftRouteBanner,
} from "@/lib/product-copy";
import { driverCardBtn } from "@/components/driver/driver-ui-classes";
import type { DayWithKms } from "@/lib/rego-kms-validation";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DayData = DayCardFields & {
  end_kms?: number | null;
  route_confirmed?: boolean;
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  events?: { time: string; type: string; driver?: "primary" | "second" }[];
  date?: string;
};

function formatShiftLabel(label?: "A" | "B" | ""): string {
  if (label === "A") return "Day (A)";
  if (label === "B") return "Night (B)";
  return "—";
}

function formatKm(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-AU");
}

function StatBlock({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-semibold truncate mt-0.5",
          emphasis ? "text-amber-900 dark:text-amber-100" : "text-slate-900 dark:text-slate-100",
          mono && "font-mono tabular-nums tracking-tight"
        )}
      >
        {value || "—"}
      </p>
    </div>
  );
}

export default function DayEntry({
  dayIndex,
  dayData,
  continuedShiftRoute = null,
  onUpdate,
  weekStart,
  regos = [],
  readOnly = false,
  consecutiveWorkDays = 0,
  todayYmd,
  /** When true (default), past/future days render as a single summary row. */
  collapseWhenNotToday = true,
  allDays = [],
  sheetId,
  driverType,
}: {
  dayIndex: number;
  dayData: DayData;
  /** When set, shift continued overnight — prompt to confirm route on this calendar day. */
  continuedShiftRoute?: { previousDayName: string } | null;
  onUpdate: (idx: number, d: DayData) => void;
  weekStart: string;
  regos?: Rego[];
  readOnly?: boolean;
  consecutiveWorkDays?: number;
  todayYmd: string;
  collapseWhenNotToday?: boolean;
  allDays?: DayWithKms[];
  sheetId?: string;
  driverType?: string;
}) {
  const getDateStr = () => {
    if (!weekStart) return "";
    return formatSheetDisplayDate(getSheetDayDateString(weekStart, dayIndex));
  };
  const getISODate = () => (weekStart ? getSheetDayDateString(weekStart, dayIndex) : todayYmd);

  const kmsTotal =
    dayData.end_kms != null && dayData.start_kms != null ? Math.max(0, dayData.end_kms - dayData.start_kms) : 0;

  const sheetDayYmd = weekStart ? getSheetDayDateString(weekStart, dayIndex) : todayYmd;
  const isToday = sheetDayYmd === todayYmd;
  const isPast = sheetDayYmd < todayYmd;
  const isFuture = sheetDayYmd > todayYmd;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expanded, setExpanded] = useState(isToday);

  const events = useMemo(() => {
    const base = (dayData.events ?? []).filter((e) => e && typeof e.time === "string" && typeof e.type === "string");
    return [...base].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [dayData.events]);

  const showShiftPatternEducation =
    consecutiveWorkDays >= SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS && !dayData.shift_label;

  const canEditDetails = !readOnly;

  const hasRouteDetails =
    (dayData.start_location ?? "").trim() !== "" ||
    (dayData.destination ?? "").trim() !== "" ||
    (dayData.truck_rego ?? "").trim() !== "" ||
    dayData.start_kms != null;

  const detailsComplete =
    (dayData.truck_rego ?? "").trim() !== "" &&
    (dayData.start_location ?? "").trim() !== "" &&
    (dayData.destination ?? "").trim() !== "" &&
    dayData.start_kms != null &&
    !Number.isNaN(Number(dayData.start_kms)) &&
    (!(dayData.truck_rego ?? "").trim() ||
      (dayData.end_kms != null && !Number.isNaN(Number(dayData.end_kms))));

  const workHours = getHours(dayData.work_time);
  const collapsedSummary = isFuture
    ? "Upcoming"
    : workHours > 0
      ? `${formatHoursStatistic(workHours)}h work`
      : (dayData.events?.length ?? 0) > 0
        ? "Logged"
        : "No activity";

  if (collapseWhenNotToday && !isToday && !expanded) {
    const summaryLabel = readOnly ? `${collapsedSummary}. Read only.` : `${collapsedSummary}. Tap to expand and edit.`;
    const rowClass = cn(
      "flex w-full items-center gap-2 rounded-lg border px-3 py-2 min-h-[44px] text-left",
      readOnly
        ? isPast
          ? "bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-90"
          : "bg-slate-50/80 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80"
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 active:bg-slate-100 transition-colors"
    );
    const inner = (
      <>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
            isPast
              ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          )}
        >
          {DAY_NAMES[dayIndex]?.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate leading-tight">
            {DAY_NAMES[dayIndex]}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 tabular-nums truncate">{getDateStr()}</p>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
          {collapsedSummary}
        </span>
        {!readOnly && <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" aria-hidden />}
      </>
    );
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: dayIndex * 0.02 }}
      >
        {readOnly ? (
          <div className={rowClass} aria-label={`${DAY_NAMES[dayIndex]}, ${getDateStr()}. ${summaryLabel}`}>
            {inner}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={rowClass}
            aria-label={`${DAY_NAMES[dayIndex]}, ${getDateStr()}. ${summaryLabel}`}
            aria-expanded={false}
          >
            {inner}
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.04 }}
      className={cn(
        "rounded-xl border-2 shadow-sm p-3 md:p-5 transition-colors",
        isToday
          ? "bg-amber-50 dark:bg-slate-800/95 border-amber-400 dark:border-amber-500 ring-2 ring-amber-200/80 dark:ring-amber-500/40"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold shrink-0",
              isToday
                ? "bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-900"
                : "bg-slate-900 dark:bg-slate-600 text-white dark:text-slate-200"
            )}
          >
            {DAY_NAMES[dayIndex]?.charAt(0)}
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "text-base font-bold",
                isToday ? "text-amber-800 dark:text-amber-300" : "text-slate-800 dark:text-slate-100"
              )}
            >
              {DAY_NAMES[dayIndex]}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{getDateStr()}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:w-auto sm:ml-auto">
          {collapseWhenNotToday && !isToday && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-slate-500"
              onClick={() => setExpanded(false)}
            >
              Collapse
            </Button>
          )}
          {canEditDetails && (
            <Button
              type="button"
              variant={detailsComplete ? "outline" : "default"}
              size="default"
              className={cn(
                driverCardBtn,
                "w-full sm:w-auto",
                !detailsComplete && "bg-amber-600 hover:bg-amber-700 text-white"
              )}
              onClick={() => setDetailsOpen(true)}
            >
              <Pencil className="w-5 h-5 shrink-0" aria-hidden />
              {hasRouteDetails ? "Edit day" : "Set up day"}
            </Button>
          )}
        </div>
      </div>

      {continuedShiftRoute && canEditDetails && (
        <div
          className="mb-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-600 px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
          role="status"
        >
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100 flex-1 min-w-0">
            {formatContinuedShiftRouteBanner(continuedShiftRoute.previousDayName)}
          </p>
          <Button
            type="button"
            size="sm"
            className="min-h-10 shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            onClick={() => setDetailsOpen(true)}
          >
            Confirm route & times
          </Button>
        </div>
      )}

      <div
        className={cn(
          "mb-3 rounded-lg border bg-slate-50/90 dark:bg-slate-950/50 px-3 py-3",
          isToday && !detailsComplete && canEditDetails
            ? "border-amber-300 dark:border-amber-700"
            : "border-slate-200 dark:border-slate-700"
        )}
      >
        {!hasRouteDetails ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {readOnly ? "No route details recorded." : "Route and vehicle not set — use Set route before Start shift."}
          </p>
        ) : (
          <>
            {continuedShiftRoute && (
              <p className="text-xs text-amber-800 dark:text-amber-200 mb-2 leading-snug">
                {CONTINUED_SHIFT_ROUTE_CARD_NOTE}
              </p>
            )}
            <div className="flex items-center gap-2 min-w-0 mb-3">
              <StatBlock label="From" value={(dayData.start_location || "").trim() || "—"} emphasis />
              <ArrowRight className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
              <StatBlock label="To" value={(dayData.destination || "").trim() || "—"} emphasis />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-3">
              <StatBlock label="Rego" value={(dayData.truck_rego || "").trim() || "—"} mono />
              <StatBlock label="Pattern" value={formatShiftLabel(dayData.shift_label)} />
              <StatBlock label="Start km" value={formatKm(dayData.start_kms)} mono />
              <StatBlock label="End km" value={formatKm(dayData.end_kms)} mono />
              <StatBlock
                label="Trip km"
                value={kmsTotal > 0 ? formatKm(kmsTotal) : dayData.end_kms != null ? formatKm(0) : "—"}
                mono
              />
            </div>
          </>
        )}
      </div>

      {showShiftPatternEducation && !detailsOpen && (
        <p className="mb-2 text-xs leading-snug text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
          <span className="font-semibold">Shift pattern:</span> set Day (A) or Night (B) in route details if you swap
          patterns after {consecutiveWorkDays} work days in a row.
        </p>
      )}

      <TimeGrid dayData={{ ...dayData, date: getISODate() }} />

      {canEditDetails && (
        <DayCardDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          dayTitle={DAY_NAMES[dayIndex] ?? "Day"}
          dateLabel={getDateStr()}
          initial={{
            truck_rego: dayData.truck_rego,
            start_location: dayData.start_location,
            destination: dayData.destination,
            start_kms: dayData.start_kms,
            end_kms: dayData.end_kms,
            shift_label: dayData.shift_label,
          }}
          regos={regos}
          dayIndex={dayIndex}
          sheetDays={allDays}
          sheetDayYmd={sheetDayYmd}
          initialEvents={events}
          eventsEditable={canEditDetails}
          sheetId={sheetId}
          driverType={driverType}
          showShiftPatternEducation={showShiftPatternEducation}
          consecutiveWorkDays={consecutiveWorkDays}
          continuedFromPreviousDay={continuedShiftRoute?.previousDayName}
          onConfirm={(fields, updatedEvents) =>
            onUpdate(dayIndex, { ...dayData, ...fields, events: updatedEvents, route_confirmed: true })
          }
        />
      )}
    </motion.div>
  );
}
