"use client";

import React, { useState, useEffect } from "react";
import { Briefcase, Coffee, Moon, Square, MapPin } from "lucide-react";
import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";
import {
  getSheetDayDateString,
  getSheetDayWeekdayShort,
  getTodayLocalDateString,
  normalizeWeekDateString,
  parseLocalDate,
} from "@/lib/weeks";

const EVENT_CONFIG: Record<ActivityKey, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  work: { label: "Work", icon: Briefcase },
  break: { label: "Break", icon: Coffee },
  non_work: { label: "Non-Work Time", icon: Moon },
  stop: { label: "End shift", icon: Square },
};

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

type DayData = {
  events?: { time: string; type: string; lat?: number; lng?: number; driver?: "primary" | "second" }[];
};

type TableRow = {
  dayIndex: number;
  dayLabel: string;
  dateLabel: string;
  time: string;
  type: ActivityKey;
  duration: number;
  isOngoing: boolean;
  hasLocation: boolean;
  shortBreak: boolean;
};

export default function ShiftLogView({
  days,
  weekStarting,
}: {
  days: DayData[];
  weekStarting: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const todayStr = getTodayLocalDateString();
  const rows: TableRow[] = [];

  days.forEach((dayData, dayIndex) => {
    const dateStr = weekStarting ? getSheetDayDateString(weekStarting, dayIndex) : "";
    const events = dayData.events || [];
    const lastEvent = events[events.length - 1];
    const currentType = lastEvent && lastEvent.type !== "stop" ? lastEvent.type : null;
    const elapsedMinutes = lastEvent && currentType ? Math.floor(getElapsedSeconds(lastEvent.time) / 60) : 0;
    const isToday = dateStr === todayStr;
    const dayLabel = weekStarting
      ? getSheetDayWeekdayShort(weekStarting, dayIndex)
      : (DAY_NAMES[dayIndex] ?? `D${dayIndex + 1}`);
    const dateLabel = dateStr
      ? parseLocalDate(normalizeWeekDateString(dateStr)).toLocaleDateString("en-AU", {
          day: "numeric",
          month: "short",
        })
      : "";

    events.forEach((ev, idx) => {
      const nextEv = events[idx + 1];
      const dur = nextEv ? getDurationMinutes(ev.time, nextEv.time) : (ev.type !== "stop" && isToday ? elapsedMinutes : 0);
      const typeKey = (ev.type in EVENT_CONFIG ? ev.type : "stop") as ActivityKey;
      const isOngoing = !nextEv && !!currentType && isToday;
      rows.push({
        dayIndex,
        dayLabel,
        dateLabel,
        time: isOngoing ? "now" : formatTime(ev.time),
        type: typeKey,
        duration: ev.type !== "stop" ? dur : 0,
        isOngoing,
        hasLocation: "lat" in ev && ev.lat != null && "lng" in ev && ev.lng != null,
        shortBreak: ev.type === "break" && !!nextEv && dur > 0 && dur < MIN_BREAK_BLOCK_MINUTES,
      });
    });
  });

  const hasAnyEvents = rows.length > 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600">
              <th className="text-left py-2 px-2 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-10">Day</th>
              <th className="text-left py-2 px-2 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">Date</th>
              <th className="text-left py-2 px-2 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-14">Time</th>
              <th className="text-left py-2 px-2 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
              <th className="text-right py-2 px-2 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-14">Duration</th>
              <th className="w-8 py-2 px-1" aria-label="Location" />
            </tr>
          </thead>
          <tbody>
            {hasAnyEvents ? (
              rows.map((r, i) => {
                const cfg = EVENT_CONFIG[r.type];
                const badge = ACTIVITY_THEME[r.type].badge;
                return (
                  <tr key={i} className={`border-b border-slate-100 dark:border-slate-700 last:border-0 ${r.isOngoing ? "bg-slate-50/70 dark:bg-slate-800/70" : ""}`}>
                    <td className="py-1.5 px-2 font-medium text-slate-600 dark:text-slate-300">{r.dayLabel}</td>
                    <td className="py-1.5 px-2 text-slate-500 dark:text-slate-400 font-mono">{r.dateLabel}</td>
                    <td className="py-1.5 px-2 font-mono text-slate-600 dark:text-slate-300">{r.time}</td>
                    <td className="py-1.5 px-2">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge}`}>
                        {React.createElement(cfg?.icon ?? Square, { className: "w-2.5 h-2.5" })}
                        {cfg?.label ?? r.type}
                      </span>
                      {r.shortBreak && <span className="ml-1 text-amber-500">⚠ &lt;10m</span>}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-500 dark:text-slate-400">
                      {r.duration > 0 ? formatDuration(r.duration) : "—"}
                    </td>
                    <td className="py-1.5 px-1 text-center">
                      {r.hasLocation ? <span className="inline-flex" title="Location recorded"><MapPin className="w-3 h-3 text-slate-400 inline" aria-hidden /></span> : null}
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
  );
}
