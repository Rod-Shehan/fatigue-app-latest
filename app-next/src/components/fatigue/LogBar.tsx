"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Briefcase, Coffee, Moon, Square } from "lucide-react";
import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { getEventsInTimeOrder, getInsufficientNonWorkMessage } from "@/lib/rolling-events";
import { parseLocalDate } from "@/lib/weeks";

const WORK_TARGET_MINUTES = 5 * 60;
const BREAK_TARGET_MINUTES = 20;

function formatCountdown(mins: number): string {
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

const EVENT_ICONS: Record<ActivityKey, React.ComponentType<{ className?: string }>> = {
  work: Briefcase,
  break: Coffee,
  non_work: Moon,
  stop: Square,
};
const EVENT_LABELS: Record<ActivityKey, string> = {
  work: "Work",
  break: "Break",
  non_work: "Non-Work Time",
  stop: "End Shift",
};

/** Break follows work, work follows break. When idle or after End Shift, next is Work. */
function getNextWorkBreakType(currentType: string | null): "work" | "break" {
  return currentType === "work" ? "break" : "work";
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MIN_BREAK_TOTAL_MINUTES = 20;
const MIN_BREAK_BLOCK_MINUTES = 10;
const BREAK_BLOCKS_REQUIRED = 2;
/** Minimum non-work time (hours) between shifts. */
const MIN_NON_WORK_HOURS_BETWEEN_SHIFTS = 7;
const CONFIRM_RESET_MS = 2500;

function getDurationMinutes(start: string, end: string) {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

function breakBlockIsValid(segments: number[]): boolean {
  const totalMins = segments.reduce((a, b) => a + b, 0);
  const blocksOf10 = segments.filter((m) => m >= MIN_BREAK_BLOCK_MINUTES).length;
  return totalMins >= MIN_BREAK_TOTAL_MINUTES && blocksOf10 >= BREAK_BLOCKS_REQUIRED;
}

/**
 * Computes whether a warning should be shown when switching to "work" now.
 * We only warn once there's actually been ~5h of work since the last valid break (or a stop/non_work reset).
 */
function getBreakWarningIfNeeded(events: { time: string; type: string }[], nowMs: number): string | null {
  if (events.length === 0) return null;

  // Simulate the timeline up to "now" (end of last segment is now).
  let workMinsSinceValidBreak = 0;
  let breakSegments: number[] = [];
  let breakStartMs: number | null = null;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const segStart = new Date(ev.time).getTime();
    const segEnd = i + 1 < events.length ? new Date(events[i + 1].time).getTime() : nowMs;
    const dur = Math.max(0, Math.floor((segEnd - segStart) / 60000));

    if (ev.type === "work") {
      // If we just finished a break block, decide whether it reset the window.
      if (breakSegments.length > 0) {
        if (breakBlockIsValid(breakSegments)) workMinsSinceValidBreak = 0;
        breakSegments = [];
        breakStartMs = null;
      }
      workMinsSinceValidBreak += dur;
    } else if (ev.type === "break") {
      if (breakStartMs == null) breakStartMs = segStart;
      breakSegments.push(dur);
    } else {
      // non_work or stop: reset the 5h window tracking.
      workMinsSinceValidBreak = 0;
      breakSegments = [];
      breakStartMs = null;
    }
  }

  // If we're about to start work after a break, the last event should be "break".
  // Only warn if we already have ~5h of work banked and this last break block is not valid.
  const last = events[events.length - 1];
  if (last.type !== "break") return null;
  if (workMinsSinceValidBreak < WORK_TARGET_MINUTES) return null;
  if (breakBlockIsValid(breakSegments)) return null;
  return "20 min break for ea 5 hours work time - 10 min minimum x 2";
}

/**
 * Break due by time: 5h from start of current 5h work window, minus 20 min if no 10+ min break
 * in that window, or minus 10 min if a 10+ min break has been taken in that window.
 */
function getBreakDueByTime(events: { time: string; type: string }[], nowMs: number): number | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  if (last.type !== "work") return null;
  const WORK_WINDOW_MIN = WORK_TARGET_MINUTES; // 300
  let remainingWork = WORK_WINDOW_MIN;
  let windowStartMs: number | null = null;
  for (let i = events.length - 1; i >= 0; i--) {
    const segEnd = i === events.length - 1 ? nowMs : new Date(events[i + 1].time).getTime();
    const segStart = new Date(events[i].time).getTime();
    const durationMin = Math.floor((segEnd - segStart) / 60000);
    if (events[i].type === "work") {
      if (remainingWork <= durationMin) {
        windowStartMs = segEnd - remainingWork * 60 * 1000;
        break;
      }
      remainingWork -= durationMin;
    }
  }
  // If we haven't yet accumulated 5h work, the window is the current work run (break due from its start).
  if (windowStartMs == null) windowStartMs = new Date(last.time).getTime();
  let had10MinBreak = false;
  for (let i = 0; i < events.length; i++) {
    if (events[i].type !== "break") continue;
    const segStart = new Date(events[i].time).getTime();
    const segEnd = i + 1 < events.length ? new Date(events[i + 1].time).getTime() : nowMs;
    const durationMin = Math.floor((segEnd - segStart) / 60000);
    const overlapsWindow = segStart < nowMs && segEnd > windowStartMs;
    if (durationMin >= MIN_BREAK_BLOCK_MINUTES && overlapsWindow) {
      had10MinBreak = true;
      break;
    }
  }
  const minutesBeforeDue = had10MinBreak ? 10 : 20;
  return windowStartMs + (WORK_WINDOW_MIN - minutesBeforeDue) * 60 * 1000;
}

/**
 * Break complete by time: start of current break + 10 min if a 10+ min break was already taken
 * in the preceding 5h work window, otherwise + 20 min.
 */
function getBreakCompleteByTime(events: { time: string; type: string }[], nowMs: number): number | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  if (last.type !== "break") return null;
  const breakStartMs = new Date(last.time).getTime();
  const WORK_WINDOW_MIN = WORK_TARGET_MINUTES;
  let remainingWork = WORK_WINDOW_MIN;
  let windowStartMs: number | null = null;
  for (let i = events.length - 1; i >= 0; i--) {
    const segEnd = i === events.length - 1 ? breakStartMs : new Date(events[i + 1].time).getTime();
    const segStart = new Date(events[i].time).getTime();
    const durationMin = Math.floor((segEnd - segStart) / 60000);
    if (events[i].type === "work") {
      if (remainingWork <= durationMin) {
        windowStartMs = segEnd - remainingWork * 60 * 1000;
        break;
      }
      remainingWork -= durationMin;
    }
  }
  if (windowStartMs == null && events.length >= 2) windowStartMs = new Date(events[events.length - 2].time).getTime();
  if (windowStartMs == null) return null;
  let had10MinBreakInWindow = false;
  for (let i = 0; i < events.length; i++) {
    if (events[i].type !== "break") continue;
    const segStart = new Date(events[i].time).getTime();
    const segEnd = i + 1 < events.length ? new Date(events[i + 1].time).getTime() : breakStartMs;
    if (segEnd > breakStartMs) continue;
    const durationMin = Math.floor((segEnd - segStart) / 60000);
    const overlapsWindow = segStart < breakStartMs && segEnd > windowStartMs;
    if (durationMin >= MIN_BREAK_BLOCK_MINUTES && overlapsWindow) {
      had10MinBreakInWindow = true;
      break;
    }
  }
  const minutesForBreak = had10MinBreakInWindow ? 10 : 20;
  return breakStartMs + minutesForBreak * 60 * 1000;
}

