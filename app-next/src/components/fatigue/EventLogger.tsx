"use client";

import React, { useState, useEffect } from "react";
import { Briefcase, Coffee, Moon, Square, Clock, AlertTriangle, CheckCircle2, Trash2, MapPin } from "lucide-react";

import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";
import { todayHasLoggedWorkOrBreak } from "@/lib/day-route-carry";
import { getTodayLocalDateString, getSheetDayDateString } from "@/lib/weeks";
import { deriveMinuteGridFromEvents, MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import { qualifyingRestMetForWorkAfterBreak } from "@/lib/five-hour-break-rule";

const EVENT_CONFIG: Record<ActivityKey, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  work: { label: "Work", icon: Briefcase },
  break: { label: "Break", icon: Coffee },
  non_work: { label: "Non-Work Time", icon: Moon },
  stop: { label: "End shift", icon: Square },
};

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

/**
 * Derive minute-resolution coverage (1440 booleans per day) from events.
 * Legacy `carryOverEndSlot` (half-hour index) is converted to minutes (×30).
 */
export function deriveGridFromEvents(
  events: { time: string; type: string }[] | undefined,
  dateStr: string,
  options?: {
    carryOverType?: OpenActivityAtDayEnd;
    carryOverEndSlot?: number;
    carryOverEndMinute?: number;
    assumeIdleFromMs?: number;
    isToday?: boolean;
    dayStart?: number;
    /** Regulatory or display "today" (e.g. Australia/Perth for WA); defaults to device local. */
    todayStr?: string;
  }
): { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] } {
  const { carryOverEndSlot, ...rest } = options ?? {};
  const carryOverEndMinute =
    rest.carryOverEndMinute ?? (carryOverEndSlot != null ? carryOverEndSlot * 30 : undefined);
  return deriveMinuteGridFromEvents(events, dateStr, {
    ...rest,
    carryOverEndMinute,
  });
}

/**
 * Do not record non-work time before the last 24 hour break date on days that have
 * no work time recorded. For each day before last24hBreak with no work, zero non_work.
 */
export function applyLast24hBreakNonWorkRule<T extends { work_time?: boolean[]; non_work?: boolean[] }>(
  days: T[],
  weekStarting: string,
  last24hBreak: string | undefined
): T[] {
  if (!last24hBreak?.trim() || !weekStarting) return days;
  return days.map((d, i) => {
    const dateStr = getSheetDayDateString(weekStarting, i);
    if (dateStr >= last24hBreak) return d;
    const hasWorkOnDay = (d.work_time || []).some(Boolean);
    if (hasWorkOnDay) return d;
    return { ...d, non_work: Array(MINUTES_PER_DAY).fill(false) };
  });
}

/** Open segment at calendar day end — continues across midnight until the next event (End shift clears). */
export type OpenActivityAtDayEnd = "work" | "break" | "non_work";

/**
 * Activity still open at end of this calendar day (for rollover into the next day view).
 * Driven by the last non–End shift event; End shift means nothing carries forward.
 */
export function getEffectiveOpenActivityAtDayEnd(
  day: {
    work_time?: boolean[];
    breaks?: boolean[];
    non_work?: boolean[];
    events?: { time: string; type: string }[];
  },
  _dateStr: string,
  _todayStr: string
): OpenActivityAtDayEnd | null {
  const evs = day.events ?? [];
  const lastEv = evs[evs.length - 1];
  if (lastEv?.type === "stop") return null;
  if (
    lastEv?.type === "work" ||
    lastEv?.type === "break" ||
    lastEv?.type === "non_work"
  ) {
    return lastEv.type;
  }

  const w = day.work_time ?? [];
  const b = day.breaks ?? [];
  const nw = day.non_work ?? [];
  const len =
    w.length === 48
      ? 48
      : Math.min(Math.max(w.length, b.length, nw.length) || MINUTES_PER_DAY, MINUTES_PER_DAY);
  for (let s = len - 1; s >= 0; s--) {
    if (w[s]) return "work";
    if (b[s]) return "break";
    if (nw[s]) return "non_work";
  }
  return null;
}

/**
 * Derive work_time, breaks, non_work for all days with rollover: when the previous
 * day ended with an open segment (work, break, or non-work — no End shift), that
 * activity rolls into the next day from 00:00 until the first event on that day.
 */
