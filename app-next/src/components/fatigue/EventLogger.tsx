"use client";

import React, { useState, useEffect } from "react";
import { Briefcase, Coffee, Moon, Square, Clock, AlertTriangle, CheckCircle2, Trash2, MapPin } from "lucide-react";

import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";
import { getTodayLocalDateString, getSheetDayDateString } from "@/lib/weeks";

const EVENT_CONFIG: Record<ActivityKey, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  work: { label: "Work", icon: Briefcase },
  break: { label: "Break", icon: Coffee },
  non_work: { label: "Non-Work Time", icon: Moon },
  stop: { label: "End shift", icon: Square },
};

const MIN_BREAK_TOTAL_MINUTES = 20;
  const MIN_BREAK_BLOCK_MINUTES = 10;
  const BREAK_BLOCKS_REQUIRED = 1;

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

/** Any gap between work shorter than this (minutes) is recorded as break, not non-work. */
const MAX_GAP_AS_BREAK_MINUTES = 30;
const MINUTES_PER_SLOT = 30;

/**
 * Derive 30-min slot arrays from events for one day (00:00–24:00 local).
 * Work and break come from logged segments; all other time (including before
 * first event, after last event, non-work time, and end-shift) counts as non-work.
 * Rule: non-work is retrospective only — never shown after the present time on the current day.
 * Rule: work is continuous across midnight when there is no End shift — previous day's
 * work/break rolls into the next day from 00:00 until the first event (carryOver).
 * Rule: any gap shorter than 30 minutes between work is recorded as break, not non-work.
 * Rule: a completed break (has next event) shorter than 10 minutes is allocated to work time; ongoing breaks stay in break bar.
 */
/**
 * When set (and only for the current day), work/break segments are capped at this time
 * and time from assumeIdleFromMs to "now" is shown as non-work ("driver forgot" / assume idle).
 */
export function deriveGridFromEvents(
  events: { time: string; type: string }[] | undefined,
  dateStr: string,
  options?: {
    carryOverType?: "work" | "break";
    carryOverEndSlot?: number;
    assumeIdleFromMs?: number;
    isToday?: boolean;
    dayStart?: number;
  }
): { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] } {
  const work_time = Array(48).fill(false);
  const breaks = Array(48).fill(false);
  const non_work = Array(48).fill(false);
  const todayStr = getTodayLocalDateString();
  if (dateStr > todayStr) return { work_time, breaks, non_work };
  const isToday = dateStr === todayStr;
  const now = Date.now();
  const dayStart = options?.dayStart ?? new Date(dateStr + "T00:00:00").getTime();
  const dayEnd = new Date(dateStr + "T23:59:59").getTime();
  const assumeIdleFromMs = options?.assumeIdleFromMs && options?.isToday ? options.assumeIdleFromMs : undefined;
  const workBreakCap = assumeIdleFromMs != null ? Math.min(now, assumeIdleFromMs) : undefined;
  const effectiveEnd = isToday ? Math.min(dayEnd, now) : dayEnd;
  const maxSlotExclusive = isToday ? Math.min(48, Math.ceil((effectiveEnd - dayStart) / (30 * 60 * 1000))) : 48;
  const workBreakMaxSlot =
    workBreakCap != null ? Math.min(maxSlotExclusive, Math.max(0, Math.ceil((workBreakCap - dayStart) / (30 * 60 * 1000)))) : maxSlotExclusive;

  const { carryOverType, carryOverEndSlot = 0 } = options ?? {};
  if (carryOverType && carryOverEndSlot > 0) {
    const end = Math.min(carryOverEndSlot, workBreakMaxSlot);
    for (let s = 0; s < end; s++) {
      if (carryOverType === "work") work_time[s] = true;
      else breaks[s] = true;
    }
  }

  if (!events?.length) {
    for (let s = 0; s < maxSlotExclusive; s++) {
      if (!work_time[s] && !breaks[s]) non_work[s] = true;
    }
    const withShortGapsAsBreak = reclassifyShortGapsAsBreak(work_time, breaks, non_work, maxSlotExclusive);
    return reclassifyLongBreaksAsNonWork(
      withShortGapsAsBreak.work_time,
      withShortGapsAsBreak.breaks,
      withShortGapsAsBreak.non_work,
      maxSlotExclusive
    );
  }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const nextEv = events[i + 1];
    if (ev.type === "stop") continue;
    const start = new Date(ev.time).getTime();
    const segmentEnd = nextEv ? new Date(nextEv.time).getTime() : (isToday ? now : dayEnd);
    const end = workBreakCap != null && segmentEnd > workBreakCap ? workBreakCap : segmentEnd;
    const clampedStart = Math.max(start, dayStart);
    const clampedEnd = Math.min(end, workBreakCap ?? effectiveEnd);
    const durationMinutes = Math.floor((clampedEnd - clampedStart) / 60000);
    const startSlot = Math.floor((clampedStart - dayStart) / (30 * 60 * 1000));
    const endSlot = Math.ceil((clampedEnd - dayStart) / (30 * 60 * 1000));
    const isCompletedBreak = ev.type === "break" && nextEv != null;
    const treatBreakAsWork = isCompletedBreak && durationMinutes < MIN_BREAK_BLOCK_MINUTES;
    for (let s = Math.max(0, startSlot); s < Math.min(workBreakMaxSlot, endSlot); s++) {
      if (ev.type === "work" || treatBreakAsWork) work_time[s] = true;
      else if (ev.type === "break") breaks[s] = true;
    }
  }
  for (let s = 0; s < maxSlotExclusive; s++) {
    if (!work_time[s] && !breaks[s]) non_work[s] = true;
  }
  const withShortGapsAsBreak = reclassifyShortGapsAsBreak(work_time, breaks, non_work, maxSlotExclusive);
  return reclassifyLongBreaksAsNonWork(
    withShortGapsAsBreak.work_time,
    withShortGapsAsBreak.breaks,
    withShortGapsAsBreak.non_work,
    maxSlotExclusive
  );
}

