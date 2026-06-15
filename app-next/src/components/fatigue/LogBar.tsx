"use client";

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import {
  Briefcase,
  Coffee,
  Moon,
  Square,
  ClipboardList,
  X,
  Loader2,
  AlertTriangle,
  Clock,
  SlidersHorizontal,
  MoreVertical,
} from "lucide-react";
import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { VoiceAlertsToggle } from "@/components/VoiceAlertsToggle";
import { VoiceCommandControl } from "@/components/VoiceCommandControl";
import { getVoiceAlertsEnabled, speakVoiceAlert } from "@/lib/voice-alerts";
import {
  concatenateTimelineSlices,
  getEventsForDriverInOrder,
  getEventsInTimeOrder,
  getInsufficientNonWorkMessage,
  type TimelineSlice,
} from "@/lib/rolling-events";
import { getSeventeenHourEpisodeStatus } from "@/lib/seventeen-hour-episode";
import { cn } from "@/lib/utils";
import { driverSegmentBtn } from "@/components/driver/driver-ui-classes";
import { driverAlertnessMustStop } from "@/lib/driver-alertness";
import {
  WORK_WINDOW_MIN,
  emptySlots,
  findWorkWindowStartMs,
  getRestSlotsForBreakRange,
  getMinutesBeforeDueFromSlots,
  getPriorRestSlotsBeforeTime,
  getAdditionalMinutesNeededForCurrentBreak,
  qualifyingRestMetForWorkAfterBreak,
  getBreakSplitBarState,
  getRemainingBreakMinutesForDisplay,
} from "@/lib/five-hour-break-rule";

const WORK_TARGET_MINUTES = WORK_WINDOW_MIN;
const BREAK_TARGET_MINUTES = 20;

