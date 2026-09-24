"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Briefcase, Coffee, Moon, Square, MapPin, Wrench, BedDouble, User, ParkingCircle, Loader2 } from "lucide-react";
import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";
import { getSheetDayDateString, getTodayLocalDateString } from "@/lib/weeks";
import { PASSENGER_EVENT_TYPE, SLEEPER_BERTH_EVENT_TYPE, STATIONARY_REST_EVENT_TYPE } from "@/lib/activity-kind";
import {
  DRIVER_PARKED_LABEL,
  DRIVER_PASSENGER_LABEL,
  DRIVER_SLEEPER_BERTH_LABEL,
  SHIFT_LOG_EDIT_HINT,
  SHIFT_LOG_LOCKED_HINT,
  SHIFT_LOG_SAVE_LABEL,
} from "@/lib/product-copy";
import type { DayData } from "@/lib/api";
import { applyShiftLogEventPatch, shiftLogEditMessages } from "@/lib/shift-log-edit";
import {
  EDITABLE_DAY_EVENT_TYPES,
  eventTypeLabel,
  hhmmToIsoOnDate,
  isoToHHMM,
} from "@/components/fatigue/DayEventsEditor";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EVENT_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  work: { label: "Work", icon: Briefcase },
  break: { label: "Rest", icon: Coffee },
  other_work: { label: "Other work", icon: Wrench },
  [PASSENGER_EVENT_TYPE]: { label: DRIVER_PASSENGER_LABEL, icon: User },
  [SLEEPER_BERTH_EVENT_TYPE]: { label: DRIVER_SLEEPER_BERTH_LABEL, icon: BedDouble },
  [STATIONARY_REST_EVENT_TYPE]: { label: DRIVER_PARKED_LABEL, icon: ParkingCircle },
  non_work: { label: "Non-Work Time", icon: Moon },
  stop: { label: "End shift", icon: Square },
};

const TWO_UP_TYPES = [PASSENGER_EVENT_TYPE, SLEEPER_BERTH_EVENT_TYPE, STATIONARY_REST_EVENT_TYPE] as const;

function themeKeyForEvent(type: string): ActivityKey {
  if (type === PASSENGER_EVENT_TYPE) return "other_work";
  if (type === SLEEPER_BERTH_EVENT_TYPE || type === STATIONARY_REST_EVENT_TYPE) return "non_work";
  if (type === "work" || type === "break" || type === "other_work" || type === "non_work" || type === "stop") {
    return type;
  }
  return "stop";
}

function typeOptionsForEvent(type: string, isTwoUp: boolean): string[] {
  const options: string[] = [...EDITABLE_DAY_EVENT_TYPES];
  if (isTwoUp || (TWO_UP_TYPES as readonly string[]).includes(type)) {
    for (const extra of TWO_UP_TYPES) {
      if (!options.includes(extra)) options.push(extra);
    }
  }
  if (type && !options.includes(type)) options.unshift(type);
  return options;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MIN_BREAK_BLOCK_MINUTES = 10;

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function getDurationMinutes(start: string, end: string) {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}
function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function getElapsedSeconds(isoString: string) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
}

function eventsFingerprint(days: DayData[]): string {
  return JSON.stringify(
    days.map((d) =>
      (d.events ?? []).map((e) => ({
        time: e.time,
        type: e.type,
        napFrom: e.napFrom ?? null,
        driver: e.driver ?? null,
      }))
    )
  );
}

type TableRow = {
  dayIndex: number;
  eventIndex: number;
  dayLabel: string;
  dateLabel: string;
  dateStr: string;
  eventTime: string;
  type: string;
  duration: number;
  isOngoing: boolean;
  hasLocation: boolean;
  shortBreak: boolean;
};