/**
 * Reclassify short non-work gaps (<= MAX_GAP_AS_BREAK_MINUTES) as break so they are
 * not counted as non-work time. In slot terms, a run of 1 slot = 30 min qualifies.
 */
function reclassifyShortGapsAsBreak(
  work_time: boolean[],
  breaks: boolean[],
  non_work: boolean[],
  maxSlotExclusive: number
): { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] } {
  for (let s = 0; s < maxSlotExclusive; ) {
    if (!non_work[s]) {
      s++;
      continue;
    }
    let runEnd = s;
    while (runEnd < maxSlotExclusive && non_work[runEnd]) runEnd++;
    const runSlots = runEnd - s;
    const runMinutes = runSlots * MINUTES_PER_SLOT;
    const isShortGap = runMinutes <= MAX_GAP_AS_BREAK_MINUTES;
    const hasWorkBefore = s > 0 && work_time[s - 1];
    const hasWorkAfter = runEnd < maxSlotExclusive && work_time[runEnd];
    if (isShortGap && (hasWorkBefore || hasWorkAfter)) {
      for (let k = s; k < runEnd; k++) {
        breaks[k] = true;
        non_work[k] = false;
      }
    }
    s = runEnd;
  }
  return { work_time, breaks, non_work };
}

/**
 * Reclassify long break runs (> MAX_GAP_AS_BREAK_MINUTES) as non-work so that
 * any break longer than 30 minutes is counted as non-work time, regardless of
 * whether it came from logged Break events or inferred gaps.
 */
