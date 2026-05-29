"use client";

import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Pencil, Trash2, ArrowRight } from "lucide-react";
import TimeGrid from "./TimeGrid";
import { motion } from "framer-motion";
import type { Rego } from "@/lib/api";
import { formatSheetDisplayDate, getSheetDayDateString } from "@/lib/weeks";
import { SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS } from "@/lib/shift-change";
import { DayCardDetailsDialog, type DayCardFields } from "./DayCardDetailsDialog";
import { cn } from "@/lib/utils";
import {
  CONTINUED_SHIFT_ROUTE_CARD_NOTE,
  formatContinuedShiftRouteBanner,
} from "@/lib/product-copy";

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

function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function hhmmToIsoOnDate(dayYmd: string, hhmm: string): string {
  return new Date(`${dayYmd}T${hhmm}:00`).toISOString();
}

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
  canEditTimes = false,
  consecutiveWorkDays = 0,
  todayYmd,
}: {
  dayIndex: number;
  dayData: DayData;
  /** When set, shift continued overnight — prompt to confirm route on this calendar day. */
  continuedShiftRoute?: { previousDayName: string } | null;
  onUpdate: (idx: number, d: DayData) => void;
  weekStart: string;
  regos?: Rego[];
  readOnly?: boolean;
  canEditTimes?: boolean;
  consecutiveWorkDays?: number;
  todayYmd: string;
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

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draftEvents, setDraftEvents] = useState<Array<{ type: string; time: string; driver?: "primary" | "second" }>>(
    []
  );

  const events = useMemo(() => {
    const base = (dayData.events ?? []).filter((e) => e && typeof e.time === "string" && typeof e.type === "string");
    return [...base].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [dayData.events]);

  const showShiftPatternEducation =
    consecutiveWorkDays >= SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS && !dayData.shift_label;

  const canShowEditTimes = canEditTimes && !readOnly;
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
    !Number.isNaN(Number(dayData.start_kms));

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
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold",
              isToday
                ? "bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-900"
                : "bg-slate-900 dark:bg-slate-600 text-white dark:text-slate-200"
            )}
          >
            {DAY_NAMES[dayIndex]?.charAt(0)}
          </div>
          <div>
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
        <div className="flex flex-wrap items-center gap-2">
          {canEditDetails && (
            <Button
              type="button"
              variant={detailsComplete ? "outline" : "default"}
              size="sm"
              className={cn(
                "min-h-9 gap-1.5 text-sm font-semibold",
                !detailsComplete && "bg-amber-600 hover:bg-amber-700 text-white"
              )}
              onClick={() => setDetailsOpen(true)}
            >
              <Pencil className="w-4 h-4 shrink-0" aria-hidden />
              {hasRouteDetails ? "Edit route" : "Set route"}
            </Button>
          )}
          {canShowEditTimes && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 gap-1.5 text-sm"
              onClick={() => {
                setDraftEvents(events.map((e) => ({ ...e })));
                setEditOpen(true);
              }}
            >
              <Clock className="w-4 h-4 shrink-0" aria-hidden />
              Edit times
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
            Confirm route
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
              <StatBlock label="Rego" value={(dayData.truck_rego || "").trim() || "—"} mono />
              <StatBlock label="Pattern" value={formatShiftLabel(dayData.shift_label)} />
              <StatBlock label="Start km" value={formatKm(dayData.start_kms)} mono />
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
            shift_label: dayData.shift_label,
          }}
          regos={regos}
          showShiftPatternEducation={showShiftPatternEducation}
          consecutiveWorkDays={consecutiveWorkDays}
          continuedFromPreviousDay={continuedShiftRoute?.previousDayName}
          onConfirm={(fields) =>
            onUpdate(dayIndex, { ...dayData, ...fields, route_confirmed: true })
          }
        />
      )}

      {canShowEditTimes && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit event times</DialogTitle>
              <DialogDescription>
                Adjust the logged timestamps for this day. Times are saved onto this sheet and will affect compliance
                calculations.
              </DialogDescription>
            </DialogHeader>

            {draftEvents.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-300">No events logged for this day yet.</div>
            ) : (
              <div className="space-y-2">
                {draftEvents.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {ev.type}
                      {ev.driver ? ` (${ev.driver})` : ""}
                    </span>
                    <Input
                      type="time"
                      value={isoToHHMM(ev.time)}
                      onChange={(e) => {
                        const hhmm = e.target.value;
                        setDraftEvents((prev) => {
                          const next = [...prev];
                          next[i] = { ...next[i]!, time: hhmmToIsoOnDate(sheetDayYmd, hhmm) };
                          return next;
                        });
                      }}
                      className="h-10 w-36 text-base font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 px-2 text-red-600 dark:text-red-400"
                      onClick={() => setDraftEvents((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="min-h-11"
                disabled={draftEvents.length === 0}
                onClick={() => {
                  const normalized = [...draftEvents].sort(
                    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
                  );
                  onUpdate(dayIndex, { ...dayData, events: normalized });
                  setEditOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
}
