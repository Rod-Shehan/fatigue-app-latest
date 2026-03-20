"use client";

import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Truck, MapPin, Clock, Trash2 } from "lucide-react";
import TimeGrid from "./TimeGrid";
import { motion } from "framer-motion";
import type { Rego } from "@/lib/api";
import { formatSheetDisplayDate, getSheetDayDateString } from "@/lib/weeks";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DayData = {
  truck_rego?: string;
  destination?: string;
  start_kms?: number | null;
  end_kms?: number | null;
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
  const candidate = new Date(`${dayYmd}T${hhmm}:00`);
  return candidate.toISOString();
}

export default function DayEntry({
  dayIndex,
  dayData,
  onUpdate,
  weekStart,
  regos = [],
  readOnly = false,
  canEditTimes = false,
  /** YYYY-MM-DD for "today" from parent (recomputed when clock ticks) so highlight is always correct on load. */
  todayYmd,
}: {
  dayIndex: number;
  dayData: DayData;
  onUpdate: (idx: number, d: DayData) => void;
  weekStart: string;
  regos?: Rego[];
  readOnly?: boolean;
  canEditTimes?: boolean;
  todayYmd: string;
}) {
  const handleFieldChange = (field: string, value: unknown) => {
    onUpdate(dayIndex, { ...dayData, [field]: value });
  };

  const getDateStr = () => {
    if (!weekStart) return "";
    return formatSheetDisplayDate(getSheetDayDateString(weekStart, dayIndex));
  };
  const getISODate = () => (weekStart ? getSheetDayDateString(weekStart, dayIndex) : todayYmd);

  const kmsTotal =
    dayData.end_kms != null && dayData.start_kms != null ? Math.max(0, dayData.end_kms - dayData.start_kms) : 0;

  const sheetDayYmd = weekStart ? getSheetDayDateString(weekStart, dayIndex) : todayYmd;
  const isToday = sheetDayYmd === todayYmd;

  const [editOpen, setEditOpen] = useState(false);
  const [draftEvents, setDraftEvents] = useState<Array<{ type: string; time: string; driver?: "primary" | "second" }>>([]);

  const events = useMemo(() => {
    const base = (dayData.events ?? []).filter((e) => e && typeof e.time === "string" && typeof e.type === "string");
    return [...base].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [dayData.events]);

  const canShowEditTimes = canEditTimes && !readOnly;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.04 }}
      className={`rounded-xl border-2 shadow-sm p-3 md:p-5 transition-colors ${
        isToday
          ? "bg-amber-50 dark:bg-slate-800/95 border-amber-400 dark:border-amber-500 ring-2 ring-amber-200/80 dark:ring-amber-500/40"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${
              isToday
                ? "bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-900"
                : "bg-slate-900 dark:bg-slate-600 text-white dark:text-slate-200"
            }`}
          >
            {DAY_NAMES[dayIndex]?.charAt(0)}
          </div>
          <div>
            <p
              className={`text-sm font-semibold ${
                isToday
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-slate-800 dark:text-slate-100"
              }`}
            >
              {DAY_NAMES[dayIndex]}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{getDateStr()}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {canShowEditTimes ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 gap-1.5 text-xs"
              onClick={() => {
                setDraftEvents(events.map((e) => ({ ...e })));
                setEditOpen(true);
              }}
              title="Edit logged event times"
            >
              <Clock className="w-3.5 h-3.5" />
              Edit times
            </Button>
          ) : null}
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            <Select
              value={dayData.truck_rego?.trim() || "__none__"}
              onValueChange={(value) =>
                handleFieldChange("truck_rego", value === "__none__" ? "" : value)
              }
              disabled={readOnly}
            >
              <SelectTrigger
                className="w-28 h-7 text-xs font-mono px-2 [&>span]:line-clamp-1"
                aria-label="Rego"
              >
                <SelectValue placeholder="Rego" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-slate-500 dark:text-slate-400">
                  Rego
                </SelectItem>
                {(() => {
                  const labels = regos.map((r) => r.label);
                  const current = dayData.truck_rego?.trim();
                  if (current && !labels.includes(current)) labels.unshift(current);
                  return labels.map((label) => (
                    <SelectItem key={label} value={label} className="font-mono">
                      {label}
                    </SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Destination"
              value={dayData.destination || ""}
              onChange={(e) => handleFieldChange("destination", e.target.value)}
              className="h-7 w-32 min-w-[8rem] text-xs font-medium placeholder:text-slate-500 dark:placeholder:text-slate-400"
              disabled={readOnly}
            />
          </div>
          <div className="flex items-center gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Start km{dayData.truck_rego?.trim() ? " *" : ""}
            </Label>
            <Input
              type="number"
              placeholder="0"
              value={dayData.start_kms ?? ""}
              onChange={(e) => handleFieldChange("start_kms", e.target.value ? Number(e.target.value) : null)}
              className="h-7 w-20 text-xs font-medium tabular-nums"
              disabled={readOnly}
            />
          </div>
          {kmsTotal > 0 && (
            <span className="rounded bg-slate-50 px-2 py-0.5 text-[10px] font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {kmsTotal} km
            </span>
          )}
        </div>
      </div>
      <TimeGrid dayData={{ ...dayData, date: getISODate() }} />

      {canShowEditTimes ? (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit event times</DialogTitle>
              <DialogDescription>
                Adjust the logged timestamps for this day. Times are saved onto this sheet and will affect compliance calculations.
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
                      className="h-8 w-32 font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40"
                      onClick={() => setDraftEvents((prev) => prev.filter((_, idx) => idx !== i))}
                      title="Delete event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
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
      ) : null}
    </motion.div>
  );
}
