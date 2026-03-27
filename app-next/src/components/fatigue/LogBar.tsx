"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Briefcase, Coffee, Moon, Square, ClipboardList, X, Loader2, AlertTriangle, Clock } from "lucide-react";
import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { VoiceAlertsToggle } from "@/components/VoiceAlertsToggle";
import { VoiceCommandControl } from "@/components/VoiceCommandControl";
import { getVoiceAlertsEnabled, speakVoiceAlert } from "@/lib/voice-alerts";
import {
  getEventsForDriverInOrder,
  getEventsInTimeOrder,
  getInsufficientNonWorkMessage,
} from "@/lib/rolling-events";
import { cn } from "@/lib/utils";

const WORK_TARGET_MINUTES = 5 * 60;
const BREAK_TARGET_MINUTES = 20;

function formatCountdown(mins: number): string {
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

/** Elapsed work/break time beside the header bar (e.g. 0h 05m). */
function formatElapsedBarDisplay(totalMinutes: number): string {
  const m = Math.floor(Math.max(0, totalMinutes));
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min.toString().padStart(2, "0")}m`;
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
  stop: "End shift",
};

/** Break follows work, work follows break. When idle or after End shift, next is Work. */
function getNextWorkBreakType(currentType: string | null): "work" | "break" {
  return currentType === "work" ? "break" : "work";
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MIN_BREAK_TOTAL_MINUTES = 20;
const MIN_BREAK_BLOCK_MINUTES = 10;
const BREAK_BLOCKS_REQUIRED = 1;
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
  return "20 min break per 5 hours work (incl. ≥10 min continuous)";
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
  weekStarting: _weekStarting,
  onLogEvent,
  onEndShiftRequest,
  workRelevantComplianceMessages,
  onAssumeIdle,
  onStartShiftBlocked,
  currentDayDisplay,
  driverType,
  primaryDriverName,
  secondDriverName,
  forgottenActionReminder,
  /** Header tint + icon (right side); tap to jump to compliance panel. */
  complianceButton,
}: {
  days: DayData[];
  currentDayIndex: number;
  weekStarting: string;
  /** Log a new event. When driver is provided and driverType is two_up, the event belongs to that driver. */
  onLogEvent: (dayIndex: number, type: string, driver?: "primary" | "second") => void;
  /** When provided, End shift (second tap) calls this instead of onLogEvent so the parent can show end km input. */
  onEndShiftRequest?: (dayIndex: number) => void;
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
  /** Reminder banner content (e.g. forgot end shift). Rendered prominently inside fixed header. */
  forgottenActionReminder?: { message: string; variant: "break-due" | "end-shift" | "break-complete" | "break-long" } | null;
  complianceButton?: {
    onClick: () => void;
    hasViolations: boolean;
    hasWarnings?: boolean;
    loading?: boolean;
  };
}) {
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [activeDriver, setActiveDriver] = useState<"primary" | "second">("primary");
  const [workWarning, setWorkWarning] = useState<{ message: string; confirmLabel: string; onConfirm: () => void; onCancel?: () => void; subtext?: string } | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0);
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(false);
  /** Tracks break bar % to announce once when 20 min minimum is reached. */
  const prevBreakPctRef = useRef<number | null>(null);
  const lastSpokenShiftBlockMsgRef = useRef<string | null>(null);
  /** Dedupe 5h insufficient-break modal speech (Strict Mode / reopen). */
  const lastSpokenFiveHourBreakRef = useRef<string | null>(null);

  useEffect(() => {
    setVoiceAlertsEnabled(getVoiceAlertsEnabled());
  }, []);

  const day = days[currentDayIndex];
  const dayForCardFields = currentDayDisplay ?? day;
  /** Chronological events for this driver across all sheet days — open work/break survives calendar midnight. */
  const eventsForDriver = useMemo(
    () => getEventsForDriverInOrder(days, driverType === "two_up" ? activeDriver : undefined),
    [days, driverType, activeDriver]
  );
  const lastEvent = eventsForDriver.length ? eventsForDriver[eventsForDriver.length - 1] : undefined;
  const currentType = lastEvent && lastEvent.type !== "stop" ? lastEvent.type : null;

  /** Faster tick during work/break so compliance header (e.g. pending → OK) updates within a few seconds. */
  useEffect(() => {
    const ms = currentType === "work" || currentType === "break" ? 2000 : 10000;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [currentType]);

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

  const complianceTone = (() => {
    if (!complianceButton) return "default" as const;
    if (complianceButton.loading) return "default" as const;
    if (complianceButton.hasViolations) return "violation" as const;
    if (complianceButton.hasWarnings) return "warning" as const;
    /** Break running but 20 min statutory bar not complete — between “warning” and full “OK” green. */
    if (
      currentType === "break" &&
      contextualBar?.type === "break" &&
      contextualBar.pct < 100
    ) {
      return "pending" as const;
    }
    return "ok" as const;
  })();

  /** Saturated bands + thick border for single-glance compliance (outdoor / cab visibility). */
  const headerShellClass =
    complianceTone === "violation" || complianceTone === "warning"
      ? "bg-amber-400 dark:bg-amber-500 border-b-4 border-amber-900 dark:border-amber-100 shadow-lg"
      : complianceTone === "pending"
          ? "bg-gradient-to-r from-amber-400 via-lime-400 to-emerald-500 dark:from-amber-600 dark:via-lime-600 dark:to-emerald-600 border-b-4 border-amber-900 dark:border-emerald-100 shadow-lg"
          : complianceTone === "ok"
            ? "bg-emerald-400 dark:bg-emerald-600 border-b-4 border-emerald-900 dark:border-emerald-100 shadow-lg"
            : "bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-md";

  /** Keep labels readable on solid compliance backgrounds. */
  const complianceBarTextClass =
    complianceTone === "violation" || complianceTone === "warning"
      ? "text-amber-950 dark:text-white [&_.text-slate-400]:!text-amber-900/80 [&_.text-slate-400]:dark:!text-amber-50 [&_.text-slate-500]:dark:!text-amber-50 [&_.text-slate-600]:dark:!text-white [&_.text-slate-700]:dark:!text-white [&_.text-slate-800]:dark:!text-white [&_.text-slate-300]:dark:!text-white [&_.text-slate-100]:dark:!text-white [&_.text-slate-200]:dark:!text-white"
      : complianceTone === "pending"
          ? "text-emerald-950 dark:text-white [&_.text-slate-400]:!text-amber-900/80 [&_.text-slate-400]:dark:!text-amber-50 [&_.text-slate-500]:dark:!text-lime-50 [&_.text-slate-600]:dark:!text-white [&_.text-slate-700]:dark:!text-white [&_.text-slate-800]:dark:!text-white [&_.text-slate-300]:dark:!text-white [&_.text-slate-100]:dark:!text-white [&_.text-slate-200]:dark:!text-white"
          : complianceTone === "ok"
            ? "text-emerald-950 dark:text-white [&_.text-slate-400]:!text-emerald-900/75 [&_.text-slate-400]:dark:!text-emerald-50 [&_.text-slate-500]:dark:!text-emerald-50 [&_.text-slate-600]:dark:!text-white [&_.text-slate-700]:dark:!text-white [&_.text-slate-800]:dark:!text-white [&_.text-slate-300]:dark:!text-white [&_.text-slate-100]:dark:!text-white [&_.text-slate-200]:dark:!text-white"
            : "";

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

  /** Phase 1 voice: work-warning modals (card incomplete, 5h break rule). */
  useEffect(() => {
    if (!workWarning) {
      lastSpokenShiftBlockMsgRef.current = null;
      lastSpokenFiveHourBreakRef.current = null;
      return;
    }
    if (!voiceAlertsEnabled) return;

    if (workWarning.confirmLabel === "Go to today's card") {
      const key = workWarning.message;
      if (lastSpokenShiftBlockMsgRef.current === key) return;
      lastSpokenShiftBlockMsgRef.current = key;
      speakVoiceAlert(
        "Complete today's card before starting shift. You need rego, destination, and start kilometres."
      );
      return;
    }

    /** 5h rule: only this modal uses confirm "Log work anyway" + this subtext (compliance uses different copy). */
    if (
      workWarning.confirmLabel === "Log work anyway" &&
      workWarning.subtext === "This will log work now."
    ) {
      const key = workWarning.message;
      if (lastSpokenFiveHourBreakRef.current === key) return;
      lastSpokenFiveHourBreakRef.current = key;
      speakVoiceAlert(
        "Critical five hour rule. Twenty minute break required."
      );
      return;
    }
  }, [workWarning, voiceAlertsEnabled]);

  /** Phase 1 voice: minimum 20 minute break bar just reached 100%. */
  useEffect(() => {
    if (!voiceAlertsEnabled) return;
    if (currentType !== "break" || !contextualBar || contextualBar.type !== "break") {
      prevBreakPctRef.current = null;
      return;
    }
    const pct = contextualBar.pct;
    const prev = prevBreakPctRef.current;
    prevBreakPctRef.current = pct;
    if (prev !== null && prev < 100 && pct >= 100) {
      speakVoiceAlert("Minimum break complete. You can resume work when ready.");
    }
  }, [currentType, contextualBar, voiceAlertsEnabled, tick]);

  /** Warning when finishing a break (switching to work): short breaks count as work time. */
  const getShortBreakWarning = (newType: string) => {
    if (newType !== "work" || currentType !== "break" || !lastEvent) return null;
    const breakStart = new Date(lastEvent.time).getTime();
    const breakMinutes = Math.floor((Date.now() - breakStart) / 60000);
    if (breakMinutes >= MIN_BREAK_BLOCK_MINUTES) return null;
    return "Break under 10 minutes is automatically counted as work time.";
  };

  /** Warning when starting work with <7h non-work since last shift (rolling time: last stop on this driver's timeline). */
  const getInsufficientNonWorkWarning = () => {
    if (currentType !== null && currentType !== "stop") return null;
    const rolling =
      driverType === "two_up"
        ? getEventsInTimeOrder(days).filter((ev) => (ev.driver ?? "primary") === activeDriver)
        : getEventsInTimeOrder(days);
    return getInsufficientNonWorkMessage(rolling, Date.now(), MIN_NON_WORK_HOURS_BETWEEN_SHIFTS);
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
        const insufficientBreakMsg = getBreakWarningIfNeeded(eventsForDriver, Date.now());
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
    <div className={cn("space-y-2", complianceBarTextClass)}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {driverType === "two_up" && (
          <span className="flex w-full justify-center items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 sm:w-auto sm:justify-start">
            <span className="uppercase tracking-wider font-semibold">Driver</span>
            <button
              type="button"
              className={`px-1.5 py-0.5 rounded-md border text-[11px] font-medium ${
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
              className={`px-1.5 py-0.5 rounded-md border text-[11px] font-medium ${
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
        <div className="flex w-full max-w-md flex-col items-stretch gap-2 sm:inline-flex sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-3 shrink-0">
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
                className={`flex items-center justify-center gap-3 sm:gap-4 px-6 py-4 sm:px-10 sm:py-5 rounded-md text-white text-base sm:text-lg font-bold transition-all duration-150 active:scale-95 shadow-lg min-h-[56px] sm:min-h-[64px] w-full max-w-sm min-w-0 sm:min-w-[180px] sm:w-auto shrink-0 ${theme.button} ${isPending ? "ring-2 ring-white ring-offset-2 ring-offset-slate-200 dark:ring-offset-slate-800 animate-pulse" : ""}`}
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
              ? "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300"
              : theme.button;
            return (
              <button
                type="button"
                onClick={() => handleLog(type)}
                disabled={isDisabled}
                className={`flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-lg text-white text-xs font-bold transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0 ${buttonColors} ${isPending ? "ring-2 ring-white ring-offset-2 ring-offset-slate-200 dark:ring-offset-slate-800 animate-pulse" : ""}`}
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
          <div className="mb-0.5 flex items-start gap-2 min-w-0">
            <span className="min-w-0 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {contextualBar.type === "work" && (() => {
                const breakDueByMs = getBreakDueByTime(eventsForDriver, Date.now());
                const timeStr =
                  breakDueByMs != null
                    ? new Date(breakDueByMs).toLocaleTimeString("en-AU", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : null;
                return timeStr != null
                  ? `CURRENT ACTIVITY WORK - BREAK DUE BY ${timeStr}`
                  : "CURRENT ACTIVITY WORK - BREAK DUE";
              })()}
              {contextualBar.type === "break" && (() => {
                const completeByMs = getBreakCompleteByTime(eventsForDriver, Date.now());
                const timeStr =
                  completeByMs != null
                    ? new Date(completeByMs).toLocaleTimeString("en-AU", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : null;
                return timeStr != null
                  ? `CURRENT ACTIVITY BREAK - COMPLETE BY ${timeStr}`
                  : "CURRENT ACTIVITY BREAK - 20 MIN MINIMUM";
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "relative h-8 min-h-8 flex-1 min-w-0 rounded-lg overflow-hidden",
                complianceTone === "default"
                  ? "bg-slate-100 dark:bg-slate-700"
                  : "bg-black/15 dark:bg-black/25 ring-1 ring-black/10 dark:ring-white/20"
              )}
            >
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
            <span
              className="h-8 min-h-8 flex shrink-0 items-center font-mono font-semibold tabular-nums leading-none text-[2rem] tracking-tight"
              title="Elapsed time this work / break"
              aria-live="polite"
            >
              {formatElapsedBarDisplay(contextualBar.elapsed)}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* In-flow spacer so title/save row sit below the fixed bar; same structure = same height */}
      <div
        className="max-w-[1400px] mx-auto px-4 py-3 invisible pointer-events-none select-none flex flex-col gap-2 md:flex-row md:items-start md:gap-3"
        aria-hidden
      >
        <div className="flex-1 min-w-0 w-full">{barContent}</div>
        <div className="flex w-full shrink-0 items-center justify-end gap-2 md:w-auto md:self-center md:justify-start md:gap-2">
          <span className="w-12 h-12 shrink-0" aria-hidden />
          <div className="flex shrink-0 items-center gap-1">
            <span className="w-11 h-11 shrink-0" aria-hidden />
            <span className="w-11 h-11 shrink-0" aria-hidden />
            <span className="w-11 h-11 shrink-0" aria-hidden />
          </div>
        </div>
      </div>
      <div
        className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 transition-colors duration-300 ${headerShellClass}`}
      >
        <div className="max-w-[1400px] mx-auto flex flex-col gap-2 md:flex-row md:items-start md:gap-3">
          <div className="flex-1 min-w-0 w-full">{barContent}</div>
          <div className="flex w-full shrink-0 items-center justify-end gap-2 border-t border-black/10 pt-2 md:w-auto md:self-center md:border-t-0 md:pt-0 md:justify-start">
            {complianceButton && (
            <button
              type="button"
              onClick={complianceButton.onClick}
              disabled={complianceButton.loading}
              className={cn(
                "shrink-0 flex items-center justify-center h-11 w-11 min-h-[44px] min-w-[44px] md:h-12 md:w-12 md:min-h-[48px] md:min-w-[48px] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none transition-colors",
                complianceTone === "ok" &&
                  "bg-black/20 dark:bg-white/25 hover:bg-black/30 dark:hover:bg-white/35 focus-visible:ring-emerald-900 dark:focus-visible:ring-white focus-visible:ring-offset-emerald-400 dark:focus-visible:ring-offset-emerald-600",
                complianceTone === "pending" &&
                  "bg-black/20 dark:bg-white/25 hover:bg-black/30 dark:hover:bg-white/35 focus-visible:ring-amber-900 dark:focus-visible:ring-amber-100 focus-visible:ring-offset-amber-400 dark:focus-visible:ring-offset-lime-600",
                (complianceTone === "warning" || complianceTone === "violation") &&
                  "bg-black/15 dark:bg-black/20 hover:bg-black/25 dark:hover:bg-black/30 focus-visible:ring-amber-900 dark:focus-visible:ring-amber-100 focus-visible:ring-offset-amber-400 dark:focus-visible:ring-offset-amber-500",
                complianceTone === "default" && "rounded-lg hover:bg-black/10 dark:hover:bg-white/15 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
              )}
              title={
                complianceButton.loading
                  ? "Checking compliance…"
                  : complianceButton.hasViolations
                    ? "View compliance — violations"
                    : complianceButton.hasWarnings
                      ? "View compliance — warnings"
                      : complianceTone === "pending"
                        ? "Break in progress — tap for compliance details"
                        : "View compliance — all clear"
              }
              aria-label={
                complianceButton.loading
                  ? "Compliance checking"
                  : complianceButton.hasViolations
                    ? "Compliance: violations — jump to details"
                    : complianceButton.hasWarnings
                      ? "Compliance: warnings — jump to details"
                      : complianceTone === "pending"
                        ? "Compliance: break in progress — jump to details"
                        : "Compliance: OK — jump to details"
              }
            >
              {complianceButton.loading ? (
                <Loader2
                  className={cn(
                    "w-8 h-8 md:w-9 md:h-9 animate-spin shrink-0",
                    complianceTone === "default" ? "text-slate-700 dark:text-slate-200" : "text-slate-900 dark:text-white"
                  )}
                  aria-hidden
                />
              ) : complianceButton.hasViolations ? (
                <X
                  className="w-8 h-8 md:w-9 md:h-9 shrink-0 text-amber-950 dark:text-white drop-shadow-sm"
                  strokeWidth={3}
                  aria-hidden
                />
              ) : complianceButton.hasWarnings ? (
                <AlertTriangle
                  className="w-8 h-8 md:w-9 md:h-9 shrink-0 text-amber-950 dark:text-white drop-shadow-sm"
                  strokeWidth={2.5}
                  aria-hidden
                />
              ) : complianceTone === "pending" ? (
                <Clock
                  className="w-8 h-8 md:w-9 md:h-9 shrink-0 text-emerald-950 dark:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                  strokeWidth={2.5}
                  aria-hidden
                />
              ) : (
                <ClipboardList
                  className="w-8 h-8 md:w-9 md:h-9 shrink-0 text-emerald-950 dark:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                  strokeWidth={2}
                  aria-hidden
                />
              )}
            </button>
            )}
          <div className="flex shrink-0 items-center gap-1">
            <VoiceCommandControl
              voiceLabels={{
                work:
                  getNextWorkBreakType(currentType) === "work" &&
                  (currentType === null || currentType === "stop")
                    ? "Start shift"
                    : "Log work",
                break: "Log break",
                stop: EVENT_LABELS.stop,
              }}
              onConfirmIntent={(intent) => handleLog(intent)}
            />
            <VoiceAlertsToggle enabled={voiceAlertsEnabled} onChange={setVoiceAlertsEnabled} />
            <ThemeToggle />
          </div>
          </div>
        </div>
        {forgottenActionReminder && (
          <div
            role="alert"
            className="max-w-[1400px] mx-auto mt-2 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden />
              <p className="flex-1 font-medium min-w-0">{forgottenActionReminder.message}</p>
            </div>
            {forgottenActionReminder.variant === "end-shift" && onEndShiftRequest && onAssumeIdle && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onEndShiftRequest(currentDayIndex)}
                  className="h-11 w-full rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  End shift now
                </button>
                <button
                  type="button"
                  onClick={onAssumeIdle}
                  className="h-11 w-full rounded-lg bg-white/80 dark:bg-slate-900/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 font-semibold"
                >
                  Mark non-work from now
                </button>
              </div>
            )}
          </div>
        )}
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
