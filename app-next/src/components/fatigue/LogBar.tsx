"use client";

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  Coffee,
  Moon,
  Square,
  ClipboardList,
  X,
  Loader2,
  AlertTriangle,
  Settings,
  CircleX,
  ChevronDown,
  ChevronUp,
  UserRound,
  Pause,
  Wrench,
} from "lucide-react";
import { type ActivityKey } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { VoiceAlertsToggle } from "@/components/VoiceAlertsToggle";
import { VoiceCommandControl } from "@/components/VoiceCommandControl";
import { getVoiceAlertsEnabled, speakVoiceAlert } from "@/lib/voice-alerts";
import {
  concatenateTimelineSlices,
  getInsufficientNonWorkMessage,
  getInsufficientTwoUp24hNonWorkMessage,
  getSheetOwnerEventsInOrder,
  getShiftRestStatusFromTimeline,
  getTwoUpRolling24hRestStatus,
  type TimelineSlice,
} from "@/lib/rolling-events";
import { getSeventeenHourEpisodeStatus } from "@/lib/seventeen-hour-episode";
import { cn } from "@/lib/utils";
import {
  getShiftStartSetupMissing,
  workLogRequiresShiftStartSetup,
} from "@/lib/shift-start-gate";
import {
  computeWorkPeriodAtEnd,
  WORK_WINDOW_MIN,
  emptySlots,
  findWorkWindowStartMs,
  getBreakSplitBarState,
  getPriorRestSlotsBeforeTime,
  getRemainingBreakMinutesForDisplay,
} from "@/lib/five-hour-break-rule";
import { resolveIdlePrimaryLogAction, resolveTwoUpIdlePrimaryLogAction } from "@/lib/primary-log-action";
import { DRIVER_CONTINUE_SHIFT_LABEL, DRIVER_START_SHIFT_LABEL, DRIVER_STOP_DRIVING_LABEL, DRIVER_START_REST_LABEL, DRIVER_START_OTHER_WORK_LABEL, DRIVER_START_DRIVING_LABEL, DRIVER_END_SHIFT_LABEL } from "@/lib/product-copy";
import { isOpenShiftEventType, OTHER_WORK_EVENT_TYPE } from "@/lib/activity-kind";
import { getEndShiftButtonChrome } from "@/lib/driver-compliance-chrome";
import { DriverActionHero } from "@/components/fatigue/DriverActionHero";
import { UpcomingComplianceChip } from "@/components/fatigue/UpcomingComplianceChip";
import type { ComplianceCheckResult } from "@/lib/compliance";
import type { Rolling168hMetrics } from "@/lib/rolling-168h-metrics";
import {
  resolveUpcomingComplianceChip,
  shouldShowUpcomingComplianceChip,
} from "@/lib/upcoming-compliance-chip";
import {
  complianceIssueInputsFromMessages,
  isComplianceFixActionable,
  resolvePrimaryComplianceFixRoute,
  type ComplianceFixRoute,
} from "@/lib/compliance-fix-routes";
import { SETUP_WEEK_RECORD_BUTTON_LABEL } from "@/lib/declared-24h-rests";
import {
  endShiftButtonSizeClass,
  endShiftIconSizeClass,
  endShiftTrimPaddingClass,
  endShiftConfirmLabelSizeClass,
} from "@/lib/driver-action-sizes";
import {
  DRIVER_LOG_CONFIRM_WINDOW_MS,
  isDriverLogConfirmMatch,
  type DriverLogConfirmArm,
} from "@/lib/driver-log-confirm";
import { getGeoMovementState, subscribeGeoMovement } from "@/lib/geo-history-1m";
import {
  requestDriverImmersive,
  syncDriverImmersiveClass,
} from "@/lib/driver-fullscreen";
import {
  driverAmberBtn,
  driverMutedBtn,
  driverSheetUtilityBtn,
  driverTouchIconBtn,
} from "@/components/driver/driver-ui-classes";

