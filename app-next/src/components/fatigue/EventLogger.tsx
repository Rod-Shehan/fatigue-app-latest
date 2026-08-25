"use client";

import React, { useState, useEffect } from "react";
import { BedDouble, Briefcase, Coffee, Moon, Square, Clock, AlertTriangle, CheckCircle2, Trash2, MapPin, User, Wrench } from "lucide-react";

import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";
import { getSheetDayDateString } from "@/lib/weeks";
import { deriveMinuteGridFromEvents, MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import { isBreakFromDrivingEventType, PASSENGER_EVENT_TYPE, SLEEPER_BERTH_EVENT_TYPE } from "@/lib/activity-kind";
import { DRIVER_PASSENGER_LABEL, DRIVER_SLEEPER_BERTH_LABEL } from "@/lib/product-copy";
import { qualifyingRestMetForWorkAfterBreak } from "@/lib/five-hour-break-rule";
import type { OpenActivityAtDayEnd } from "@/lib/event-rollover";

export {
  type OpenActivityAtDayEnd,
  resolveOpenActivityBeforeFirstDay,
  getEffectiveOpenActivityAtDayEnd,
  deriveDaysWithRollover,
} from "@/lib/event-rollover";

const EVENT_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  work: { label: "Work", icon: Briefcase },
  break: { label: "Rest", icon: Coffee },
  other_work: { label: "Other work", icon: Wrench },
  [PASSENGER_EVENT_TYPE]: { label: DRIVER_PASSENGER_LABEL, icon: User },
  [SLEEPER_BERTH_EVENT_TYPE]: { label: DRIVER_SLEEPER_BERTH_LABEL, icon: BedDouble },
  non_work: { label: "Non-Work Time", icon: Moon },
  stop: { label: "End shift", icon: Square },
};

function themeKeyForEvent(type: string): ActivityKey {
  if (type === PASSENGER_EVENT_TYPE) return "other_work";
  if (type === SLEEPER_BERTH_EVENT_TYPE) return "non_work";
  if (type === "work" || type === "break" || type === "other_work" || type === "non_work" || type === "stop") {
    return type;
  }
  return "stop";
}

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
      if (!isBreakFromDrivingEventType(events[i].type)) break;
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
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md ${ACTIVITY_THEME[themeKeyForEvent(currentType)]?.badge ?? "bg-slate-100 dark:bg-slate-600 dark:text-slate-200"}`}>
            {React.createElement(EVENT_CONFIG[currentType]?.icon ?? Square, { className: "w-3 h-3" })}
            {EVENT_CONFIG[currentType]?.label ?? currentType}
          </span>
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(elapsedMinutes)}
          </span>
          {isBreakFromDrivingEventType(currentType) && (
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
          const cfg = EVENT_CONFIG[ev.type] ?? EVENT_CONFIG.stop;
          const badge = ACTIVITY_THEME[themeKeyForEvent(ev.type)].badge;
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