/** Elapsed work/break time beside the header bar (e.g. 0h 05m). */
function formatElapsedBarDisplay(totalMinutes: number): string {
  const m = Math.floor(Math.max(0, totalMinutes));
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min.toString().padStart(2, "0")}m`;
}

type ComplianceTone = "default" | "violation" | "warning" | "pending" | "ok";
type BreakDueTone = null | "amber" | "red";

/** Compliance colours for the unified primary action (formerly the full-width header shell). */
function getComplianceChrome(
  complianceTone: ComplianceTone,
  breakDueTone: BreakDueTone
): { onColoredSurface: boolean; surfaceClass: string; textClass: string } {
  const onColoredSurface = complianceTone !== "default" || breakDueTone != null;

  const surfaceClass =
    complianceTone === "violation" || complianceTone === "warning"
      ? "bg-amber-500 dark:bg-amber-600 border-4 border-amber-950 dark:border-amber-100 shadow-lg hover:bg-amber-600 dark:hover:bg-amber-500 active:bg-amber-700"
      : breakDueTone === "red"
        ? "bg-red-600 dark:bg-red-700 border-4 border-red-950 dark:border-red-100 shadow-lg hover:bg-red-700 dark:hover:bg-red-600 active:bg-red-800"
        : breakDueTone === "amber"
          ? "bg-amber-500 dark:bg-amber-600 border-4 border-amber-950 dark:border-amber-100 shadow-lg hover:bg-amber-600 dark:hover:bg-amber-500 active:bg-amber-700"
          : complianceTone === "pending"
            ? "bg-gradient-to-r from-amber-500 via-lime-500 to-emerald-500 dark:from-amber-600 dark:via-lime-600 dark:to-emerald-600 border-4 border-emerald-950 dark:border-emerald-100 shadow-lg"
            : complianceTone === "ok"
              ? "bg-emerald-500 dark:bg-emerald-600 border-4 border-emerald-950 dark:border-emerald-100 shadow-lg hover:bg-emerald-600 dark:hover:bg-emerald-500 active:bg-emerald-700"
              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600";

  const textClass =
    complianceTone === "violation" || complianceTone === "warning"
      ? "text-amber-950 dark:text-white"
      : breakDueTone === "red"
        ? "text-white"
        : breakDueTone === "amber"
          ? "text-amber-950 dark:text-white"
          : complianceTone === "pending"
            ? "text-emerald-950 dark:text-white"
            : complianceTone === "ok"
              ? "text-emerald-950 dark:text-white"
              : "text-slate-900 dark:text-slate-100";

  return { onColoredSurface, surfaceClass, textClass };
}

const FIXED_LOG_BAR_SHELL =
  "bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 shadow-sm";

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

const MIN_BREAK_BLOCK_MINUTES = 10;
/** Minimum non-work time (hours) between shifts. */
const MIN_NON_WORK_HOURS_BETWEEN_SHIFTS = 7;
const MIN_NON_WORK_MIN_BETWEEN_SHIFTS = MIN_NON_WORK_HOURS_BETWEEN_SHIFTS * 60;
const CONFIRM_RESET_MS = 2500;
/** Scroll past this (px) to shrink the driver header; scroll back above expand threshold to restore. */
const SCROLL_COMPACT_THRESHOLD_PX = 56;
const SCROLL_EXPAND_THRESHOLD_PX = 12;

function formatDurationHoursMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

/**
 * Computes whether a warning should be shown when switching to "work" now.
 * We only warn once there's actually been ~5h of work since the last valid break (or a stop/non_work reset).
 */
function getBreakWarningIfNeeded(events: { time: string; type: string }[], nowMs: number): string | null {
  if (events.length === 0) return null;

  let workMinsSinceValidBreak = 0;
  let breakSegments: number[] = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const segStart = new Date(ev.time).getTime();
    const segEnd = i + 1 < events.length ? new Date(events[i + 1].time).getTime() : nowMs;
    const dur = Math.max(0, Math.floor((segEnd - segStart) / 60000));

    if (ev.type === "work") {
      if (breakSegments.length > 0) {
        const slice = events.slice(0, i);
        if (qualifyingRestMetForWorkAfterBreak(slice, breakSegments)) workMinsSinceValidBreak = 0;
        breakSegments = [];
      }
      workMinsSinceValidBreak += dur;
    } else if (ev.type === "break") {
      breakSegments.push(dur);
    } else {
      workMinsSinceValidBreak = 0;
      breakSegments = [];
    }
  }

  const last = events[events.length - 1];
  if (last.type !== "break") return null;
  if (workMinsSinceValidBreak < WORK_TARGET_MINUTES) return null;
  if (qualifyingRestMetForWorkAfterBreak(events, breakSegments)) return null;
  return "20 min rest per 5h work (2×10 min or 1×20 min; breaks under 10 min count as work)";
}

function getBreakDueByTime(events: { time: string; type: string }[], nowMs: number): number | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  if (last.type !== "work") return null;
  const windowStartMs = findWorkWindowStartMs(events, nowMs);
  if (windowStartMs == null) return null;
  const slots = getRestSlotsForBreakRange(events, windowStartMs, nowMs);
  const minutesBeforeDue = getMinutesBeforeDueFromSlots(slots);
  return windowStartMs + (WORK_TARGET_MINUTES - minutesBeforeDue) * 60 * 1000;
}

function getBreakCompleteByTime(events: { time: string; type: string }[]): number | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  if (last.type !== "break") return null;
  const breakStartMs = new Date(last.time).getTime();
  const windowStartMs = findWorkWindowStartMs(events, breakStartMs);
  if (windowStartMs == null) return null;
  const prior = getPriorRestSlotsBeforeTime(events, windowStartMs, breakStartMs);
  const additional = getAdditionalMinutesNeededForCurrentBreak(prior);
  return breakStartMs + additional * 60 * 1000;
}

/** Minutes until minimum rest is satisfied on the current break (for Work button countdown). */
function getBreakFinishMinutes(events: { time: string; type: string }[], nowMs: number): number | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  if (last.type !== "break") return null;

  const completeBy = getBreakCompleteByTime(events);
  if (completeBy != null) {
    return Math.max(0, Math.ceil((completeBy - nowMs) / 60000));
  }

  const breakStartMs = new Date(last.time).getTime();
  const elapsedMin = Math.max(0, (nowMs - breakStartMs) / 60000);
  const windowStartMs = findWorkWindowStartMs(events, breakStartMs);
  const prior =
    windowStartMs != null
      ? getPriorRestSlotsBeforeTime(events, windowStartMs, breakStartMs)
      : emptySlots();
  return getRemainingBreakMinutesForDisplay(prior, elapsedMin);
}

type DayData = {
  events?: { time: string; type: string }[];
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  truck_rego?: string;
  start_location?: string;
  destination?: string;
  start_kms?: number | null;
  alertness_level?: 1 | 2 | 3 | 4 | 5;
};

export default function LogBar({
  days,
  currentDayIndex,
  weekStarting,
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
  /** True when this sheet/day is "live now" (today); otherwise hide live elapsed/timers. */
  isLiveNow,
  /** Header tint + icon (right side); tap to jump to compliance panel. */
  complianceButton,
  onShiftSegmentChange,
  onSessionDimmedChange,
  mobileToolsOpen: mobileToolsOpenProp,
  onMobileToolsOpenChange,
  priorTimelineSlices,
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
  isLiveNow?: boolean;
  complianceButton?: {
    onClick: () => void;
    hasViolations: boolean;
    hasWarnings?: boolean;
    loading?: boolean;
  };
  onShiftSegmentChange?: (shiftSegmentOpen: boolean) => void;
  /** When live session UI dims sheet chrome (idle focus or active work/break at scroll top). */
  onSessionDimmedChange?: (sessionDimmed: boolean) => void;
  mobileToolsOpen?: boolean;
  onMobileToolsOpenChange?: (open: boolean) => void;
  /** Older record slices before this sheet (chronological). Rules use event timestamps only. */
  priorTimelineSlices?: TimelineSlice[];
}) {
  void weekStarting;
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
  /**
   * Voice confirm dialog already affirms the action — complete the same path as the second tap
   * (onLogEvent / end shift) instead of only arming pendingType ("Tap again to log").
   */
  const voiceFinalizeNextLogRef = useRef(false);
  const fixedHeaderRef = useRef<HTMLDivElement>(null);
  const focusScrollResetRef = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrollCompact, setScrollCompact] = useState(false);
  const [focusToolsOpen, setFocusToolsOpen] = useState(false);

  useEffect(() => {
    setVoiceAlertsEnabled(getVoiceAlertsEnabled());
  }, []);

  const day = days[currentDayIndex];
  const dayForCardFields = currentDayDisplay ?? day;
  const timelineSlices = useMemo(
    () => concatenateTimelineSlices(priorTimelineSlices ?? [], days),
    [priorTimelineSlices, days]
  );

  /** Rolling event timeline for this driver (all loaded record slices, sorted by time). */
  const eventsForDriver = useMemo(
    () =>
      getEventsForDriverInOrder(
        timelineSlices,
        driverType === "two_up" ? activeDriver : undefined
      ),
    [timelineSlices, driverType, activeDriver]
  );
  const timelineEvents = useMemo(
    () => getEventsInTimeOrder(timelineSlices),
    [timelineSlices]
  );
  const lastEvent = eventsForDriver.length ? eventsForDriver[eventsForDriver.length - 1] : undefined;
  const currentType = lastEvent && lastEvent.type !== "stop" ? lastEvent.type : null;

  const driverTimelineEvents = useMemo(
    () =>
      driverType === "two_up"
        ? timelineEvents.filter((ev) => (ev.driver ?? "primary") === activeDriver)
        : timelineEvents,
    [timelineEvents, driverType, activeDriver]
  );

  const soloEpisodeResume = driverType !== "two_up";

  const canResumeWithinSeventeenHourEpisode = useMemo(() => {
    if (!isLiveNow || !soloEpisodeResume) return false;
    return getSeventeenHourEpisodeStatus(driverTimelineEvents, Date.now())
      .canResumeWithoutSevenHourRest;
  }, [isLiveNow, soloEpisodeResume, driverTimelineEvents, tick]);
  /** Open segment for this driver: only work or break can be ended (last event stop or idle → null). */
  const shiftSegmentOpen = currentType === "work" || currentType === "break";

  const [internalMobileToolsOpen, setInternalMobileToolsOpen] = useState(false);
  const mobileToolsOpen = mobileToolsOpenProp ?? internalMobileToolsOpen;
  const setMobileToolsOpen = useCallback(
    (open: boolean) => {
      onMobileToolsOpenChange?.(open);
      if (mobileToolsOpenProp === undefined) setInternalMobileToolsOpen(open);
    },
    [onMobileToolsOpenChange, mobileToolsOpenProp]
  );

  useEffect(() => {
    onShiftSegmentChange?.(shiftSegmentOpen);
  }, [shiftSegmentOpen, onShiftSegmentChange]);

  useEffect(() => {
    if (!shiftSegmentOpen) setMobileToolsOpen(false);
  }, [shiftSegmentOpen, setMobileToolsOpen]);

  useEffect(() => {
    if (!mobileToolsOpen || !shiftSegmentOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileToolsOpen, shiftSegmentOpen]);

  useEffect(() => {
    if (!mobileToolsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileToolsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileToolsOpen, setMobileToolsOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const closeIfDesktop = () => {
      if (mq.matches) setMobileToolsOpen(false);
    };
    mq.addEventListener("change", closeIfDesktop);
    closeIfDesktop();
    return () => mq.removeEventListener("change", closeIfDesktop);
  }, [setMobileToolsOpen]);

  /** Faster tick during work/break so compliance header (e.g. pending → OK) updates within a few seconds. */
  useEffect(() => {
    if (!isLiveNow) return;
    const ms = currentType === "work" || currentType === "break" ? 2000 : 10000;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [currentType, isLiveNow]);

  const elapsedMs =
    isLiveNow && currentType && lastEvent ? Date.now() - new Date(lastEvent.time).getTime() : 0;
  const elapsedMinutes = Math.max(0, elapsedMs / 60000);
  const contextualBar = (() => {
    if (!currentType || currentType === "stop") return null;
    if (currentType === "work") {
      const target = WORK_TARGET_MINUTES;
      const pct = Math.min(100, (elapsedMinutes / target) * 100);
      const remaining = Math.max(0, target - Math.floor(elapsedMinutes));
      return { type: "work" as const, elapsed: elapsedMinutes, target, pct, remaining, color: ACTIVITY_THEME.work.hex, label: "5h" };
    }
    if (currentType === "break" && lastEvent) {
      const breakStartMs = new Date(lastEvent.time).getTime();
      const windowStartMs = findWorkWindowStartMs(eventsForDriver, breakStartMs);
      const priorSlots =
        windowStartMs != null
          ? getPriorRestSlotsBeforeTime(eventsForDriver, windowStartMs, breakStartMs)
          : emptySlots();
      const split = getBreakSplitBarState(priorSlots, elapsedMinutes);
      const remaining = getRemainingBreakMinutesForDisplay(priorSlots, elapsedMinutes);
      return {
        type: "break" as const,
        elapsed: elapsedMinutes,
        target: BREAK_TARGET_MINUTES,
        pct: split.combinedPct,
        leftPct: split.leftPct,
        rightPct: split.rightPct,
        restComplete: split.complete,
        remaining,
        color: ACTIVITY_THEME.break.hex,
        label: "2×10m / 20m",
      };
    }
    return null;
  })();

  const complianceTone = (() => {
    if (!complianceButton) return "default" as const;
    if (complianceButton.loading) return "default" as const;
    if (complianceButton.hasViolations) return "violation" as const;
    if (complianceButton.hasWarnings) return "warning" as const;
    /** Break running but 5h rest rule not yet satisfied on the split bar — between “warning” and full “OK” green. */
    if (
      currentType === "break" &&
      contextualBar?.type === "break" &&
      !contextualBar.restComplete
    ) {
      return "pending" as const;
    }
    return "ok" as const;
  })();

  const breakDueTone = useMemo(() => {
    if (!isLiveNow) return null as null | "amber" | "red";
    if (currentType !== "work") return null as null | "amber" | "red";
    const nowMs = Date.now();
    const dueBy = getBreakDueByTime(eventsForDriver, nowMs);
    if (dueBy == null) return null as null | "amber" | "red";
    const mins = Math.ceil((dueBy - nowMs) / 60000);
    if (mins <= 5) return "red";
    if (mins <= 10) return "amber";
    return null;
  }, [currentType, eventsForDriver, isLiveNow, tick]);

  const complianceChrome = getComplianceChrome(complianceTone, breakDueTone);

  const nextWorkBreak = getNextWorkBreakType(currentType) as "work" | "break";
  const primaryActionPending = pendingType === nextWorkBreak;
  const isStartingShift = nextWorkBreak === "work" && currentType === null;
  const primaryActionLabel = isStartingShift
    ? canResumeWithinSeventeenHourEpisode
      ? "Resume shift"
      : "Start shift"
    : EVENT_LABELS[nextWorkBreak];

  /** Live + idle at scroll top: full-screen focus mode (centered hero + dimmed sheet). */
  const isIdleAtTop =
    isLiveNow && currentType === null && !scrollCompact && !primaryActionPending;
  const primaryHeroExpanded = isIdleAtTop;
  /** Dim sheet + tuck chrome while live at scroll top — idle hero or active work/break. */
  const sessionDimmed =
    isLiveNow && !scrollCompact && (isIdleAtTop || shiftSegmentOpen);
  const hideSecondaryToolbar = sessionDimmed;

  /** Idle focus: strong emerald CTA instead of neutral gray on dark shell. */
  const actionChrome =
    isIdleAtTop && complianceTone === "default" && breakDueTone == null
      ? getComplianceChrome("ok", null)
      : complianceChrome;
  /** Dark inset track on the unified action when it carries compliance colour. */
  const barOnColoredHeader = actionChrome.onColoredSurface;

  useEffect(() => {
    focusScrollResetRef.current = false;
  }, [currentDayIndex, weekStarting]);

  /** Ensure focus mode is visible when opening today's live sheet (not mid-scroll). */
  useEffect(() => {
    if (!isLiveNow || currentType !== null || focusScrollResetRef.current) return;
    focusScrollResetRef.current = true;
    if (window.scrollY > 0) {
      window.scrollTo(0, 0);
    }
  }, [isLiveNow, currentType]);

  useEffect(() => {
    if (!sessionDimmed) setFocusToolsOpen(false);
  }, [sessionDimmed]);

  useEffect(() => {
    onSessionDimmedChange?.(sessionDimmed);
  }, [sessionDimmed, onSessionDimmedChange]);

  useEffect(() => {
    if (sessionDimmed) {
      document.documentElement.setAttribute("data-driver-focus", "");
    } else {
      document.documentElement.removeAttribute("data-driver-focus");
    }
    return () => document.documentElement.removeAttribute("data-driver-focus");
  }, [sessionDimmed]);

  /** Idle hero at top; compact header when driver scrolls down the sheet. */
  useEffect(() => {
    if (!isLiveNow) {
      setScrollCompact(false);
      return;
    }
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setScrollCompact((prev) => {
          if (!prev && y > SCROLL_COMPACT_THRESHOLD_PX) return true;
          if (prev && y < SCROLL_EXPAND_THRESHOLD_PX) return false;
          return prev;
        });
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [isLiveNow]);

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
        "Complete today's card before starting shift. You need rego, start location, destination, and start kilometres."
      );
      return;
    }

    if (workWarning.confirmLabel === "Go to Your Sheets") {
      const key = workWarning.message;
      if (lastSpokenShiftBlockMsgRef.current === key) return;
      lastSpokenShiftBlockMsgRef.current = key;
      speakVoiceAlert(workWarning.message);
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
    if (
      prev !== null &&
      prev < 100 &&
      contextualBar.type === "break" &&
      contextualBar.restComplete
    ) {
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

  /** Warning when starting work with <7h non-work since last shift end (rolling event time). */
  const getInsufficientNonWorkWarning = () => {
    if (currentType !== null) return null;
    return getInsufficientNonWorkMessage(
      driverTimelineEvents,
      Date.now(),
      MIN_NON_WORK_HOURS_BETWEEN_SHIFTS,
      { allowSeventeenHourEpisodeResume: soloEpisodeResume }
    );
  };

  const logBarBanner = useMemo(() => {
    if (!isLiveNow) return null;
    const nowMs = Date.now();

    if (currentType === "work") {
      const dueBy = getBreakDueByTime(eventsForDriver, nowMs);
      if (dueBy == null) return null;
      const mins = Math.ceil((dueBy - nowMs) / 60000);
      // Show only when the driver is at/near the due moment (keeps UI quiet).
      if (mins > 30) return null;
      return mins <= 0
        ? "Break is due now (20 min per 5h work)."
        : `Break due in ${mins} min (20 min per 5h work).`;
    }

    if (currentType === "break") {
      const mins = getBreakFinishMinutes(eventsForDriver, nowMs);
      if (mins == null) return null;
      if (mins <= 0) return "Minimum break complete — you may resume work when ready.";
      return `Minimum break: ${mins} min remaining.`;
    }

    return null;
  }, [currentType, eventsForDriver, isLiveNow]);

  const handleLog = (type: string) => {
    if (type === currentType) return;

    if (
      type === "stop" &&
      !shiftSegmentOpen &&
      pendingType !== "stop"
    ) {
      return;
    }

    const isStartingShift = type === "work" && currentType === null;
    if (isStartingShift) {
      const hasRego = (dayForCardFields?.truck_rego ?? "").toString().trim() !== "";
      const hasStartLocation = (dayForCardFields?.start_location ?? "").toString().trim() !== "";
      const hasDestination = (dayForCardFields?.destination ?? "").toString().trim() !== "";
      const hasStartKms = dayForCardFields?.start_kms != null && !Number.isNaN(Number(dayForCardFields.start_kms));
      if (!hasRego || !hasStartLocation || !hasDestination || !hasStartKms) {
        const missing: string[] = [];
        if (!hasRego) missing.push("Rego");
        if (!hasStartLocation) missing.push("Start location");
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
      if (driverAlertnessMustStop(dayForCardFields?.alertness_level)) {
        setWorkWarning({
          message:
            "You selected Danger (Stop) for alertness. Do not start driving — rest first, then update Set up day when you are safe.",
          confirmLabel: "Go to today's card",
          subtext: "This is not a fitness-for-work sign-off — update how you feel after resting.",
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
          confirmLabel: "Start anyway",
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
          confirmLabel: currentType === null ? "Start shift anyway" : "Log work anyway",
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
    if (voiceFinalizeNextLogRef.current) {
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
    setPendingType(type);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(clearPending, CONFIRM_RESET_MS);
  };

  /** Larger tap targets on small screens; sheet uses max size for floating panel. */
  const touchHeaderBtn =
    "h-14 w-14 min-h-[56px] min-w-[56px] md:h-11 md:w-11 md:min-h-[44px] md:min-w-[44px] rounded-xl md:rounded-lg";
  const touchHeaderIcon = "h-8 w-8 md:h-6 md:w-6";
  const touchSheetBtn = "h-16 w-16 min-h-[64px] min-w-[64px] rounded-2xl";
  const touchSheetIcon = "h-10 w-10";

  const voiceCommandProps = {
    allowStopIntent: shiftSegmentOpen || pendingType === "stop",
    voiceLabels: {
      work:
        getNextWorkBreakType(currentType) === "work" && currentType === null ? "Start shift" : "Log work",
      break: "Log break",
      stop: EVENT_LABELS.stop,
    },
    onConfirmIntent: (intent: "work" | "break" | "stop") => {
      voiceFinalizeNextLogRef.current = true;
      try {
        handleLog(intent);
      } finally {
        voiceFinalizeNextLogRef.current = false;
      }
    },
  };

  useLayoutEffect(() => {
    const el = fixedHeaderRef.current;
    if (!el) return;
    const sync = () => {
      const h = isIdleAtTop ? 0 : el.offsetHeight;
      setHeaderHeight(h);
      document.documentElement.style.setProperty("--driver-log-bar-height", `${h}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--driver-log-bar-height");
    };
  }, [
    isIdleAtTop,
    scrollCompact,
    primaryHeroExpanded,
    contextualBar,
    logBarBanner,
    forgottenActionReminder,
    shiftSegmentOpen,
    sessionDimmed,
    primaryActionPending,
    focusToolsOpen,
  ]);

  const barContent = (
    <div className={cn("space-y-2", isIdleAtTop && "space-y-4")}>
      {logBarBanner ? (
        <div
          role="status"
          className={cn(
            "px-3 py-2 text-sm",
            isIdleAtTop || (sessionDimmed && shiftSegmentOpen)
              ? "text-center text-white/80 px-0 py-0"
              : "rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200"
          )}
        >
          {logBarBanner}
        </div>
      ) : null}
      <div className="flex flex-wrap items-stretch justify-center gap-3">
        {driverType === "two_up" && (
          <span
            className={cn(
              "flex w-full justify-center items-center gap-2 text-sm sm:w-auto sm:justify-start",
              isIdleAtTop || sessionDimmed ? "text-white/75" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <span className="uppercase tracking-wider font-semibold text-xs sm:text-sm">Driver</span>
            <button
              type="button"
              className={cn(
                driverSegmentBtn,
                "rounded-lg border",
                activeDriver === "primary"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                  : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              )}
              onClick={() => setActiveDriver("primary")}
            >
              {primaryDriverName || "Driver 1"}
            </button>
            <button
              type="button"
              className={cn(
                driverSegmentBtn,
                "rounded-lg border",
                activeDriver === "second"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                  : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              )}
              onClick={() => setActiveDriver("second")}
            >
              {secondDriverName || "Driver 2"}
            </button>
          </span>
        )}
        <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3 shrink-0 min-w-0">
          <button
            type="button"
            onClick={() => handleLog(nextWorkBreak)}
            className={cn(
              "flex w-full min-w-0 flex-col gap-2 rounded-xl px-4 font-bold transition-all duration-500 ease-out active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-offset-slate-950",
              primaryHeroExpanded
                ? "mx-auto w-full max-w-md justify-center min-h-[12rem] rounded-2xl py-10 shadow-2xl shadow-emerald-500/30 ring-4 ring-emerald-400/20"
                : currentType === null
                  ? "min-h-[5rem] justify-center py-5 md:min-h-[4rem] md:py-4"
                  : scrollCompact
                    ? "py-2 sm:py-3"
                    : "py-3 sm:py-4",
              actionChrome.surfaceClass,
              actionChrome.textClass,
              primaryActionPending &&
                "ring-2 ring-white ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-950 animate-pulse"
            )}
            aria-label={primaryActionPending ? "Tap again to confirm" : primaryActionLabel}
          >
            <div
              className={cn(
                "flex w-full items-center justify-center gap-3 sm:gap-4",
                primaryHeroExpanded && "flex-col gap-2"
              )}
            >
              {React.createElement(EVENT_ICONS[nextWorkBreak], {
                className: cn(
                  "shrink-0 drop-shadow-sm",
                  primaryHeroExpanded ? "h-14 w-14" : "h-9 w-9 sm:h-8 sm:w-8"
                ),
              })}
              <span className="flex min-w-0 flex-col items-center leading-tight">
                <span
                  className={cn(
                    primaryHeroExpanded ? "text-3xl" : "text-lg sm:text-lg"
                  )}
                >
                  {primaryActionPending ? "Tap again to confirm" : primaryActionLabel}
                </span>
              </span>
            </div>
            {contextualBar ? (
              <div className="flex w-full min-w-0 items-center gap-2">
                <div
                  className={cn(
                    "relative h-9 min-h-9 sm:h-10 sm:min-h-10 flex-1 min-w-0 rounded-lg overflow-hidden",
                    barOnColoredHeader
                      ? "bg-black/60 ring-2 ring-white/40 shadow-[inset_0_2px_6px_rgba(0,0,0,0.55)] dark:bg-black/65 dark:ring-white/30"
                      : "bg-slate-100 dark:bg-slate-700"
                  )}
                >
                  <div className="absolute inset-0 rounded-lg">
                    {contextualBar.type === "work" && (
                      <>
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-lg transition-all duration-300",
                            barOnColoredHeader &&
                              "bg-lime-300 shadow-sm dark:bg-lime-400 dark:shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                          )}
                          style={{
                            width: `${contextualBar.pct}%`,
                            ...(barOnColoredHeader ? {} : { backgroundColor: contextualBar.color }),
                          }}
                        />
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={cn(
                              "absolute top-0 bottom-0 w-px",
                              barOnColoredHeader ? "bg-white/45" : "bg-white/60"
                            )}
                            style={{ left: `${(i / 5) * 100}%` }}
                            aria-hidden
                          />
                        ))}
                      </>
                    )}
                    {contextualBar.type === "break" && (
                      <>
                        <div className="absolute inset-0 flex rounded-lg overflow-hidden">
                          <div
                            className={cn(
                              "relative h-full w-1/2",
                              barOnColoredHeader ? "border-r border-white/35" : "border-r border-white/50"
                            )}
                          >
                            <div
                              className={cn(
                                "absolute inset-y-0 left-0 transition-all duration-300",
                                barOnColoredHeader &&
                                  "bg-amber-300 shadow-sm dark:bg-amber-400 dark:shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
                              )}
                              style={{
                                width: `${contextualBar.leftPct}%`,
                                ...(barOnColoredHeader ? {} : { backgroundColor: contextualBar.color }),
                              }}
                            />
                          </div>
                          <div className="relative h-full w-1/2">
                            <div
                              className={cn(
                                "absolute inset-y-0 left-0 transition-all duration-300",
                                barOnColoredHeader &&
                                  "bg-amber-300 shadow-sm dark:bg-amber-400 dark:shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
                              )}
                              style={{
                                width: `${contextualBar.rightPct}%`,
                                ...(barOnColoredHeader ? {} : { backgroundColor: contextualBar.color }),
                              }}
                            />
                          </div>
                        </div>
                        <div
                          className={cn(
                            "absolute top-0 bottom-0 left-1/2 w-px -translate-x-px z-[1]",
                            barOnColoredHeader ? "bg-white/90" : "bg-white/70"
                          )}
                          aria-hidden
                        />
                      </>
                    )}
                  </div>
                  {((contextualBar.type === "work" && contextualBar.pct < 100) ||
                    (contextualBar.type === "break" && contextualBar.pct < 100)) && (
                    <div
                      className={cn(
                        "absolute top-1/2 w-2.5 h-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full shadow-md pointer-events-none z-10",
                        barOnColoredHeader
                          ? "bg-white ring-2 ring-emerald-950/90 dark:ring-white/90"
                          : "bg-black dark:bg-white border-2 border-slate-400 dark:border-slate-300"
                      )}
                      style={{ left: `${contextualBar.pct}%` }}
                      title="Current progress"
                      aria-hidden
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "flex h-9 min-h-9 sm:h-10 sm:min-h-10 shrink-0 items-center font-mono text-[1.75rem] font-extrabold tabular-nums leading-none tracking-tight sm:text-[2rem]",
                    barOnColoredHeader
                      ? "drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
                      : "text-slate-900 dark:text-slate-100"
                  )}
                  title="Elapsed time this work / break"
                  aria-live="polite"
                >
                  {formatElapsedBarDisplay(contextualBar.elapsed)}
                </span>
              </div>
            ) : null}
          </button>
          {(shiftSegmentOpen || pendingType === "stop") &&
            (() => {
              const type = "stop";
              const isPending = pendingType === type;
              const theme = ACTIVITY_THEME[type];
              const buttonColors = isPending
                ? "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300"
                : theme.button;
              return (
                <button
                  type="button"
                  onClick={() => handleLog(type)}
                  className={`flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg text-white text-sm sm:text-base font-bold min-h-[48px] transition-all duration-150 active:scale-95 shadow-sm shrink-0 ${buttonColors} ${isPending ? "ring-2 ring-white ring-offset-2 ring-offset-slate-200 dark:ring-offset-slate-800 animate-pulse" : ""}`}
                >
                  {React.createElement(EVENT_ICONS[type], { className: "w-5 h-5" })}
                  {isPending ? "Tap again to end shift" : EVENT_LABELS[type]}
                </button>
              );
            })()}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Reserve space for fixed top bar (not used in mobile focus — button floats centered). */}
      {!isIdleAtTop && (
        <div
          aria-hidden
          className="max-w-[1400px] mx-auto w-full"
          style={{
            height: headerHeight > 0 ? headerHeight : undefined,
            minHeight: headerHeight > 0 ? undefined : "10rem",
          }}
        />
      )}
      {sessionDimmed && (
        <div
          className="fixed inset-0 z-40 bg-black/65 pointer-events-none transition-opacity duration-500"
          aria-hidden
        />
      )}
      <div
        ref={fixedHeaderRef}
        className={cn(
          "fixed z-50 px-4 transition-all duration-500 ease-out",
          isIdleAtTop
            ? "inset-0 flex flex-col items-center justify-center px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-transparent border-0 shadow-none backdrop-blur-none"
            : sessionDimmed
              ? cn(
                  "top-0 left-0 right-0 pt-[max(0.75rem,env(safe-area-inset-top))]",
                  scrollCompact ? "py-2" : "py-3",
                  "bg-transparent border-0 shadow-none backdrop-blur-none"
                )
              : cn(
                  "top-0 left-0 right-0 pt-[max(0.75rem,env(safe-area-inset-top))]",
                  scrollCompact ? "py-2" : "py-3",
                  FIXED_LOG_BAR_SHELL
                )
        )}
      >
        {hideSecondaryToolbar && (
          <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-10">
            <button
              type="button"
              onClick={() => {
                setFocusToolsOpen(true);
                setMobileToolsOpen(true);
              }}
              className="relative flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white/75 hover:text-white hover:bg-white/10 active:scale-95 transition-colors"
              aria-label="More options"
              aria-expanded={focusToolsOpen}
              aria-controls="driver-focus-tools-sheet"
            >
              <MoreVertical className="h-7 w-7" aria-hidden />
              {(complianceButton?.hasViolations || complianceButton?.hasWarnings) && (
                <span
                  className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-black/40"
                  aria-hidden
                />
              )}
            </button>
          </div>
        )}
        <div
          className={cn(
            "mx-auto w-full",
            isIdleAtTop
              ? "max-w-md w-full flex flex-col justify-center"
              : "max-w-[1400px] flex flex-col gap-2 md:flex-row md:items-start md:gap-3"
          )}
        >
          <div className={cn("flex-1 min-w-0 w-full", isIdleAtTop && "flex flex-col justify-center")}>
            {barContent}
          </div>
          <div
            className={cn(
              "flex w-full shrink-0 items-center justify-end gap-2 border-t border-black/10 pt-2 md:w-auto md:self-center md:border-t-0 md:pt-0 md:justify-start",
              hideSecondaryToolbar && "hidden"
            )}
          >
            {complianceButton && !hideSecondaryToolbar && (
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
            {shiftSegmentOpen && !hideSecondaryToolbar && (
              <button
                type="button"
                className="md:hidden shrink-0 flex items-center gap-2 min-h-[48px] px-3 py-2 rounded-xl font-semibold text-sm bg-black/25 dark:bg-black/30 border border-white/35 text-slate-900 dark:text-white shadow-sm active:scale-[0.98] transition-transform"
                onClick={() => setMobileToolsOpen(true)}
                aria-expanded={mobileToolsOpen}
                aria-controls="mobile-log-tools-sheet"
              >
                <SlidersHorizontal className="h-6 w-6 shrink-0" aria-hidden />
                <span className="max-w-[10rem] leading-tight text-left">Voice &amp; display</span>
              </button>
            )}
            {!hideSecondaryToolbar && (!shiftSegmentOpen || !mobileToolsOpen) ? (
              <div
                className={cn(
                  "shrink-0 items-center gap-1",
                  shiftSegmentOpen ? "hidden md:flex" : "flex"
                )}
              >
                <VoiceCommandControl
                  {...voiceCommandProps}
                  buttonClassName={touchHeaderBtn}
                  iconClassName={touchHeaderIcon}
                />
                <VoiceAlertsToggle
                  enabled={voiceAlertsEnabled}
                  onChange={setVoiceAlertsEnabled}
                  buttonClassName={touchHeaderBtn}
                  iconClassName={touchHeaderIcon}
                />
                <ThemeToggle className={touchHeaderBtn} iconClassName={touchHeaderIcon} />
              </div>
            ) : null}
          </div>
        </div>
        {shiftSegmentOpen && mobileToolsOpen && !hideSecondaryToolbar && (
          <div
            className="fixed inset-0 z-[45] md:hidden"
            role="dialog"
            aria-modal
            aria-labelledby="mobile-log-tools-title"
            id="mobile-log-tools-sheet"
          >
            <button
              type="button"
              className="absolute inset-0 w-full h-full cursor-default border-0 bg-black/50 p-0"
              aria-label="Dismiss voice and display tools"
              onClick={() => setMobileToolsOpen(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pointer-events-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div
                className="pointer-events-auto w-full max-w-md rounded-2xl border-2 border-emerald-600/70 dark:border-emerald-400/60 bg-white dark:bg-slate-900 shadow-2xl p-4 space-y-4"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="mobile-log-tools-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Voice &amp; display
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Tap outside this panel to close. Voice confirm dialogs appear on top.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    onClick={() => setMobileToolsOpen(false)}
                    aria-label="Close"
                  >
                    <X className="h-7 w-7" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-5 pt-1">
                  <VoiceCommandControl
                    {...voiceCommandProps}
                    buttonClassName={touchSheetBtn}
                    iconClassName={touchSheetIcon}
                  />
                  <VoiceAlertsToggle
                    enabled={voiceAlertsEnabled}
                    onChange={setVoiceAlertsEnabled}
                    buttonClassName={touchSheetBtn}
                    iconClassName={touchSheetIcon}
                  />
                  <ThemeToggle className={touchSheetBtn} iconClassName={touchSheetIcon} />
                </div>
              </div>
            </div>
          </div>
        )}
        {sessionDimmed && (focusToolsOpen || mobileToolsOpen) && (
          <div
            className="fixed inset-0 z-[55]"
            role="dialog"
            aria-modal
            aria-labelledby="driver-focus-tools-title"
            id="driver-focus-tools-sheet"
          >
            <button
              type="button"
              className="absolute inset-0 w-full h-full cursor-default border-0 bg-black/50 p-0"
              aria-label="Dismiss options"
              onClick={() => {
                setFocusToolsOpen(false);
                setMobileToolsOpen(false);
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pointer-events-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div
                className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl p-4 space-y-4 backdrop-blur-md"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="driver-focus-tools-title" className="text-lg font-bold text-white">
                      Options
                    </h2>
                    <p className="text-xs text-white/60 mt-1">Compliance, voice, and display</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl p-2 hover:bg-white/10 text-white/80"
                    onClick={() => {
                      setFocusToolsOpen(false);
                      setMobileToolsOpen(false);
                    }}
                    aria-label="Close"
                  >
                    <X className="h-7 w-7" />
                  </button>
                </div>
                {complianceButton && (
                  <button
                    type="button"
                    onClick={() => {
                      setFocusToolsOpen(false);
                      setMobileToolsOpen(false);
                      complianceButton.onClick();
                    }}
                    disabled={complianceButton.loading}
                    className="flex w-full items-center gap-3 min-h-[52px] rounded-xl px-4 bg-white/10 hover:bg-white/15 text-white font-semibold disabled:opacity-60"
                  >
                    {complianceButton.loading ? (
                      <Loader2 className="w-6 h-6 animate-spin shrink-0" aria-hidden />
                    ) : complianceButton.hasViolations ? (
                      <X className="w-6 h-6 shrink-0 text-amber-300" strokeWidth={3} aria-hidden />
                    ) : complianceButton.hasWarnings ? (
                      <AlertTriangle className="w-6 h-6 shrink-0 text-amber-300" strokeWidth={2.5} aria-hidden />
                    ) : (
                      <ClipboardList className="w-6 h-6 shrink-0 text-emerald-300" strokeWidth={2} aria-hidden />
                    )}
                    <span className="flex-1 text-left">
                      {complianceButton.loading
                        ? "Checking compliance…"
                        : complianceButton.hasViolations
                          ? "Compliance — issues"
                          : complianceButton.hasWarnings
                            ? "Compliance — warnings"
                            : "Compliance — all clear"}
                    </span>
                  </button>
                )}
                <div className="flex flex-wrap items-center justify-center gap-5 pt-1">
                  <VoiceCommandControl
                    {...voiceCommandProps}
                    buttonClassName={touchSheetBtn}
                    iconClassName={touchSheetIcon}
                  />
                  <VoiceAlertsToggle
                    enabled={voiceAlertsEnabled}
                    onChange={setVoiceAlertsEnabled}
                    buttonClassName={touchSheetBtn}
                    iconClassName={touchSheetIcon}
                  />
                  <ThemeToggle className={touchSheetBtn} iconClassName={touchSheetIcon} />
                </div>
              </div>
            </div>
          </div>
        )}
        {forgottenActionReminder && (
          <div
            role="alert"
            className={cn(
              "rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100",
              sessionDimmed
                ? "mx-auto mt-4 max-w-md w-full border-amber-400/40 bg-amber-950/80 text-amber-100"
                : "max-w-[1400px] mx-auto mt-2"
            )}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden />
              <p className="flex-1 font-medium min-w-0">{forgottenActionReminder.message}</p>
            </div>
            {forgottenActionReminder.variant === "break-due" && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onLogEvent(currentDayIndex, "break", driverType === "two_up" ? activeDriver : undefined)}
                  className="h-11 w-full rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <Coffee className="w-4 h-4" />
                  Start break now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sessionDimmed) {
                      setFocusToolsOpen(true);
                      setMobileToolsOpen(true);
                    } else {
                      setMobileToolsOpen(true);
                    }
                  }}
                  className="h-11 w-full rounded-lg bg-white/80 dark:bg-slate-900/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 font-semibold"
                >
                  Show tools
                </button>
              </div>
            )}
            {(forgottenActionReminder.variant === "break-complete" || forgottenActionReminder.variant === "break-long") && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onLogEvent(currentDayIndex, "work", driverType === "two_up" ? activeDriver : undefined)}
                  className="h-11 w-full rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <Briefcase className="w-4 h-4" />
                  Resume work
                </button>
                {onEndShiftRequest && (
                  <button
                    type="button"
                    onClick={() => onEndShiftRequest(currentDayIndex)}
                    className="h-11 w-full rounded-lg bg-white/80 dark:bg-slate-900/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 font-semibold flex items-center justify-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    End shift
                  </button>
                )}
              </div>
            )}
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
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    workWarning.onCancel?.();
                    setWorkWarning(null);
                  }}
                  className="min-h-[48px] px-4 py-3 rounded-xl text-base font-semibold bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500"
                >
                  {workWarning.confirmLabel === "Start anyway" ? "Keep resting" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => workWarning.onConfirm()}
                  className="min-h-[48px] px-4 py-3 rounded-xl text-base font-semibold bg-amber-500 hover:bg-amber-600 text-white"
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