/** Elapsed work/break time beside the header bar (e.g. 0h 05m). */
function formatElapsedBarDisplay(totalMinutes: number): string {
  const m = Math.floor(Math.max(0, totalMinutes));
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min.toString().padStart(2, "0")}m`;
}

const FIXED_LOG_BAR_SHELL =
  "bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 shadow-sm";

const EVENT_ICONS: Record<ActivityKey, React.ComponentType<{ className?: string }>> = {
  work: Briefcase,
  break: Coffee,
  other_work: Wrench,
  non_work: Moon,
  stop: Square,
};
const EVENT_LABELS: Record<ActivityKey, string> = {
  work: DRIVER_CONTINUE_SHIFT_LABEL,
  break: DRIVER_START_REST_LABEL,
  other_work: DRIVER_START_OTHER_WORK_LABEL,
  non_work: "Non-Work Time",
  stop: DRIVER_END_SHIFT_LABEL,
};

const MIN_NON_WORK_HOURS_BETWEEN_SHIFTS = 7;
const MIN_NON_WORK_MIN_BETWEEN_SHIFTS = MIN_NON_WORK_HOURS_BETWEEN_SHIFTS * 60;
/** Scroll past this (px) to shrink the driver header; scroll back above expand threshold to restore. */
const SCROLL_COMPACT_THRESHOLD_PX = 56;
const SCROLL_EXPAND_THRESHOLD_PX = 12;

function formatDurationHoursMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
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
};

export default function LogBar({
  days,
  currentDayIndex,
  weekStarting,
  onLogEvent,
  onEndShiftRequest,
  workRelevantComplianceMessages,
  complianceCheckResults = [],
  prospectiveRouteHint = null,
  rolling168hMetrics = null,
  onStartShiftBlocked,
  finalizeStartWorkRequest = null,
  heroExpandRequest = 0,
  currentDayDisplay,
  driverType,
  reliefDriverName,
  driverName,
  forgottenActionReminder,
  /** True when this sheet/day is "live now" (today); otherwise hide live elapsed/timers. */
  isLiveNow,
  /** Header tint + icon (right side); tap to jump to compliance panel. */
  complianceButton,
  onShiftSegmentChange,
  onSessionDimmedChange,
  priorTimelineSlices,
  /** Enterprise addon — movement lock + segment GPS trail. */
  gpsMovementTrailEnabled = false,
}: {
  days: DayData[];
  currentDayIndex: number;
  weekStarting: string;
  /** Log a new event on this driver's sheet. */
  onLogEvent: (dayIndex: number, type: string) => void;
  /** When provided, End shift opens the correction dialog (end time + end km). */
  onEndShiftRequest?: (dayIndex: number) => void;
  /** Prospective compliance messages (non-work time, limits) if work were logged now. When set, shown when user taps Work. */
  workRelevantComplianceMessages?: string[];
  /** Full compliance check output for the upcoming-issues chip (live sheet). */
  complianceCheckResults?: ComplianceCheckResult[];
  /** Future run-plan risk summary for the chip (from risk register). */
  prospectiveRouteHint?: string | null;
  /** Rolling 14-day / 168h headroom for the chip. */
  rolling168hMetrics?: Rolling168hMetrics | null;
  /** When Start shift is blocked, parent scrolls to the target day card and may open Set up day. */
  onStartShiftBlocked?: (opts?: {
    openSetup?: boolean;
    dayIndex?: number;
    /** Hero Start/Resume was the event — after Set up day Confirm, finalize work on the timeline. */
    startWorkAfterSetup?: boolean;
    episodeResume?: boolean;
  }) => void;
  /**
   * Parent bumps `id` after Set up day Confirm when start-work-after-setup was pending.
   * LogBar then logs work (or shows the non-work warning) without another hero tap.
   */
  finalizeStartWorkRequest?: { id: number; episodeResume: boolean } | null;
  /** Bump to clear compact hero when parent knows setup finished at scroll top. */
  heroExpandRequest?: number;
  /** When provided, used for Start shift gate (rego/destination/start KM) so carried-over values count. */
  currentDayDisplay?: DayData;
  /** Solo or two_up — selects rule set (184E(2) vs 184E(3)). */
  driverType?: string;
  /** Relief driver name when two_up (metadata only — not logged on this sheet). */
  reliefDriverName?: string;
  /** Primary driver display name — shown so the live sheet is clearly theirs (and for manager cross-check). */
  driverName?: string | null;
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
  /** Older record slices before this sheet (chronological). Rules use event timestamps only. */
  priorTimelineSlices?: TimelineSlice[];
  gpsMovementTrailEnabled?: boolean;
}) {
  void weekStarting;
  const [pendingType, setPendingType] = useState<string | null>(null);
  /** Work → Stop Driving chooser (not a logged event). */
  const [stopDrivingChooserOpen, setStopDrivingChooserOpen] = useState(false);
  /** Idle → Start shift chooser: Start driving / Start Other Work (not a logged event). */
  const [startShiftChooserOpen, setStartShiftChooserOpen] = useState(false);
  /** When both Start shift and Resume shift are offered, tracks which work path is confirming. */
  const [workLogEpisodeResume, setWorkLogEpisodeResume] = useState(false);
  /** Sync mirror of pending arm — rapid second tap must see this before React re-renders. */
  const pendingArmRef = useRef<DriverLogConfirmArm | null>(null);
  const [workWarning, setWorkWarning] = useState<{
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel?: () => void;
    subtext?: string;
    setupRecordLabel?: string;
    onSetupRecord?: () => void;
  } | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0);
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(false);
  const lastSpokenShiftBlockMsgRef = useRef<string | null>(null);
  /**
   * Voice confirm dialog already affirms the action — complete the same path as the second tap
   * (onLogEvent / end shift) instead of only arming pendingType ("Tap again to log").
   */
  const voiceFinalizeNextLogRef = useRef(false);
  const fixedHeaderRef = useRef<HTMLDivElement>(null);
  const fixedEndShiftRef = useRef<HTMLDivElement>(null);
  const focusScrollResetRef = useRef(false);
  const prevShiftSegmentOpenRef = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrollCompact, setScrollCompact] = useState(false);
  /** Driver chose to view the sheet — keep compact top bar even at scroll top. */
  const [sheetViewMode, setSheetViewMode] = useState(false);
  const [sessionToolsMounted, setSessionToolsMounted] = useState(false);
  /** Options sheet — opened via gear on focus or compact hero (never from day card or parent state). */
  const [sessionToolsOpen, setSessionToolsOpen] = useState(false);
  const wasSessionDimmedRef = useRef(false);

  useEffect(() => {
    setVoiceAlertsEnabled(getVoiceAlertsEnabled());
  }, []);

  const day = days[currentDayIndex];
  const dayForCardFields = currentDayDisplay ?? day;
  const timelineSlices = useMemo(
    () => concatenateTimelineSlices(priorTimelineSlices ?? [], days),
    [priorTimelineSlices, days]
  );

  /** This driver's attested timeline (excludes legacy second-driver rows on shared sheets). */
  const eventsForDriver = useMemo(
    () => getSheetOwnerEventsInOrder(timelineSlices),
    [timelineSlices]
  );
  const lastEvent = eventsForDriver.length ? eventsForDriver[eventsForDriver.length - 1] : undefined;
  const currentType = lastEvent && lastEvent.type !== "stop" ? lastEvent.type : null;

  const isTwoUp = driverType === "two_up";

  const soloEpisodeResume = !isTwoUp;

  const canResumeWithinSeventeenHourEpisode = useMemo(() => {
    if (!isLiveNow || !soloEpisodeResume) return false;
    return getSeventeenHourEpisodeStatus(eventsForDriver, Date.now())
      .canResumeWithoutSevenHourRest;
  }, [isLiveNow, soloEpisodeResume, eventsForDriver, tick]);
  /** Open segment for this driver: Work, Rest, or Other work can be ended. */
  const shiftSegmentOpen = isOpenShiftEventType(currentType);

  useEffect(() => {
    if (currentType !== "work") setStopDrivingChooserOpen(false);
    if (currentType != null) setStartShiftChooserOpen(false);
  }, [currentType]);

  const openSessionTools = useCallback(() => {
    setSessionToolsOpen(true);
  }, []);

  const closeSessionTools = useCallback(() => {
    setSessionToolsOpen(false);
  }, []);

  useEffect(() => {
    onShiftSegmentChange?.(shiftSegmentOpen);
  }, [shiftSegmentOpen, onShiftSegmentChange]);

  /** Faster tick during work/break so compliance header (e.g. pending → OK) updates within a few seconds. */
  useEffect(() => {
    if (!isLiveNow) return;
    const ms = isOpenShiftEventType(currentType) ? 2000 : 10000;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [currentType, isLiveNow]);

  /** Same GPS watch as segment trail — locks Work/Break (and End shift) while moving. */
  const [gpsMoving, setGpsMoving] = useState(false);
  const [gpsUnlockProgress, setGpsUnlockProgress] = useState(1);
  useEffect(() => {
    if (!isLiveNow || !gpsMovementTrailEnabled) {
      setGpsMoving(false);
      setGpsUnlockProgress(1);
      return;
    }
    return subscribeGeoMovement((state) => {
      setGpsMoving(state.isMoving);
      setGpsUnlockProgress(state.unlockProgress01);
    });
  }, [isLiveNow, gpsMovementTrailEnabled]);
  useEffect(() => {
    if (!isLiveNow || !gpsMovementTrailEnabled) return;
    const state = getGeoMovementState();
    setGpsMoving(state.isMoving);
    setGpsUnlockProgress(state.unlockProgress01);
  }, [isLiveNow, gpsMovementTrailEnabled, tick]);
  const isMoving = gpsMovementTrailEnabled && gpsMoving;
  // Never clear an armed confirm when GPS flips to "moving" — that ate second taps.

  const elapsedMs =
    isLiveNow && currentType && lastEvent ? Date.now() - new Date(lastEvent.time).getTime() : 0;
  const elapsedMinutes = Math.max(0, elapsedMs / 60000);
  const showSessionTimer = Boolean(isLiveNow && shiftSegmentOpen && lastEvent);

  const workPeriod =
    currentType === "work" ? computeWorkPeriodAtEnd(eventsForDriver, Date.now()) : null;
  const workMinutesUsed = workPeriod?.workMins ?? 0;

  const twoUpRolling24hRest = useMemo(() => {
    if (!isLiveNow || currentType !== null || !isTwoUp) return null;
    return getTwoUpRolling24hRestStatus(eventsForDriver, Date.now());
  }, [isLiveNow, currentType, isTwoUp, eventsForDriver, tick]);

  const shiftRest =
    isLiveNow && currentType === null && !isTwoUp
      ? getShiftRestStatusFromTimeline(eventsForDriver, Date.now(), {
          allowSeventeenHourEpisodeResume: soloEpisodeResume,
        })
      : null;

  const idlePrimary =
    currentType === null
      ? isTwoUp
        ? twoUpRolling24hRest
          ? resolveTwoUpIdlePrimaryLogAction(twoUpRolling24hRest)
          : null
        : shiftRest
          ? resolveIdlePrimaryLogAction({
              restRunMinutes: shiftRest.consecutiveNonWorkMinutes,
              minRestMinutes: MIN_NON_WORK_MIN_BETWEEN_SHIFTS,
            })
          : null
      : null;

  const idleRestBlocked = idlePrimary?.type === "non_work";
  const idleRestRemainingMinutes =
    idleRestBlocked && isTwoUp && twoUpRolling24hRest
      ? twoUpRolling24hRest.nonWorkMinutesShortfall
      : idleRestBlocked && shiftRest
        ? Math.max(0, MIN_NON_WORK_MIN_BETWEEN_SHIFTS - shiftRest.consecutiveNonWorkMinutes)
        : null;

  const breakRestStatus = useMemo(() => {
    if (!isLiveNow || (currentType !== "break" && currentType !== OTHER_WORK_EVENT_TYPE) || !lastEvent) return null;
      const breakStartMs = new Date(lastEvent.time).getTime();
      const windowStartMs = findWorkWindowStartMs(eventsForDriver, breakStartMs);
      const priorSlots =
        windowStartMs != null
          ? getPriorRestSlotsBeforeTime(eventsForDriver, windowStartMs, breakStartMs)
          : emptySlots();
      const split = getBreakSplitBarState(priorSlots, elapsedMinutes);
      const remaining = getRemainingBreakMinutesForDisplay(priorSlots, elapsedMinutes);
    const banked = Math.max(0, 20 - remaining);
      return {
      incomplete: !split.complete,
      bankedMinutes: banked,
      progressLabel: split.complete ? null : `Rest ${banked}/20 min`,
    };
  }, [isLiveNow, currentType, lastEvent, eventsForDriver, elapsedMinutes]);

  const needsShiftStartSetup = workLogRequiresShiftStartSetup(eventsForDriver);
  const primaryLogType = (idlePrimary?.type ?? "work") as "work" | "break" | "non_work";
  const isStartingShift = primaryLogType === "work" && currentType === null;
  /** Idle after End shift inside an active 17h episode — same Start shift hero (episode resume path). */
  const showResumeShiftPrimary =
    isLiveNow &&
    currentType === null &&
    isStartingShift &&
    canResumeWithinSeventeenHourEpisode &&
    !idleRestBlocked;
  const primaryActionLabel = idlePrimary
    ? idlePrimary.label
    : currentType === "work"
      ? DRIVER_STOP_DRIVING_LABEL
      : currentType === "break" || currentType === OTHER_WORK_EVENT_TYPE
        ? DRIVER_CONTINUE_SHIFT_LABEL
        : showResumeShiftPrimary || isStartingShift
          ? DRIVER_START_SHIFT_LABEL
          : DRIVER_CONTINUE_SHIFT_LABEL;
  const primaryActionPending =
    currentType !== "work" &&
    pendingType === primaryLogType &&
    (showResumeShiftPrimary ? workLogEpisodeResume : !workLogEpisodeResume);

  const primaryActionIcon =
    idleRestBlocked
      ? CircleX
      : currentType === "work"
        ? Pause
        : primaryLogType === "non_work"
          ? EVENT_ICONS.non_work
          : EVENT_ICONS.work;

  const upcomingComplianceChip = useMemo(
    () =>
      resolveUpcomingComplianceChip({
        prospectiveWorkWarnings: (workRelevantComplianceMessages ?? []).filter(
          (m) => !prospectiveRouteHint || m !== prospectiveRouteHint
        ),
        prospectiveRouteHint,
        complianceResults: complianceCheckResults,
        rolling168h: rolling168hMetrics,
        idleRestBlocked,
        idleRestRemainingMinutes,
        onWorkSegment: currentType === "work",
      }),
    [
      workRelevantComplianceMessages,
      prospectiveRouteHint,
      complianceCheckResults,
      rolling168hMetrics,
      idleRestBlocked,
      idleRestRemainingMinutes,
      currentType,
    ]
  );

  const showUpcomingComplianceChip = shouldShowUpcomingComplianceChip({
    isLiveNow: Boolean(isLiveNow),
    shiftIdle: currentType === null,
    chip: upcomingComplianceChip,
  });

  const primaryFixRoute = useMemo(
    () =>
      resolvePrimaryComplianceFixRoute([
        ...complianceCheckResults
          .filter((r) => r.type === "violation" || r.type === "warning")
          .map((r) => ({
            message: r.message,
            type: r.type,
            scrollDayIndex: r.scrollDayIndex,
            ruleId: r.ruleId,
            day: r.day,
            currentDayIndex,
          })),
        ...complianceIssueInputsFromMessages(workRelevantComplianceMessages ?? [], "warning", currentDayIndex),
      ]),
    [complianceCheckResults, workRelevantComplianceMessages, currentDayIndex]
  );

  const applyComplianceFix = useCallback(
    (route: ComplianceFixRoute) => {
      if (!isComplianceFixActionable(route)) {
        complianceButton?.onClick();
        return;
      }
      setSheetViewMode(true);
      closeSessionTools();
      window.setTimeout(() => {
        if (route.kind === "setup_week_record") {
          onStartShiftBlocked?.({ openSetup: true, dayIndex: currentDayIndex });
          return;
        }
        if (route.kind === "edit_day") {
          onStartShiftBlocked?.({ dayIndex: route.scrollDayIndex ?? currentDayIndex });
        }
      }, 0);
    },
    [closeSessionTools, complianceButton, currentDayIndex, onStartShiftBlocked]
  );

  const revealTodayCard = useCallback(() => {
    applyComplianceFix({
      kind: "setup_week_record",
      driverLabel: SETUP_WEEK_RECORD_BUTTON_LABEL,
      managerLabel: SETUP_WEEK_RECORD_BUTTON_LABEL,
    });
  }, [applyComplianceFix]);

  /** Live + idle at scroll top: full-screen focus mode (centered hero + dimmed sheet). */
  const isIdleAtTop =
    isLiveNow && currentType === null && !scrollCompact && !sheetViewMode;
  /** Centered hero at scroll top while on work/break; scroll down compacts into the top bar. */
  const onLiveShiftAtTop =
    isLiveNow && shiftSegmentOpen && !scrollCompact && !sheetViewMode;
  const sessionDimmed = Boolean(isIdleAtTop || onLiveShiftAtTop);
  const primaryHeroExpanded = sessionDimmed;
  const hideSecondaryToolbar = sessionDimmed;

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
    if (wasSessionDimmedRef.current && !sessionDimmed) closeSessionTools();
    wasSessionDimmedRef.current = sessionDimmed;
  }, [sessionDimmed, closeSessionTools]);

  useEffect(() => {
    if (!sessionToolsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sessionToolsOpen]);

  useEffect(() => {
    if (!sessionToolsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSessionTools();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessionToolsOpen, closeSessionTools]);

  useEffect(() => {
    setSessionToolsMounted(true);
  }, []);

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
          if (prev && y < SCROLL_EXPAND_THRESHOLD_PX && !sheetViewMode) return false;
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
  }, [isLiveNow, sheetViewMode]);

  const restoreFocusHero = useCallback(() => {
    setSheetViewMode(false);
    if (window.scrollY < SCROLL_EXPAND_THRESHOLD_PX) {
      setScrollCompact(false);
    }
  }, []);

  /** Exit focus overlay so the driver can read or edit day cards (time bar, setup, other days). */
  const viewDiary = useCallback(() => {
    setSheetViewMode(true);
    closeSessionTools();
  }, [closeSessionTools]);

  /** After end shift at scroll top, restore focus hero (not icon-only compact). */
  useEffect(() => {
    const wasOpen = prevShiftSegmentOpenRef.current;
    prevShiftSegmentOpenRef.current = shiftSegmentOpen;
    if (!isLiveNow || !wasOpen || shiftSegmentOpen) return;
    if (window.scrollY < SCROLL_EXPAND_THRESHOLD_PX) {
      setSheetViewMode(false);
      setScrollCompact(false);
    }
  }, [shiftSegmentOpen, isLiveNow]);

  useEffect(() => {
    if (!heroExpandRequest || !isLiveNow) return;
    if (window.scrollY < SCROLL_EXPAND_THRESHOLD_PX) {
      setSheetViewMode(false);
      setScrollCompact(false);
    }
  }, [heroExpandRequest, isLiveNow]);

  const clearPending = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    pendingArmRef.current = null;
    setPendingType(null);
    setWorkLogEpisodeResume(false);
  }, []);

  const armPending = useCallback((type: string, episodeResume: boolean) => {
    pendingArmRef.current = { type, episodeResume };
    setWorkLogEpisodeResume(episodeResume);
    setPendingType(type);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(clearPending, DRIVER_LOG_CONFIRM_WINDOW_MS);
  }, [clearPending]);

  useEffect(() => {
    clearPending();
    setWorkWarning(null);
  }, [currentDayIndex, clearPending]);

  /** Phase 1 voice: work-warning modals (card incomplete, etc.). */
  useEffect(() => {
    if (!workWarning) {
      lastSpokenShiftBlockMsgRef.current = null;
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
    }
  }, [workWarning, voiceAlertsEnabled]);

  /** Warning when starting work with <7h non-work since last shift end (rolling event time). */
  const getInsufficientNonWorkWarning = (allowSeventeenHourEpisodeResume: boolean) => {
    if (currentType !== null) return null;
    if (isTwoUp) {
      return getInsufficientTwoUp24hNonWorkMessage(eventsForDriver, Date.now());
    }
    return getInsufficientNonWorkMessage(
      eventsForDriver,
      Date.now(),
      MIN_NON_WORK_HOURS_BETWEEN_SHIFTS,
      {
        allowSeventeenHourEpisodeResume:
          allowSeventeenHourEpisodeResume && soloEpisodeResume,
      }
    );
  };

  const logBarBanner = null;

  const showShiftStartSetupBlock = useCallback(
    (type: string, options?: { episodeResume?: boolean; deferToSetup?: boolean }): boolean => {
      if (type !== "work" && type !== OTHER_WORK_EVENT_TYPE) return false;
      if (!workLogRequiresShiftStartSetup(eventsForDriver)) return false;

      const missing = getShiftStartSetupMissing(dayForCardFields ?? {});
      if (missing.length === 0) return false;

      // Hero Start shift — open Set up day; chooser after Confirm.
      if (options?.deferToSetup !== false) {
        onStartShiftBlocked?.({
          openSetup: true,
          dayIndex: currentDayIndex,
          startWorkAfterSetup: true,
          episodeResume: options?.episodeResume === true,
        });
        return true;
      }

        setWorkWarning({
        message: `Please complete shift setup before starting work: ${missing.join(", ")}.`,
          confirmLabel: "Go to today's card",
        subtext: "Confirm Set up day, then choose Start driving or Start Other Work.",
          onConfirm: () => {
            setWorkWarning(null);
          onStartShiftBlocked?.({
            openSetup: true,
            dayIndex: currentDayIndex,
            startWorkAfterSetup: true,
            episodeResume: options?.episodeResume === true,
          });
          },
          onCancel: () => setWorkWarning(null),
        });
      return true;
    },
    [dayForCardFields, eventsForDriver, onStartShiftBlocked, currentDayIndex]
  );

  const finalizeStartWorkOnTimeline = useCallback(
    (episodeResume: boolean) => {
      // Setup was just confirmed — open Driving / Other work chooser (do not log driving).
      const nonWorkMsg = getInsufficientNonWorkWarning(episodeResume);
      if (nonWorkMsg) {
          setWorkWarning({
          message: nonWorkMsg,
          confirmLabel: `${DRIVER_START_SHIFT_LABEL} anyway`,
          subtext: "Your day setup is saved. Confirm, then choose Start driving or Start Other Work.",
            onConfirm: () => {
              setWorkWarning(null);
              clearPending();
              setWorkLogEpisodeResume(episodeResume);
              setStartShiftChooserOpen(true);
            },
          onCancel: () => setWorkWarning(null),
          });
          return;
        }
      clearPending();
      setWorkLogEpisodeResume(episodeResume);
      setStartShiftChooserOpen(true);
    },
    // getInsufficientNonWorkWarning / clearPending close over live state
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional live closure
    [
      currentDayIndex,
      eventsForDriver,
      currentType,
      isTwoUp,
      soloEpisodeResume,
      clearPending,
    ]
  );

  const lastFinalizeStartWorkIdRef = useRef(0);
  useEffect(() => {
    if (!finalizeStartWorkRequest) return;
    if (finalizeStartWorkRequest.id === lastFinalizeStartWorkIdRef.current) return;
    lastFinalizeStartWorkIdRef.current = finalizeStartWorkRequest.id;
    finalizeStartWorkOnTimeline(finalizeStartWorkRequest.episodeResume);
  }, [finalizeStartWorkRequest, finalizeStartWorkOnTimeline]);

  useEffect(() => {
    if (!isLiveNow) return;
    syncDriverImmersiveClass();
    const onFullscreenChange = () => syncDriverImmersiveClass();
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [isLiveNow]);

  const handleLog = (type: string, options?: { episodeResume?: boolean }) => {
    const episodeResume = type === "work" && options?.episodeResume === true;
    const confirming = isDriverLogConfirmMatch(pendingArmRef.current, type, episodeResume);

    // Confirm tap: do not re-request fullscreen (steals the gesture on mobile).
    if (!confirming) {
      void requestDriverImmersive().then(() => syncDriverImmersiveClass());
    }

    if (type === currentType) return;

    if (
      type === "stop" &&
      !shiftSegmentOpen &&
      pendingArmRef.current?.type !== "stop"
    ) {
      return;
    }

    if (showShiftStartSetupBlock(type, { episodeResume })) return;

    if (confirming) {
      clearPending();
      if (type === "stop") {
        if (onEndShiftRequest) {
        onEndShiftRequest(currentDayIndex);
        }
        return;
      }
      onLogEvent(currentDayIndex, type);
      return;
    }

    if (type === "work") {
      if (!startShiftChooserOpen) {
        const nonWorkMsg = getInsufficientNonWorkWarning(episodeResume);
        if (nonWorkMsg) {
          setWorkWarning({
            message: nonWorkMsg,
            confirmLabel: `${DRIVER_START_SHIFT_LABEL} anyway`,
            subtext: `Tap ${DRIVER_START_SHIFT_LABEL} again within a few seconds to confirm.`,
            onConfirm: () => {
              setWorkWarning(null);
              armPending("work", episodeResume);
              if (voiceAlertsEnabled) {
                speakVoiceAlert(`Tap ${DRIVER_START_SHIFT_LABEL} again to confirm.`);
              }
            },
          });
          return;
        }
      }
      const workConfirmLabel = startShiftChooserOpen
        ? DRIVER_START_DRIVING_LABEL
        : episodeResume || needsShiftStartSetup
          ? DRIVER_START_SHIFT_LABEL
          : DRIVER_CONTINUE_SHIFT_LABEL;
      if (workRelevantComplianceMessages?.length) {
        const message =
          workRelevantComplianceMessages.length === 1
            ? workRelevantComplianceMessages[0]
            : "Logging work now may affect these compliance rules:\n\n• " + workRelevantComplianceMessages.join("\n\n• ");
        const fixRoute = resolvePrimaryComplianceFixRoute(
          complianceIssueInputsFromMessages(workRelevantComplianceMessages, "warning", currentDayIndex)
        );
        const fixable = fixRoute != null && isComplianceFixActionable(fixRoute);
        setWorkWarning({
          message,
          confirmLabel: `${workConfirmLabel} anyway`,
          subtext: fixable
            ? "Fix the issue on your record, or confirm to log work anyway."
            : `Tap ${workConfirmLabel} again within a few seconds to confirm.`,
          ...(fixable && fixRoute
            ? {
                setupRecordLabel: fixRoute.driverLabel,
                onSetupRecord: () => {
                  setWorkWarning(null);
                  applyComplianceFix(fixRoute);
                },
              }
            : {}),
          onConfirm: () => {
            setWorkWarning(null);
            armPending("work", episodeResume);
            if (voiceAlertsEnabled) {
              speakVoiceAlert(`Tap ${workConfirmLabel} again to confirm.`);
            }
          },
        });
        return;
      }
    }
    if (type === OTHER_WORK_EVENT_TYPE && currentType === null && !startShiftChooserOpen) {
      const nonWorkMsg = getInsufficientNonWorkWarning(Boolean(showResumeShiftPrimary));
      if (nonWorkMsg) {
        setWorkWarning({
          message: nonWorkMsg,
          confirmLabel: `${DRIVER_START_SHIFT_LABEL} anyway`,
          subtext: `Tap ${DRIVER_START_OTHER_WORK_LABEL} again within a few seconds to confirm.`,
          onConfirm: () => {
            setWorkWarning(null);
            armPending(OTHER_WORK_EVENT_TYPE);
            if (voiceAlertsEnabled) {
              speakVoiceAlert(`Tap ${DRIVER_START_OTHER_WORK_LABEL} again to confirm.`);
            }
          },
        });
        return;
      }
    }
    if (voiceFinalizeNextLogRef.current) {
      clearPending();
      if (showShiftStartSetupBlock(type, { episodeResume })) return;
      if (type === "stop") {
        if (onEndShiftRequest) {
        onEndShiftRequest(currentDayIndex);
        }
        return;
      }
      onLogEvent(currentDayIndex, type);
      return;
    }
    armPending(type, episodeResume);
    if (voiceAlertsEnabled) {
      const label =
        type === "stop"
          ? DRIVER_END_SHIFT_LABEL
          : type === "break"
            ? DRIVER_START_REST_LABEL
              : type === OTHER_WORK_EVENT_TYPE
              ? DRIVER_START_OTHER_WORK_LABEL
              : startShiftChooserOpen
                ? DRIVER_START_DRIVING_LABEL
                : episodeResume || needsShiftStartSetup
                ? DRIVER_START_SHIFT_LABEL
                : DRIVER_CONTINUE_SHIFT_LABEL;
      speakVoiceAlert(`Tap ${label} again to confirm.`);
    }
  };

  const beginStartShift = (opts?: { episodeResume?: boolean }) => {
    const episodeResume = opts?.episodeResume === true;
    if (showShiftStartSetupBlock("work", { episodeResume })) return;
    const nonWorkMsg = getInsufficientNonWorkWarning(episodeResume);
    if (nonWorkMsg) {
      setWorkWarning({
        message: nonWorkMsg,
        confirmLabel: `${DRIVER_START_SHIFT_LABEL} anyway`,
        subtext: "Confirm, then choose Start driving or Start Other Work.",
        onConfirm: () => {
          setWorkWarning(null);
          setWorkLogEpisodeResume(episodeResume);
          setStartShiftChooserOpen(true);
        },
        onCancel: () => setWorkWarning(null),
      });
      return;
    }
    setWorkLogEpisodeResume(episodeResume);
    setStartShiftChooserOpen(true);
  };

  const handleStartShift = () => beginStartShift({ episodeResume: false });
  const handleResumeShift = () => beginStartShift({ episodeResume: true });

  /** Header / sheet utility control sizing. */
  const touchHeaderBtn = driverTouchIconBtn;
  const touchHeaderIcon = "h-6 w-6";
  const touchSheetBtn = driverSheetUtilityBtn;
  const touchSheetIcon = "h-10 w-10";

  const voiceCommandProps = {
    allowStopIntent: shiftSegmentOpen || pendingType === "stop",
    voiceLabels: {
      work:
        startShiftChooserOpen
          ? DRIVER_START_DRIVING_LABEL
          : currentType === null
            ? DRIVER_START_SHIFT_LABEL
            : DRIVER_CONTINUE_SHIFT_LABEL,
      break: DRIVER_START_REST_LABEL,
      other_work: DRIVER_START_OTHER_WORK_LABEL,
      stop_driving: DRIVER_STOP_DRIVING_LABEL,
      stop: EVENT_LABELS.stop,
    },
    onConfirmIntent: (intent: "work" | "break" | "other_work" | "stop_driving" | "stop") => {
      if (intent === "stop_driving") {
        setStopDrivingChooserOpen(true);
        return;
      }
      if (intent === "work" && currentType === null) {
        if (startShiftChooserOpen) {
          voiceFinalizeNextLogRef.current = true;
          try {
            handleLog("work", { episodeResume: workLogEpisodeResume });
          } finally {
            voiceFinalizeNextLogRef.current = false;
          }
          return;
        }
        beginStartShift({ episodeResume: showResumeShiftPrimary });
        return;
      }
      voiceFinalizeNextLogRef.current = true;
      try {
        handleLog(intent);
      } finally {
        voiceFinalizeNextLogRef.current = false;
      }
    },
  };

  const showEndShiftDock = shiftSegmentOpen || pendingType === "stop";

  useLayoutEffect(() => {
    const el = fixedHeaderRef.current;
    if (!el) return;
    const sync = () => {
      const h = sessionDimmed ? 0 : el.offsetHeight;
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
    showSessionTimer,
    logBarBanner,
    forgottenActionReminder,
    shiftSegmentOpen,
    sessionDimmed,
    primaryActionPending,
    sessionToolsOpen,
  ]);

  useLayoutEffect(() => {
    if (!showEndShiftDock) {
      document.documentElement.style.setProperty("--driver-end-shift-height", "0px");
      return () => document.documentElement.style.removeProperty("--driver-end-shift-height");
    }
    const el = fixedEndShiftRef.current;
    if (!el) return;
    const sync = () => {
      document.documentElement.style.setProperty("--driver-end-shift-height", `${el.offsetHeight}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--driver-end-shift-height");
    };
  }, [showEndShiftDock, pendingType, shiftSegmentOpen]);

  /** Scrolled down or viewing diary — compact hero in the top bar. */
  const primaryBarCompact = Boolean(isLiveNow) && (scrollCompact || sheetViewMode);

  const endShiftChrome = getEndShiftButtonChrome();
  const endShiftPending = pendingType === "stop";

  const endShiftButton = showEndShiftDock ? (
    <div
      className={cn(
        "inline-flex shrink-0 rounded-full transition-all duration-500 ease-out",
        endShiftTrimPaddingClass(primaryHeroExpanded, primaryBarCompact, endShiftPending),
        endShiftChrome.trimClass,
        endShiftPending &&
          "ring-2 ring-white ring-offset-2 ring-offset-slate-950 animate-pulse"
      )}
    >
            <button
              type="button"
        onClick={() => handleLog("stop")}
        disabled={isMoving && !endShiftPending}
                className={cn(
          "flex flex-col items-center justify-center rounded-full font-bold transition-all duration-500 ease-out active:scale-[0.98]",
          "touch-manipulation select-none",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          "disabled:opacity-50 disabled:pointer-events-none",
          endShiftPending ? "gap-1 px-2" : "gap-0",
          endShiftButtonSizeClass(primaryHeroExpanded, primaryBarCompact, endShiftPending),
          endShiftChrome.surfaceClass,
          endShiftChrome.textClass
                )}
                aria-label={
          isMoving && !endShiftPending
            ? "End shift locked while moving"
            : endShiftPending
              ? "Tap again to confirm end shift"
              : EVENT_LABELS.stop
        }
      >
        {React.createElement(EVENT_ICONS.stop, {
          className: cn(
            "shrink-0",
            endShiftIconSizeClass(primaryHeroExpanded, primaryBarCompact, endShiftPending)
          ),
        })}
        {endShiftPending ? (
          <span
            className={cn(
              "text-center leading-tight",
              endShiftConfirmLabelSizeClass(primaryHeroExpanded, primaryBarCompact)
            )}
          >
            End shift?
          </span>
        ) : null}
                </button>
        </div>
  ) : null;

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
        {isTwoUp && reliefDriverName?.trim() ? (
          <p
                      className={cn(
              "w-full text-center text-xs font-semibold uppercase tracking-wider",
              isIdleAtTop || sessionDimmed ? "text-white/70" : "text-slate-500 dark:text-slate-400",
              sessionDimmed && "pointer-events-auto"
            )}
          >
            Two-up · relief driver {reliefDriverName.trim()}
          </p>
        ) : null}
        <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3 shrink-0 min-w-0">
          <div
                        className={cn(
              "flex w-full flex-col items-center gap-2.5 min-w-0",
              sessionDimmed ? "max-w-md" : "sm:items-center"
            )}
          >
            {showUpcomingComplianceChip ? (
              <UpcomingComplianceChip
                model={upcomingComplianceChip}
                fixRoute={primaryFixRoute}
                onFix={primaryFixRoute ? () => applyComplianceFix(primaryFixRoute) : undefined}
                onOpenDetail={complianceButton?.onClick}
                onDark={sessionDimmed}
                compact={primaryBarCompact && !sessionDimmed}
                className={cn(sessionDimmed && "pointer-events-auto")}
              />
            ) : null}
            <DriverActionHero
            workMinutesUsed={workMinutesUsed}
            totalWindowMinutes={WORK_WINDOW_MIN}
            currentSegment={
              currentType === "break" || currentType === OTHER_WORK_EVENT_TYPE
                ? "break"
                : currentType === "work"
                  ? "work"
                  : null
            }
            complianceLoading={complianceButton?.loading}
            shiftSegmentOpen={shiftSegmentOpen}
            isIdleAtTop={isIdleAtTop}
            isMoving={isMoving && !primaryActionPending}
            movementUnlockProgress01={
              isMoving && !primaryActionPending ? gpsUnlockProgress : 1
            }
            actionLabel={primaryActionLabel}
            onAction={() => {
              if (currentType === "work") {
                setStopDrivingChooserOpen(true);
                return;
              }
              if (primaryLogType === "work" && currentType === null) {
                if (showResumeShiftPrimary) handleResumeShift();
                else handleStartShift();
                return;
              }
              handleLog(primaryLogType);
            }}
            actionPending={primaryActionPending}
            actionIcon={primaryActionIcon}
            elapsedLabel={
              showSessionTimer ? formatElapsedBarDisplay(elapsedMinutes) : null
            }
            breakRestIncomplete={breakRestStatus?.incomplete ?? false}
            breakRestBankedMinutes={
              breakRestStatus?.incomplete ? breakRestStatus.bankedMinutes : null
            }
            breakRestProgressLabel={breakRestStatus?.progressLabel ?? null}
            idleRestBlocked={idleRestBlocked}
            idleRestHelper={idlePrimary?.helper ?? null}
            idleRestRemainingMinutes={idleRestRemainingMinutes}
            expanded={primaryHeroExpanded}
            compact={primaryBarCompact && !sessionDimmed}
            className={cn("shrink-0", sessionDimmed && "pointer-events-auto")}
            stopDrivingChooser={
              stopDrivingChooserOpen && currentType === "work"
                ? {
                    variant: "stop-driving",
                    restLabel: DRIVER_START_REST_LABEL,
                    otherWorkLabel: DRIVER_START_OTHER_WORK_LABEL,
                    onStartRest: () => handleLog("break"),
                    onStartOtherWork: () => handleLog(OTHER_WORK_EVENT_TYPE),
                    onCancel: () => {
                      setStopDrivingChooserOpen(false);
                    },
                    restPending: pendingType === "break",
                    otherWorkPending: pendingType === OTHER_WORK_EVENT_TYPE,
                  }
                : startShiftChooserOpen && currentType === null
                  ? {
                      variant: "start-shift",
                      restLabel: DRIVER_START_DRIVING_LABEL,
                      otherWorkLabel: DRIVER_START_OTHER_WORK_LABEL,
                      onStartRest: () =>
                        handleLog("work", { episodeResume: workLogEpisodeResume }),
                      onStartOtherWork: () =>
                        handleLog(OTHER_WORK_EVENT_TYPE, { episodeResume: workLogEpisodeResume }),
                      onCancel: () => {
                        setStartShiftChooserOpen(false);
                      },
                      restPending: pendingType === "work",
                      otherWorkPending: pendingType === OTHER_WORK_EVENT_TYPE,
                    }
                  : null
            }
            auxiliaryActions={
              sessionDimmed
                ? [
                    {
                      label: "View diary",
                      onAction: viewDiary,
                      icon: ChevronUp,
                      onDark: true,
                    },
                  ]
                : undefined
            }
          />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Reserve space for fixed top bar (not used in mobile focus — hero floats centered). */}
      {!sessionDimmed && (
        <div
          aria-hidden
          className="max-w-[1400px] mx-auto w-full"
                          style={{
            height: headerHeight > 0 ? headerHeight : undefined,
            minHeight: headerHeight > 0 ? undefined : "20rem",
          }}
        />
      )}
      {sessionDimmed && (
        <button
          type="button"
          aria-label="View diary"
          className="fixed inset-0 z-40 bg-black/65 pointer-events-auto transition-opacity duration-500 cursor-default border-0 p-0"
          onClick={viewDiary}
        />
      )}
      <div
        ref={fixedHeaderRef}
                      className={cn(
          "fixed z-50 px-4 transition-all duration-500 ease-out",
          sessionDimmed
            ? cn(
                "inset-0 flex flex-col items-center justify-center px-6 pt-[max(1rem,env(safe-area-inset-top))]",
                "pb-[max(1rem,env(safe-area-inset-bottom))]",
                "bg-transparent border-0 shadow-none backdrop-blur-none pointer-events-none"
              )
            : cn(
                  "top-0 left-0 right-0 pt-[max(0.75rem,env(safe-area-inset-top))]",
                  scrollCompact ? "py-2" : "py-3",
                  FIXED_LOG_BAR_SHELL
                )
        )}
      >
        {hideSecondaryToolbar && (
          <div className="pointer-events-auto absolute top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-10">
            <button
              type="button"
              onClick={openSessionTools}
              className="relative flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white/75 hover:text-white hover:bg-white/10 active:scale-95 transition-colors"
              aria-label="Options"
              aria-expanded={sessionToolsOpen}
              aria-controls="driver-focus-tools-sheet"
            >
              <Settings className="h-7 w-7" aria-hidden />
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
            "mx-auto w-full flex flex-col gap-2",
            sessionDimmed
              ? "shrink-0 items-center justify-center"
              : "max-w-[1400px]"
          )}
        >
          {driverName?.trim() ? (
            <p
              className={cn(
                "pointer-events-none flex w-full min-w-0 items-center gap-1.5 text-xs font-semibold tracking-tight",
                sessionDimmed
                  ? "justify-center text-white/85"
                  : "text-slate-700 dark:text-slate-200"
              )}
              role="status"
              aria-label={`Driver name: ${driverName.trim()}`}
            >
              <UserRound
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  sessionDimmed ? "text-white/70" : "text-slate-500 dark:text-slate-400"
                )}
                  aria-hidden
                />
              <span className="truncate">{driverName.trim()}</span>
            </p>
          ) : null}
          <div
              className={cn(
              "w-full",
              sessionDimmed
                ? "flex shrink-0 flex-col items-center justify-center"
                : "flex flex-col gap-2 md:flex-row md:items-start md:gap-3"
            )}
          >
          <div
            className={cn(
              "min-w-0 w-full",
              sessionDimmed
                ? "flex shrink-0 flex-col items-center justify-center"
                : "flex-1"
            )}
          >
            {barContent}
      </div>
      <div
            className={cn(
              "flex w-full shrink-0 items-center justify-end gap-2 border-t border-black/10 pt-2 md:w-auto md:self-center md:border-t-0 md:pt-0 md:justify-start",
              hideSecondaryToolbar && "hidden"
            )}
          >
            {sheetViewMode && isLiveNow && !hideSecondaryToolbar && (
              <button
                type="button"
                onClick={restoreFocusHero}
                className={cn(
                  touchHeaderBtn,
                  "shrink-0 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                title="Expand controls"
                aria-label="Expand controls"
              >
                <ChevronDown className="h-8 w-8 stroke-[2.75]" aria-hidden />
              </button>
            )}
            {!hideSecondaryToolbar && (
              <button
                type="button"
                onClick={openSessionTools}
                className={cn(
                  touchHeaderBtn,
                  "relative shrink-0 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                title="Options"
                aria-label="Options"
                aria-expanded={sessionToolsOpen}
                aria-controls="driver-focus-tools-sheet"
              >
                <Settings className={cn(touchHeaderIcon, "h-8 w-8")} aria-hidden />
                {(complianceButton?.hasViolations || complianceButton?.hasWarnings) && (
                  <span
                    className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900"
                    aria-hidden
                  />
                )}
              </button>
            )}
          </div>
        </div>
        </div>
        {forgottenActionReminder && (

          <div
            role="alert"
            className={cn(
              "rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100",
              sessionDimmed
                ? "pointer-events-auto mx-auto mt-4 max-w-md w-full border-amber-400/40 bg-amber-950/80 text-amber-100"
                : "max-w-[1400px] mx-auto mt-2"
            )}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden />
              <p className="flex-1 font-medium min-w-0">{forgottenActionReminder.message}</p>
            </div>
            {forgottenActionReminder.variant === "break-due" && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setStopDrivingChooserOpen(true)}
                  className={driverAmberBtn}
                >
                  <Pause className="w-4 h-4" />
                  {DRIVER_STOP_DRIVING_LABEL}
                </button>
              </div>
            )}
            {/* break-complete / break-long: message only — Resume work is the hero action. */}
          </div>
        )}
        {workWarning && (
          <div className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/50" aria-modal role="alertdialog" aria-labelledby="work-warning-title">
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
                  className={driverMutedBtn}
                >
                  {workWarning.confirmLabel === "Start anyway" ? "Keep resting" : "Cancel"}
                </button>
                {workWarning.onSetupRecord && workWarning.setupRecordLabel ? (
                <button
                  type="button"
                    onClick={() => workWarning.onSetupRecord?.()}
                    className={cn(driverAmberBtn, "bg-emerald-600 hover:bg-emerald-700 text-white")}
                >
                    {workWarning.setupRecordLabel}
                </button>
                ) : null}
                  <button
                    type="button"
                  onClick={() => workWarning.onConfirm()}
                  className={cn(driverAmberBtn, "bg-amber-500 hover:bg-amber-600")}
                  >
                  {workWarning.confirmLabel}
                  </button>
              </div>
            </div>
              </div>
            )}
      </div>
      {sessionToolsMounted &&
        sessionToolsOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100]"
            role="dialog"
            aria-modal
            aria-labelledby="driver-focus-tools-title"
            id="driver-focus-tools-sheet"
          >
                <button
                  type="button"
              className="absolute inset-0 w-full h-full cursor-default border-0 bg-black/50 p-0"
              aria-label="Dismiss options"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeSessionTools();
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl p-4 space-y-4 backdrop-blur-md">
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
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeSessionTools();
                    }}
                    aria-label="Close"
                  >
                    <X className="h-7 w-7" />
                </button>
                </div>
                {complianceButton && (
                <button
                  type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeSessionTools();
                      complianceButton.onClick();
                    }}
                    disabled={complianceButton.loading}
                    className={cn(
                      "flex w-full items-center gap-3 min-h-[52px] rounded-xl px-4 font-semibold disabled:opacity-60",
                      complianceButton.hasViolations || complianceButton.hasWarnings
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-white/10 hover:bg-white/15 text-white"
                    )}
                  >
                    {complianceButton.loading ? (
                      <Loader2 className="w-6 h-6 animate-spin shrink-0" aria-hidden />
                    ) : complianceButton.hasViolations ? (
                      <X className="w-6 h-6 shrink-0 text-white" strokeWidth={3} aria-hidden />
                    ) : complianceButton.hasWarnings ? (
                      <AlertTriangle className="w-6 h-6 shrink-0 text-white" strokeWidth={2.5} aria-hidden />
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
          </div>,
          document.body
        )}
      {showEndShiftDock && (
        <div
          ref={fixedEndShiftRef}
          className={cn(
            "fixed z-[55] flex pointer-events-none",
            "right-[max(0.75rem,env(safe-area-inset-right))]",
            "bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
          )}
        >
          <div className="pointer-events-auto">{endShiftButton}</div>
      </div>
      )}
    </>
  );
}