export function deriveDaysWithRollover<T extends { events?: { time: string; type: string }[] }>(
  days: T[],
  weekStarting: string,
  options?: { todayStr?: string }
): (T & { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] })[] {
  const todayStr = options?.todayStr ?? getTodayLocalDateString();
  const result = days.map((d) => ({ ...d })) as (T & { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] })[];
  for (let i = 0; i < days.length; i++) {
    const currentEvents = (result[i].events || []) as { time: string; type: string }[];
    const dateStr = getSheetDayDateString(weekStarting, i);
    const dayStart = new Date(dateStr + "T00:00:00").getTime();
    const isToday = dateStr === todayStr;
    const dayEnd = new Date(dateStr + "T23:59:59").getTime();
    const now = Date.now();
    const effectiveEnd = isToday ? Math.min(dayEnd, now) : dayEnd;
    const maxMinuteExclusive = isToday
      ? Math.min(MINUTES_PER_DAY, Math.max(0, Math.ceil((effectiveEnd - dayStart) / 60000)))
      : MINUTES_PER_DAY;

    const prevDateStr = i > 0 ? getSheetDayDateString(weekStarting, i - 1) : "";
    let carryOverType =
      i > 0 ? getEffectiveOpenActivityAtDayEnd(result[i - 1], prevDateStr, todayStr) : null;
    // Open work/break on the prior day does not roll into today until the driver logs work/break today.
    if (carryOverType === "work" || carryOverType === "break") {
      if (!todayHasLoggedWorkOrBreak(result[i])) carryOverType = null;
    }
    let carryOverEndMinute = 0;
    if (carryOverType) {
      const firstEv = currentEvents[0];
      if (firstEv) {
        const firstEvTime = new Date(firstEv.time).getTime();
        carryOverEndMinute = Math.min(maxMinuteExclusive, Math.max(0, Math.ceil((firstEvTime - dayStart) / 60000)));
      } else {
        carryOverEndMinute = maxMinuteExclusive;
      }
    }

    const assumeIdleFrom = (result[i] as { assume_idle_from?: string }).assume_idle_from;

    const derived = deriveMinuteGridFromEvents(currentEvents.length ? currentEvents : undefined, dateStr, {
      carryOverType: carryOverType ?? undefined,
      carryOverEndMinute: carryOverEndMinute || undefined,
      assumeIdleFromMs: assumeIdleFrom ? new Date(assumeIdleFrom).getTime() : undefined,
      isToday,
      dayStart,
      todayStr,
    });
    result[i] = { ...result[i], ...derived };
  }
  return result;
}

export default function EventLogger({
  dayData,
  dateStr,
  onUpdate,
  readOnly = false,
}: {
  dayData: {
    events?: Array<{
      time: string;
      type: string;
      lat?: number;
      lng?: number;
      accuracy?: number;
      driver?: "primary" | "second";
    }>;
  };
  dateStr: string;
  onUpdate: (d: unknown) => void;
  readOnly?: boolean;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const events = dayData.events || [];
  const lastEvent = events[events.length - 1];
  const currentType = lastEvent && lastEvent.type !== "stop" ? lastEvent.type : null;
  const elapsedMinutes = lastEvent && currentType ? Math.floor(getElapsedSeconds(lastEvent.time) / 60) : 0;

  const breakRun = (() => {
    const segments: number[] = [];
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type !== "break") break;
      const end = i + 1 < events.length ? new Date(events[i + 1].time).getTime() : Date.now();
      const start = new Date(events[i].time).getTime();
      segments.unshift(Math.floor((end - start) / 60000));
    }
    return { segments };
  })();
  const breakValid = qualifyingRestMetForWorkAfterBreak(events, breakRun.segments);

  const deleteEvent = (idx: number) => {
    const newEvents = events.filter((_, i) => i !== idx);
    const derived = deriveGridFromEvents(newEvents, dateStr);
    onUpdate({ ...dayData, events: newEvents, ...derived });
  };

  if (events.length === 0) return null;

  return (
    <div className="space-y-2">
      {currentType && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md ${ACTIVITY_THEME[currentType as ActivityKey]?.badge ?? "bg-slate-100 dark:bg-slate-600 dark:text-slate-200"}`}>
            {React.createElement(EVENT_CONFIG[currentType as ActivityKey]?.icon ?? Square, { className: "w-3 h-3" })}
            {EVENT_CONFIG[currentType as ActivityKey]?.label ?? currentType}
          </span>
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(elapsedMinutes)}
          </span>
          {currentType === "break" && (
            <span className={`text-[10px] font-semibold flex items-center gap-1 ${breakValid ? "text-emerald-600" : "text-amber-600"}`}>
              {breakValid ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
              20 min rest per 5h work (2×10 min or 1×20 min)
            </span>
          )}
        </div>
      )}
      <div className="space-y-1 max-h-40 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Event Log</p>
        {events.map((ev, idx) => {
          const nextEv = events[idx + 1];
          const dur = nextEv ? getDurationMinutes(ev.time, nextEv.time) : (ev.type !== "stop" ? elapsedMinutes : 0);
          const typeKey = (ev.type in EVENT_CONFIG ? ev.type : "stop") as ActivityKey;
          const cfg = EVENT_CONFIG[typeKey];
          const badge = ACTIVITY_THEME[typeKey].badge;
          return (
            <div key={idx} className="flex items-center gap-2 text-xs group">
              <span className="font-mono text-slate-400 w-10 shrink-0">{formatTime(ev.time)}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${badge}`}>
                {React.createElement(cfg.icon, { className: "w-2.5 h-2.5" })}
                {cfg.label}
              </span>
              {dur > 0 && ev.type !== "stop" && <span className="text-slate-400 font-mono">{formatDuration(dur)}</span>}
              {ev.lat != null && ev.lng != null && (
                <span className="inline-flex items-center" title="Location recorded">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
                </span>
              )}
              {ev.type === "break" && nextEv && dur < MIN_BREAK_BLOCK_MINUTES && (
                <span className="text-amber-500 text-[10px]">⚠ &lt;10 min</span>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => deleteEvent(idx)}
                  className="ml-auto opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        {currentType && (
          <div className="flex items-center gap-2 text-xs opacity-60">
            <span className="font-mono text-slate-400 w-10 shrink-0">now</span>
            <span className="text-slate-400 italic">ongoing…</span>
          </div>
        )}
      </div>
    </div>
  );
}