type DayData = {
  events?: { time: string; type: string }[];
  truck_rego?: string;
  destination?: string;
  start_kms?: number | null;
};

export default function LogBar({
  days,
  currentDayIndex,
  weekStarting,
  onLogEvent,
  onEndShiftRequest,
  leadingIcon,
  workRelevantComplianceMessages,
  onAssumeIdle,
  onStartShiftBlocked,
  currentDayDisplay,
  driverType,
  primaryDriverName,
  secondDriverName,
}: {
  days: DayData[];
  currentDayIndex: number;
  weekStarting: string;
  /** Log a new event. When driver is provided and driverType is two_up, the event belongs to that driver. */
  onLogEvent: (dayIndex: number, type: string, driver?: "primary" | "second") => void;
  /** When provided, End Shift (second tap) calls this instead of onLogEvent so the parent can show end km input. */
  onEndShiftRequest?: (dayIndex: number) => void;
  /** Optional icon shown to the left of the "Today" label in the top header row. */
  leadingIcon?: React.ReactNode;
  /** Prospective compliance messages (non-work time, limits) if work were logged now. When set, shown when user taps Work. */
  workRelevantComplianceMessages?: string[];
  /** When provided and in work/break state, "Assume idle" is shown. Call to mark from now as non-work (forgot to end shift). */
  onAssumeIdle?: () => void;
  /** When Start shift is blocked (rego/destination/start KM missing), called after user dismisses so parent can scroll to day card. */
  onStartShiftBlocked?: () => void;
  /** When provided, used for Start shift gate (rego/destination/start KM) so carried-over values count. */
  currentDayDisplay?: DayData;
  /** Solo or two_up — controls whether driver toggle is shown. */
  driverType?: string;
  /** Two-up primary driver name (sheet driver_name). */
  primaryDriverName?: string;
  /** Two-up second driver name (sheet second_driver). */
  secondDriverName?: string;
}) {
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [activeDriver, setActiveDriver] = useState<"primary" | "second">("primary");
  const [workWarning, setWorkWarning] = useState<{ message: string; confirmLabel: string; onConfirm: () => void; onCancel?: () => void; subtext?: string } | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const day = days[currentDayIndex];
  const dayForCardFields = currentDayDisplay ?? day;
  const events = day?.events || [];
  const lastEvent = events[events.length - 1];
  const currentType = lastEvent && lastEvent.type !== "stop" ? lastEvent.type : null;

  const elapsedMs = currentType && lastEvent ? Date.now() - new Date(lastEvent.time).getTime() : 0;
  const elapsedMinutes = Math.max(0, elapsedMs / 60000);
  const contextualBar = (() => {
    if (!currentType || currentType === "stop") return null;
    if (currentType === "work") {
      const target = WORK_TARGET_MINUTES;
      const pct = Math.min(100, (elapsedMinutes / target) * 100);
      const remaining = Math.max(0, target - Math.floor(elapsedMinutes));
      return { type: "work" as const, elapsed: elapsedMinutes, target, pct, remaining, color: ACTIVITY_THEME.work.hex, label: "5h" };
    }
    if (currentType === "break") {
      const target = BREAK_TARGET_MINUTES;
      const pct = Math.min(100, (elapsedMinutes / target) * 100);
      const remaining = Math.max(0, target - Math.floor(elapsedMinutes));
      return { type: "break" as const, elapsed: elapsedMinutes, target, pct, remaining, color: ACTIVITY_THEME.break.hex, label: "20m" };
    }
    return null;
  })();

  const currentDayLabel = (() => {
    if (!weekStarting) return DAY_NAMES[currentDayIndex];
    const d = parseLocalDate(weekStarting);
    d.setDate(d.getDate() + currentDayIndex);
    return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  })();
  const currentDayLabelShort = (() => {
    if (!weekStarting) return DAY_NAMES[currentDayIndex];
    const d = parseLocalDate(weekStarting);
    d.setDate(d.getDate() + currentDayIndex);
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  })();

  const clearPending = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setPendingType(null);
  }, []);

  useEffect(() => {
    clearPending();
    setWorkWarning(null);
  }, [currentDayIndex, clearPending]);

  /** Warning when finishing a break (switching to work): short breaks count as work time. */
  const getShortBreakWarning = (newType: string) => {
    if (newType !== "work" || currentType !== "break" || !lastEvent) return null;
    const breakStart = new Date(lastEvent.time).getTime();
    const breakMinutes = Math.floor((Date.now() - breakStart) / 60000);
    if (breakMinutes >= MIN_BREAK_BLOCK_MINUTES) return null;
    return "Breaks under 10 minutes are automatically counted as work time.";
  };

  /** Warning when starting work with <7h non-work since last shift (rolling time: last stop anywhere). */
  const getInsufficientNonWorkWarning = () => {
    if (currentType !== null && currentType !== "stop") return null;
    const rollingEvents = getEventsInTimeOrder(days);
    return getInsufficientNonWorkMessage(rollingEvents, Date.now(), MIN_NON_WORK_HOURS_BETWEEN_SHIFTS);
  };

  const handleLog = (type: string) => {
    if (type === currentType) return;

    const isStartingShift = type === "work" && (currentType === null || currentType === "stop");
    if (isStartingShift) {
      const hasRego = (dayForCardFields?.truck_rego ?? "").toString().trim() !== "";
      const hasDestination = (dayForCardFields?.destination ?? "").toString().trim() !== "";
      const hasStartKms = dayForCardFields?.start_kms != null && !Number.isNaN(Number(dayForCardFields.start_kms));
      if (!hasRego || !hasDestination || !hasStartKms) {
        const missing: string[] = [];
        if (!hasRego) missing.push("Rego");
        if (!hasDestination) missing.push("Destination");
        if (!hasStartKms) missing.push("Start KM");
        setWorkWarning({
          message: `Please complete today's card before starting shift: ${missing.join(", ")}.`,
          confirmLabel: "Go to today's card",
          subtext: "Fill in the fields above, then tap Start shift again.",
          onConfirm: () => {
            setWorkWarning(null);
            onStartShiftBlocked?.();
          },
          onCancel: () => setWorkWarning(null),
        });
        return;
      }
    }

    if (pendingType === type) {
      if (type === "work") {
        const insufficientBreakMsg = getBreakWarningIfNeeded(events, Date.now());
        if (insufficientBreakMsg) {
          setWorkWarning({
            message: insufficientBreakMsg,
            confirmLabel: "Log work anyway",
            subtext: "This will log work now.",
            onConfirm: () => {
              setWorkWarning(null);
              clearPending();
              const driverForEvent: "primary" | "second" | undefined =
                driverType === "two_up" ? activeDriver : undefined;
              onLogEvent(currentDayIndex, type, driverForEvent);
            },
            onCancel: clearPending,
          });
          return;
        }
      }
      clearPending();
      if (type === "stop" && onEndShiftRequest) {
        onEndShiftRequest(currentDayIndex);
        return;
      }
      const driverForEvent: "primary" | "second" | undefined =
        driverType === "two_up" && type === "work" ? activeDriver : undefined;
      onLogEvent(currentDayIndex, type, driverForEvent);
      return;
    }

    if (type === "work") {
      const shortBreakMsg = getShortBreakWarning(type);
      if (shortBreakMsg) {
        setWorkWarning({
          message: shortBreakMsg,
          confirmLabel: "Finish break anyway",
          subtext: "Tap Work again within a few seconds to confirm.",
          onConfirm: () => {
            setWorkWarning(null);
            setPendingType("work");
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
            resetTimerRef.current = setTimeout(clearPending, CONFIRM_RESET_MS);
          },
        });
        return;
      }
      const nonWorkMsg = getInsufficientNonWorkWarning();
      if (nonWorkMsg) {
        setWorkWarning({
          message: nonWorkMsg,
          confirmLabel: "Start shift anyway",
          subtext: "Tap Work again within a few seconds to confirm.",
          onConfirm: () => {
            setWorkWarning(null);
            setPendingType("work");
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
            resetTimerRef.current = setTimeout(clearPending, CONFIRM_RESET_MS);
          },
        });
        return;
      }
      if (workRelevantComplianceMessages?.length) {
        const message =
          workRelevantComplianceMessages.length === 1
            ? workRelevantComplianceMessages[0]
            : "Logging work now may affect these compliance rules:\n\n• " + workRelevantComplianceMessages.join("\n\n• ");
        setWorkWarning({
          message,
          confirmLabel: currentType === null || currentType === "stop" ? "Start shift anyway" : "Log work anyway",
          subtext: "Tap Work again within a few seconds to confirm.",
          onConfirm: () => {
            setWorkWarning(null);
            setPendingType("work");
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
            resetTimerRef.current = setTimeout(clearPending, CONFIRM_RESET_MS);
          },
        });
        return;
      }
    }
    setPendingType(type);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(clearPending, CONFIRM_RESET_MS);
  };

  const barContent = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base min-w-0">
        {leadingIcon != null && (
          <span className="flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0" aria-hidden>
            {leadingIcon}
          </span>
        )}
        <span className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold shrink-0">Today</span>
        <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums shrink-0">
          <span className="hidden sm:inline">{currentDayLabel}</span>
          <span className="sm:hidden">{currentDayLabelShort}</span>
        </span>
        {driverType === "two_up" && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 ml-2">
            <span className="uppercase tracking-wider font-semibold">Driver</span>
            <button
              type="button"
              className={`px-1.5 py-0.5 rounded-full border text-[11px] font-medium ${
                activeDriver === "primary"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                  : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              }`}
              onClick={() => setActiveDriver("primary")}
            >
              {primaryDriverName || "Driver 1"}
            </button>
            <button
              type="button"
              className={`px-1.5 py-0.5 rounded-full border text-[11px] font-medium ${
                activeDriver === "second"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                  : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              }`}
              onClick={() => setActiveDriver("second")}
            >
              {secondDriverName || "Driver 2"}
            </button>
          </span>
        )}
        {currentType && (
          <span className="text-slate-500 dark:text-slate-400 shrink-0">
            <span className="hidden sm:inline">— current activity: </span>
            <span className="sm:hidden">· </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{currentType}</span>
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex items-center gap-3 shrink-0">
          {(() => {
            const nextWorkBreak = getNextWorkBreakType(currentType);
            const isPending = pendingType === nextWorkBreak;
            const theme = ACTIVITY_THEME[nextWorkBreak];
            const isStartingShift = nextWorkBreak === "work" && (currentType === null || currentType === "stop");
            const primaryLabel = isStartingShift ? "Start shift" : EVENT_LABELS[nextWorkBreak];
            return (
              <button
                type="button"
                onClick={() => handleLog(nextWorkBreak)}
                className={`flex items-center justify-center gap-4 px-10 py-5 rounded-2xl text-white text-lg font-bold transition-all duration-150 active:scale-95 shadow-lg min-h-[64px] min-w-[180px] shrink-0 ${theme.button} ${isPending ? "ring-2 ring-white ring-offset-2 ring-offset-slate-200 dark:ring-offset-slate-800 animate-pulse" : ""}`}
              >
                {React.createElement(EVENT_ICONS[nextWorkBreak], { className: "w-8 h-8" })}
                {isPending ? "Tap again to log" : primaryLabel}
              </button>
            );
          })()}
          {(() => {
            const type = "stop";
            const isPending = pendingType === type;
            const isDisabled = currentType === type;
            const theme = ACTIVITY_THEME[type];
            const buttonColors = isPending
              ? "bg-red-500 hover:bg-red-600 disabled:bg-red-300"
              : theme.button;
            return (
              <button
                type="button"
                onClick={() => handleLog(type)}
                disabled={isDisabled}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-bold transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0 ${buttonColors} ${isPending ? "ring-2 ring-white ring-offset-2 ring-offset-slate-200 dark:ring-offset-slate-800 animate-pulse" : ""}`}
              >
                {React.createElement(EVENT_ICONS[type], { className: "w-4 h-4" })}
                {isPending ? "Tap again to end shift" : EVENT_LABELS[type]}
              </button>
            );
          })()}
        </div>
      </div>

      {contextualBar && (
        <div className="pt-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {contextualBar.type === "work" && (() => {
                const breakDueByMs = getBreakDueByTime(events, Date.now());
                return breakDueByMs != null
                  ? `WORK — BREAK DUE BY ${new Date(breakDueByMs).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })}`
                  : "WORK — BREAK DUE";
              })()}
              {contextualBar.type === "break" && (() => {
                const completeByMs = getBreakCompleteByTime(events, Date.now());
                return completeByMs != null
                  ? `BREAK COMPLETE BY ${new Date(completeByMs).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })}`
                  : "BREAK — 20 min";
              })()}
            </span>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
              {null}
            </span>
          </div>
          <div className="relative h-8 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
            <div className="absolute inset-0 rounded-lg">
              <div
                className="absolute inset-y-0 left-0 rounded-lg transition-all duration-300"
                style={{ width: `${contextualBar.pct}%`, backgroundColor: contextualBar.color }}
              />
              {contextualBar.type === "work" && [1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-white/60"
                  style={{ left: `${(i / 5) * 100}%` }}
                  aria-hidden
                />
              ))}
              {contextualBar.type === "break" && [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-white/60"
                  style={{ left: `${(i / 4) * 100}%` }}
                  aria-hidden
                />
              ))}
            </div>
            {contextualBar.pct < 100 && (
              <div
                className="absolute top-1/2 w-2.5 h-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-black dark:bg-white border-2 border-slate-400 dark:border-slate-300 shadow-md pointer-events-none z-10"
                style={{ left: `${contextualBar.pct}%` }}
                title="Current progress"
                aria-hidden
              />
            )}
          </div>
          {onAssumeIdle && (
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
              Forgot to end shift?{" "}
              <button type="button" onClick={onAssumeIdle} className="underline font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100">
                Mark as non-work from now
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* In-flow spacer so title/save row sit below the fixed bar; same structure = same height */}
      <div className="max-w-[1400px] mx-auto px-4 py-3 invisible pointer-events-none select-none flex items-start gap-3" aria-hidden>
        <div className="flex-1 min-w-0">{barContent}</div>
        <div className="w-9 h-9 shrink-0" />
      </div>
      <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-md px-4 py-3">
        <div className="max-w-[1400px] mx-auto flex items-start gap-3">
          <div className="flex-1 min-w-0">{barContent}</div>
          <div className="shrink-0 pt-0.5">
            <ThemeToggle />
          </div>
        </div>
        {workWarning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" aria-modal role="alertdialog" aria-labelledby="work-warning-title">
            <div className="mx-4 max-w-sm rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-600 shadow-xl p-4 space-y-3">
              <p id="work-warning-title" className="font-semibold text-amber-800 dark:text-amber-200">⚠️ Work time rule</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">{workWarning.message}</p>
              {workWarning.subtext && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{workWarning.subtext}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    workWarning.onCancel?.();
                    setWorkWarning(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => workWarning.onConfirm()}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {workWarning.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