function reclassifyLongBreaksAsNonWork(
  work_time: boolean[],
  breaks: boolean[],
  non_work: boolean[],
  maxSlotExclusive: number
): { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] } {
  const minSlotsAsNonWork = Math.floor(MAX_GAP_AS_BREAK_MINUTES / MINUTES_PER_SLOT) + 1; // >30min => >=2 slots
  for (let s = 0; s < maxSlotExclusive; ) {
    if (!breaks[s]) {
      s++;
      continue;
    }
    let runEnd = s;
    while (runEnd < maxSlotExclusive && breaks[runEnd]) runEnd++;
    const runSlots = runEnd - s;
    if (runSlots >= minSlotsAsNonWork) {
      for (let k = s; k < runEnd; k++) {
        non_work[k] = true;
        breaks[k] = false;
      }
    }
    s = runEnd;
  }
  return { work_time, breaks, non_work };
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
    return { ...d, non_work: Array(48).fill(false) };
  });
}

/**
 * Derive work_time, breaks, non_work for all days with rollover: when the previous
 * day ended with work or break (no End shift), that activity rolls into the next
 * day from 00:00 until the first event on that day.
 */
export function deriveDaysWithRollover<T extends { events?: { time: string; type: string }[] }>(
  days: T[],
  weekStarting: string
): (T & { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] })[] {
  const todayStr = getTodayLocalDateString();
  const result = days.map((d) => ({ ...d })) as (T & { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] })[];
  for (let i = 0; i < days.length; i++) {
    const prevEvents = i > 0 ? result[i - 1].events || [] : [];
    const lastPrev = prevEvents[prevEvents.length - 1];
    const currentEvents = (result[i].events || []) as { time: string; type: string }[];
    const dateStr = getSheetDayDateString(weekStarting, i);
    const dayStart = new Date(dateStr + "T00:00:00").getTime();
    const isToday = dateStr === todayStr;
    const dayEnd = new Date(dateStr + "T23:59:59").getTime();
    const now = Date.now();
    const effectiveEnd = isToday ? Math.min(dayEnd, now) : dayEnd;
    const maxSlotExclusive = isToday ? Math.min(48, Math.ceil((effectiveEnd - dayStart) / (30 * 60 * 1000))) : 48;

    /* Carry over work/break from previous day only when: (1) today (so overnight work shows until they log), or (2) this day has at least one event (carry-over stops at first event). For past days with no events, do not carry over — we don't know they worked that day. */
    const carryOverType =
      (isToday || currentEvents.length > 0) &&
      lastPrev &&
      (lastPrev.type === "work" || lastPrev.type === "break")
        ? (lastPrev.type as "work" | "break")
        : null;
    let carryOverEndSlot = 0;
    if (carryOverType) {
      const firstEv = currentEvents[0];
      if (firstEv) {
        const firstEvTime = new Date(firstEv.time).getTime();
        carryOverEndSlot = Math.min(maxSlotExclusive, Math.max(0, Math.ceil((firstEvTime - dayStart) / (30 * 60 * 1000))));
      } else {
        carryOverEndSlot = maxSlotExclusive;
      }
    }

    const assumeIdleFrom = (result[i] as { assume_idle_from?: string }).assume_idle_from;

    const derived = deriveGridFromEvents(currentEvents.length ? currentEvents : undefined, dateStr, {
      carryOverType: carryOverType ?? undefined,
      carryOverEndSlot: carryOverEndSlot || undefined,
      assumeIdleFromMs: assumeIdleFrom ? new Date(assumeIdleFrom).getTime() : undefined,
      isToday,
      dayStart,
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
    const total = segments.reduce((a, b) => a + b, 0);
    const blocksOf10 = segments.filter((m) => m >= MIN_BREAK_BLOCK_MINUTES).length;
    return { total, blocksOf10 };
  })();

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
            <span className={`text-[10px] font-semibold flex items-center gap-1 ${breakRun.total >= MIN_BREAK_TOTAL_MINUTES && breakRun.blocksOf10 >= BREAK_BLOCKS_REQUIRED ? "text-emerald-600" : "text-amber-600"}`}>
              {breakRun.total >= MIN_BREAK_TOTAL_MINUTES && breakRun.blocksOf10 >= BREAK_BLOCKS_REQUIRED ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
              20 min break per 5 hours work (incl. ≥10 min continuous)
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