export default function ShiftLogView({
  days,
  weekStarting,
  canEdit = false,
  locked = false,
  isTwoUp = false,
  saving = false,
  saveError = null,
  onSave,
}: {
  days: DayData[];
  weekStarting: string;
  canEdit?: boolean;
  locked?: boolean;
  isTwoUp?: boolean;
  saving?: boolean;
  saveError?: string | null;
  onSave?: (days: DayData[]) => void | Promise<void>;
}) {
  const [, setTick] = useState(0);
  const [draftDays, setDraftDays] = useState<DayData[]>(days);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setDraftDays(days);
  }, [days]);

  const sourceDays = canEdit ? draftDays : days;
  const dirty = canEdit && eventsFingerprint(draftDays) !== eventsFingerprint(days);
  const editIssues = useMemo(
    () => (canEdit && dirty ? shiftLogEditMessages(draftDays, weekStarting) : []),
    [canEdit, dirty, draftDays, weekStarting]
  );

  const todayStr = getTodayLocalDateString();
  const rows: TableRow[] = [];

  sourceDays.forEach((dayData, dayIndex) => {
    const dateStr = weekStarting ? getSheetDayDateString(weekStarting, dayIndex) : "";
    const events = dayData.events || [];
    const lastEvent = events[events.length - 1];
    const currentType = lastEvent && lastEvent.type !== "stop" ? lastEvent.type : null;
    const elapsedMinutes = lastEvent && currentType ? Math.floor(getElapsedSeconds(lastEvent.time) / 60) : 0;
    const isToday = dateStr === todayStr;
    const dayLabel = DAY_NAMES[dayIndex] ?? `D${dayIndex + 1}`;
    const dateLabel = dateStr
      ? new Date(dateStr + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })
      : "";

    events
      .map((ev, eventIndex) => ({ ev, eventIndex }))
      .sort((a, b) => new Date(a.ev.time).getTime() - new Date(b.ev.time).getTime())
      .forEach(({ ev, eventIndex }, idx, sorted) => {
        const nextEv = sorted[idx + 1]?.ev;
        const dur = nextEv
          ? getDurationMinutes(ev.time, nextEv.time)
          : ev.type !== "stop" && isToday
            ? elapsedMinutes
            : 0;
        const typeKey = ev.type in EVENT_CONFIG ? ev.type : ev.type;
        const isOngoing = !nextEv && !!currentType && isToday;
        rows.push({
          dayIndex,
          eventIndex,
          dayLabel,
          dateLabel,
          dateStr,
          eventTime: ev.time,
          type: typeKey,
          duration: ev.type !== "stop" ? dur : 0,
          isOngoing,
          hasLocation: "lat" in ev && ev.lat != null && "lng" in ev && ev.lng != null,
          shortBreak: ev.type === "break" && !!nextEv && dur > 0 && dur < MIN_BREAK_BLOCK_MINUTES,
        });
      });
  });

  const hasAnyEvents = rows.length > 0;
  const blocked = editIssues.length > 0;

  return (
    <div className="space-y-3">
      {canEdit ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">{SHIFT_LOG_EDIT_HINT}</p>
      ) : locked ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">{SHIFT_LOG_LOCKED_HINT}</p>
      ) : null}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600">
                <th className="text-left py-2 px-2 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-10">
                  Day
                </th>
                <th className="text-left py-2 px-2 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">
                  Date
                </th>
                <th className="text-left py-2 px-2 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-14">
                  Time
                </th>
                <th className="text-left py-2 px-2 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-right py-2 px-2 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-14">
                  Duration
                </th>
                <th className="w-8 py-2 px-1" aria-label="Location" />
              </tr>
            </thead>
            <tbody>
              {hasAnyEvents ? (
                rows.map((r, i) => {
                  const cfg = EVENT_CONFIG[r.type];
                  const badge = ACTIVITY_THEME[themeKeyForEvent(r.type)].badge;
                  return (
                    <tr
                      key={`${r.dayIndex}-${r.eventIndex}-${i}`}
                      className={`border-b border-slate-100 dark:border-slate-700 last:border-0 ${r.isOngoing ? "bg-slate-50/70 dark:bg-slate-800/70" : ""}`}
                    >
                      <td className="py-1.5 px-2 font-medium text-slate-600 dark:text-slate-300">{r.dayLabel}</td>
                      <td className="py-1.5 px-2 text-slate-500 dark:text-slate-400 font-mono">{r.dateLabel}</td>
                      <td className="py-1.5 px-2 font-mono text-slate-600 dark:text-slate-300">
                        {canEdit && r.dateStr ? (
                          <Input
                            type="time"
                            value={isoToHHMM(r.eventTime)}
                            onChange={(e) => {
                              const hhmm = e.target.value;
                              if (!hhmm) return;
                              setDraftDays((prev) =>
                                applyShiftLogEventPatch(prev, r.dayIndex, r.eventIndex, {
                                  time: hhmmToIsoOnDate(r.dateStr, hhmm),
                                })
                              );
                            }}
                            className="h-11 w-[6.75rem] text-base font-mono"
                            aria-label={`Time for ${eventTypeLabel(r.type)} on ${r.dateLabel}`}
                          />
                        ) : r.isOngoing ? (
                          "now"
                        ) : (
                          formatTime(r.eventTime)
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        {canEdit ? (
                          <Select
                            value={r.type}
                            onValueChange={(v) => {
                              setDraftDays((prev) =>
                                applyShiftLogEventPatch(prev, r.dayIndex, r.eventIndex, { type: v })
                              );
                            }}
                          >
                            <SelectTrigger
                              className="h-11 min-w-[8.5rem] text-xs font-semibold"
                              aria-label={`Type for event at ${isoToHHMM(r.eventTime)}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {typeOptionsForEvent(r.type, isTwoUp).map((t) => (
                                <SelectItem key={t} value={t} className="text-sm font-medium">
                                  {eventTypeLabel(t)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge}`}
                            >
                              {React.createElement(cfg?.icon ?? Square, { className: "w-2.5 h-2.5" })}
                              {cfg?.label ?? eventTypeLabel(r.type)}
                            </span>
                            {r.shortBreak && <span className="ml-1 text-amber-500">⚠ &lt;10m</span>}
                          </>
                        )}
                        {canEdit && r.shortBreak ? (
                          <span className="ml-1 text-amber-500">⚠ &lt;10m</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-500 dark:text-slate-400">
                        {r.duration > 0 ? formatDuration(r.duration) : "—"}
                      </td>
                      <td className="py-1.5 px-1 text-center">
                        {r.hasLocation ? (
                          <span className="inline-flex" title="Location recorded">
                            <MapPin className="w-3 h-3 text-slate-400 inline" aria-hidden />
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-slate-400 italic">
                    No events recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && hasAnyEvents ? (
        <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3">
          {editIssues.map((m) => (
            <p key={m} className="text-sm text-red-700 dark:text-red-300 leading-snug" role="alert">
              {m}
            </p>
          ))}
          {saveError ? (
            <p className="text-sm text-red-700 dark:text-red-300 leading-snug" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving || !dirty}
              onClick={() => setDraftDays(days)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={cn("min-h-11")}
              disabled={saving || !dirty || blocked || !onSave}
              onClick={() => onSave?.(draftDays)}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
              {saving ? "Saving…" : SHIFT_LOG_SAVE_LABEL}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
