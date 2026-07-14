"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, type ComplianceCheckResult, type FatigueSheet, type DayData, type Driver } from "@/lib/api";
import { PRODUCT_NAME, TAGLINE_DRIVER } from "@/lib/branding";
import {
  getSheetOfflineFirst,
  updateSheetOfflineFirst,
  listSheetsOfflineFirst,
  listRegosOfflineFirst,
} from "@/lib/offline-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import SheetHeader from "@/components/fatigue/SheetHeader";
import { CvdMedicalBanner } from "@/components/fatigue/CvdMedicalBanner";
import DayEntry, { type DayCardToolsConfig } from "@/components/fatigue/DayEntry";
import { ComplianceAlertBar, ComplianceNoticeBar } from "@/components/fatigue/ComplianceAlertBar";
import { ComplianceQuickDialog } from "@/components/fatigue/ComplianceQuickDialog";
import SignatureDialog from "@/components/fatigue/SignatureDialog";
import LogBar from "@/components/fatigue/LogBar";
import { ShiftPatternEndShiftDialog } from "@/components/fatigue/ShiftPatternEndShiftDialog";
import { EndShiftCorrectionDialog } from "@/components/fatigue/EndShiftCorrectionDialog";
import { DriverGearDrawer } from "@/components/driver/DriverGearDrawer";
import { DriverRoadsideProduceButton } from "@/components/driver/DriverRoadsideProduceButton";
import { DriverSheetActions } from "@/components/driver/DriverSheetActions";
import { driverDialogBtn, driverToolbarBtn } from "@/components/driver/driver-ui-classes";
import { deriveDaysWithRollover, applyLast24hBreakNonWorkRule } from "@/components/fatigue/EventLogger";
import {
  getContinuedShiftRoutePrompt,
  getPriorDayUnclosedShiftPrompt,
  suggestedEndShiftTimeAfterLastEvent,
} from "@/lib/day-route-carry";
import {
  applyStopAtCorrectedTime,
  dayHasOpenWorkOrBreakSegment,
  routeConfirmDayAfterPriorEndShift,
  validateCorrectEndShiftTime,
} from "@/lib/shift-timeline-correction";
import { hhmmOnSheetDayToIso, isoToLocalHHMM } from "@/lib/sheet-day-time";
import {
  applyRouteDefaultsToWeekDays,
  getDayWithMergedRouteContext,
  loadDriverRouteDefaults,
} from "@/lib/driver-route-defaults";
import {
  formatSheetDisplayDate,
  getSheetDayDateString,
  getPreviousWeekSunday,
  getRegulatoryTodayYmd,
  getThisWeekSunday,
  isPastRegulatoryWeek,
} from "@/lib/weeks";
import {
  canDriverAttestSheet,
  canDriverEditSheetContent,
  canDriverLogOnSheet,
  isPrematureCurrentWeekAttestation,
  PREMATURE_ATTESTATION_REOPEN,
} from "@/lib/sheet-record";
import { DRIVER_SIGN_WEEK_NOT_ENDED_ERROR } from "@/lib/product-copy";
import { SheetRecordBanner } from "@/components/fatigue/SheetRecordBanner";
import { DayEntryWeekGroup } from "@/components/fatigue/DayEntryWeekGroup";
import { dayIndexRangeLabels, summarizeDayIndices } from "@/lib/day-entry-week-summary";
import {
  samePatternWorkMinutesEndingAt,
  shouldEducateAfterEndShift,
  type ShiftLabel,
} from "@/lib/shift-change";
import { getProspectiveWorkWarnings, getSlotOffsetWithinTodayLocal } from "@/lib/compliance";
import { complianceStateAt } from "@/lib/compliance-state";
import {
  buildDriverComplianceWeekContext,
  runLocalSheetComplianceCheck,
} from "@/lib/sheet-compliance-local";
import type { TimelineSlice } from "@/lib/rolling-events";
import { concatenateTimelineSlices, getSheetOwnerEventsInOrder } from "@/lib/rolling-events";
import { getWorkLogBlockReason } from "@/lib/shift-start-gate";
import { resolveDayCrew } from "@/lib/day-crew";
import { buildRiskRegisterFromWeek } from "@/lib/risk-register";
import { getCurrentPosition, BEST_EFFORT_OPTIONS } from "@/lib/geo";
import {
  validateDayKms,
  getMinAllowedStartKms,
  validateSheetKms,
  chainRegoKmsAcrossSheet,
  collectRegosNeedingKm,
  getSheetKmIssues,
  regoKey,
  type SheetKmIssue,
} from "@/lib/rego-kms-validation";
import { SignKmFixDialog } from "@/components/fatigue/SignKmFixDialog";
import { setActiveSheetDiaryContext } from "@/lib/risk-block-diary";
import { DEFAULT_JURISDICTION_CODE } from "@/lib/jurisdiction";
import { MINUTES_PER_DAY, normalizeDayCoverageArrays } from "@/lib/coverage/derive-minute-coverage";
import { getDisplayNameFromSession } from "@/lib/session-display-name";
import { cn } from "@/lib/utils";
import { formatPastWeekArchiveSubtitle } from "@/lib/product-copy";
import { useUnsignedPastWeeks } from "@/hooks/use-unsigned-past-weeks";

const EMPTY_DAY = (): DayData => ({
  day_label: "",
  date: "",
  truck_rego: "",
  start_location: "",
  destination: "",
  start_kms: undefined,
  end_kms: undefined,
  work_time: Array(MINUTES_PER_DAY).fill(false),
  breaks: Array(MINUTES_PER_DAY).fill(false),
  non_work: Array(MINUTES_PER_DAY).fill(false),
});

/** Current day index (0–6) for the sheet week from regulatory "today" (WA: Perth calendar); not user-selectable. */
function getCurrentDayIndex(weekStarting: string, todayYmd: string): number {
  const [ty, tm, td] = todayYmd.split("-").map(Number);
  const today = new Date(ty, tm - 1, td);
  if (!weekStarting) return today.getDay();
  const [y, m, d] = weekStarting.split("-").map(Number);
  const weekStart = new Date(y, m - 1, d);
  const diffDays = Math.round((today.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(6, diffDays));
}

/** Reminder when driver may have forgotten to log work / break / end shift. */
const WORK_BREAK_DUE_MIN = 5 * 60;
/** If still in work and no log updates for this long, prompt to end shift. Tied to 5h break due + buffer. */
const WORK_NO_LOG_CHECK_IN_MIN = 7 * 60;
const BREAK_COMPLETE_MIN = 20;
const BREAK_LONG_MIN = 60;

const AUTO_SAVE_DEBOUNCE_MS = 5000;

function getForgottenActionReminder(
  days: DayData[],
  currentDayIndex: number,
  weekStarting: string,
  todayYmd: string
): { message: string; variant: "break-due" | "end-shift" | "break-complete" | "break-long" } | null {
  // Only show “you might have forgotten…” prompts on the *current* regulatory day for the *current* week.
  if (!weekStarting) return null;
  const sheetDayYmd = getSheetDayDateString(weekStarting, currentDayIndex);
  if (sheetDayYmd !== todayYmd) return null;

  const day = days[currentDayIndex];
  const events = day?.events ?? [];
  const last = events[events.length - 1];
  if (!last || last.type === "stop") return null;
  const elapsedMin = Math.floor((Date.now() - new Date(last.time).getTime()) / 60000);
  if (last.type === "work") {
    // This is an inactivity-style prompt: time since the last logged event while still in "work".
    if (elapsedMin >= WORK_NO_LOG_CHECK_IN_MIN)
      return { message: "No log updates for 7+ hours. End shift and record when you finished (or log Break if you stopped).", variant: "end-shift" };
    if (elapsedMin >= WORK_BREAK_DUE_MIN)
      return { message: "Time for your 20 min break — tap Break when you start.", variant: "break-due" };
    return null;
  }
  if (last.type === "break") {
    if (elapsedMin >= BREAK_LONG_MIN)
      return { message: "You've been on break for over an hour. Tap Work to resume or End shift to finish.", variant: "break-long" };
    if (elapsedMin >= BREAK_COMPLETE_MIN)
      return { message: "Break complete — tap Work to resume or End shift to finish.", variant: "break-complete" };
    return null;
  }
  return null;
}

export function SheetDetail({
  sheetId,
  canAccessManager,
}: {
  sheetId: string;
  /** From server: user may open /manager without extra login */
  canAccessManager: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const isManager =
    canAccessManager ||
    (session?.user as { role?: string | null } | undefined)?.role === "manager";
  const driverUserKey = (session?.user as { email?: string | null } | undefined)?.email?.trim() ?? "";

  const [sheetData, setSheetData] = useState<{
    driver_name: string;
    second_driver: string;
    driver_type: string;
    jurisdiction_code: string;
    last_24h_break: string;
    week_starting: string;
    days: DayData[];
    status: string;
    signature?: string;
    signed_at?: string;
  }>({
    driver_name: "",
    second_driver: "",
    driver_type: "solo",
    jurisdiction_code: DEFAULT_JURISDICTION_CODE,
    last_24h_break: "",
    week_starting: getThisWeekSunday(),
    days: Array(7)
      .fill(null)
      .map(() => EMPTY_DAY()),
    status: "draft",
  });
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showMarkCompleteConfirm, setShowMarkCompleteConfirm] = useState(false);
  const [signKmFixIssues, setSignKmFixIssues] = useState<SheetKmIssue[] | null>(null);
  const [signKmServerMax, setSignKmServerMax] = useState<Record<string, number | null>>({});
  const [kmFixPurpose, setKmFixPurpose] = useState<"save" | "sign">("sign");
  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
  const [endShiftDialog, setEndShiftDialog] = useState<{
    dayIndex: number;
    dayLabel: string;
    sheetDayYmd: string;
  } | null>(null);
  const [endShiftStopHhmm, setEndShiftStopHhmm] = useState("");
  const [endShiftEndKms, setEndShiftEndKms] = useState("");
  const [endShiftError, setEndShiftError] = useState<string | null>(null);
  const [shiftPatternPrompt, setShiftPatternPrompt] = useState<{ dayIndex: number } | null>(null);
  const [driverSessionDimmed, setDriverSessionDimmed] = useState(false);
  const [shiftSegmentOpen, setShiftSegmentOpen] = useState(false);
  const [gearDrawerOpen, setGearDrawerOpen] = useState(false);
  const [priorWeekDaysExpanded, setPriorWeekDaysExpanded] = useState(false);
  const [futureWeekDaysExpanded, setFutureWeekDaysExpanded] = useState(false);
  const [todaySetupOpenRequest, setTodaySetupOpenRequest] = useState(0);
  const [heroExpandRequest, setHeroExpandRequest] = useState(0);
  const sheetDataRef = useRef(sheetData);
  sheetDataRef.current = sheetData;
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayCardsRef = useRef<HTMLDivElement>(null);
  /** One ref per day card (e.g. scroll to current day from LogBar) */
  const dayCardElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!sheetId || !sheetData.week_starting) return;
    if (isPastRegulatoryWeek(sheetData.week_starting)) return;
    try {
      sessionStorage.setItem("fatigue-last-sheet-id", sheetId);
    } catch {
      /* ignore */
    }
  }, [sheetId, sheetData.week_starting]);
  const todayYmd = useMemo(
    () => getRegulatoryTodayYmd(sheetData.jurisdiction_code),
    [sheetData.jurisdiction_code, now]
  );

  const currentDayIndex = useMemo(
    () => getCurrentDayIndex(sheetData.week_starting, todayYmd),
    [sheetData.week_starting, todayYmd]
  );

  const todayCrew = useMemo(
    () => resolveDayCrew(sheetData.days[currentDayIndex], sheetData),
    [sheetData.days, currentDayIndex, sheetData.driver_type, sheetData.second_driver]
  );

  const forgottenActionReminder = useMemo(
    () => getForgottenActionReminder(sheetData.days, currentDayIndex, sheetData.week_starting, todayYmd),
    [sheetData.days, currentDayIndex, sheetData.week_starting, todayYmd, now]
  );

  const slotMinute = useMemo(
    () => getSlotOffsetWithinTodayLocal(now, sheetData.jurisdiction_code),
    [now, sheetData.jurisdiction_code]
  );

  const { data: sheet, isLoading } = useQuery({
    queryKey: ["sheet", sheetId],
    queryFn: () => getSheetOfflineFirst(sheetId),
    refetchOnMount: isManager ? "always" : false,
    staleTime: isManager ? 0 : Number.POSITIVE_INFINITY,
  });

  const { data: allSheets = [] } = useQuery({
    queryKey: ["sheets"],
    queryFn: () => listSheetsOfflineFirst(),
    refetchOnMount: isManager ? "always" : false,
    staleTime: isManager ? 0 : Number.POSITIVE_INFINITY,
  });

  const { data: regos = [] } = useQuery({
    queryKey: ["regos"],
    queryFn: () => listRegosOfflineFirst(),
    refetchOnMount: isManager ? "always" : false,
    staleTime: isManager ? 0 : Number.POSITIVE_INFINITY,
  });

  const { data: rosterDrivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
    enabled: isManager,
  });

  const storedRouteDefaults = useMemo(() => {
    if (isManager || !driverUserKey) return null;
    return loadDriverRouteDefaults(driverUserKey);
  }, [isManager, driverUserKey]);

  const isPastWeek = useMemo(
    () => isPastRegulatoryWeek(sheetData.week_starting),
    [sheetData.week_starting]
  );
  const groupDaysAroundToday = !isManager && !isPastWeek;
  const priorDayIndices = useMemo(
    () => (groupDaysAroundToday ? Array.from({ length: currentDayIndex }, (_, i) => i) : []),
    [groupDaysAroundToday, currentDayIndex]
  );
  const futureDayIndices = useMemo(
    () =>
      groupDaysAroundToday
        ? Array.from({ length: Math.max(0, 6 - currentDayIndex) }, (_, i) => currentDayIndex + 1 + i)
        : [],
    [groupDaysAroundToday, currentDayIndex]
  );
  const priorDaysGroupLabels = useMemo(
    () => dayIndexRangeLabels(sheetData.week_starting, priorDayIndices, "past"),
    [sheetData.week_starting, priorDayIndices]
  );
  const futureDaysGroupLabels = useMemo(
    () => dayIndexRangeLabels(sheetData.week_starting, futureDayIndices, "future"),
    [sheetData.week_starting, futureDayIndices]
  );
  const priorDaysSummary = useMemo(
    () => summarizeDayIndices(sheetData.days, priorDayIndices, "past"),
    [sheetData.days, priorDayIndices]
  );
  const futureDaysSummary = useMemo(
    () => summarizeDayIndices(sheetData.days, futureDayIndices, "future"),
    [sheetData.days, futureDayIndices]
  );
  const driverContentLocked = useMemo(
    () =>
      !isManager &&
      !canDriverEditSheetContent(sheetData.week_starting, sheetData.status, sheetData.signature),
    [isManager, sheetData.week_starting, sheetData.status, sheetData.signature]
  );
  const canShowLogBar = useMemo(
    () =>
      !isManager &&
      canDriverLogOnSheet(sheetData.week_starting, sheetData.status, sheetData.signature),
    [isManager, sheetData.week_starting, sheetData.status, sheetData.signature]
  );
  const canDriverSign = useMemo(
    () =>
      !isManager &&
      canDriverAttestSheet(sheetData.week_starting, sheetData.status, sheetData.signature),
    [isManager, sheetData.week_starting, sheetData.status, sheetData.signature]
  );

  useEffect(() => {
    if (isManager || !sheetData.week_starting || !sheetData.days?.length) {
      setActiveSheetDiaryContext(null);
      return;
    }
    setActiveSheetDiaryContext({
      weekStarting: sheetData.week_starting,
      days: sheetData.days,
    });
    return () => setActiveSheetDiaryContext(null);
  }, [isManager, sheetData.week_starting, sheetData.days]);

  const weekOfLabel = useMemo(
    () =>
      sheetData.week_starting
        ? formatSheetDisplayDate(sheetData.week_starting)
        : "",
    [sheetData.week_starting]
  );

  const pageSubtitle = useMemo(() => {
    if (isPastWeek && weekOfLabel) {
      return canDriverEditSheetContent(sheetData.week_starting, sheetData.status, sheetData.signature)
        ? `Week of ${weekOfLabel} · edit & sign`
        : formatPastWeekArchiveSubtitle(weekOfLabel);
    }
    if (weekOfLabel) {
      return `Week of ${weekOfLabel}`;
    }
    return TAGLINE_DRIVER;
  }, [isPastWeek, weekOfLabel, sheetData.week_starting, sheetData.status, sheetData.signature]);

  const sheetBackNav = useMemo(() => {
    if (isManager) {
      return { href: "/manager", label: "Manager dashboard" };
    }
    if (isPastWeek) {
      return { href: "/sheets", label: "Your weeks" };
    }
    return { href: "/driver", label: "Drive home" };
  }, [isManager, isPastWeek]);

  // Re-derive time grids every minute on the live (current) week only
  useEffect(() => {
    setSheetData((prev) => {
      if (!canDriverEditSheetContent(prev.week_starting, prev.status, prev.signature) && !isManager) {
        return prev;
      }
      const reDerived = deriveDaysWithRollover(prev.days, prev.week_starting, {
        todayStr: getRegulatoryTodayYmd(prev.jurisdiction_code),
      });
      return { ...prev, days: applyLast24hBreakNonWorkRule(reDerived, prev.week_starting, prev.last_24h_break || undefined) };
    });
  }, [slotMinute, isManager]);

  const sessionDriverName = getDisplayNameFromSession(session ?? null);
  const driverPageIdentity = useMemo(() => {
    const name = isManager
      ? (sheetData.driver_name || "").trim() || "—"
      : sessionStatus === "loading"
        ? "…"
        : (sessionDriverName || sheetData.driver_name || "").trim() || "—";
    return { name, isManagerView: isManager };
  }, [isManager, sessionStatus, sessionDriverName, sheetData.driver_name]);

  /** Title pill: Driver · name (drivers) or Manager · session name (handled in PageHeader). */
  const headerDriverDisplayName = useMemo(() => {
    if (isManager) return undefined;
    return (sessionDriverName || sheetData.driver_name || "").trim() || undefined;
  }, [isManager, sessionDriverName, sheetData.driver_name]);

  const matchedRosterPrimary = useMemo(() => {
    const n = sheetData.driver_name?.trim().toLowerCase();
    if (!n) return null;
    return rosterDrivers.find((d: Driver) => d.name.toLowerCase() === n) ?? null;
  }, [rosterDrivers, sheetData.driver_name]);

  const matchedRosterSecond = useMemo(() => {
    const n = sheetData.second_driver?.trim().toLowerCase();
    if (!n) return null;
    return rosterDrivers.find((d: Driver) => d.name.toLowerCase() === n) ?? null;
  }, [rosterDrivers, sheetData.second_driver]);

  useEffect(() => {
    if (sheet) {
      const weekStart = sheet.week_starting || getThisWeekSunday();
      const jurisdiction = sheet.jurisdiction_code || DEFAULT_JURISDICTION_CODE;
      const todayStr = getRegulatoryTodayYmd(jurisdiction);
      let days = applyLast24hBreakNonWorkRule(
        deriveDaysWithRollover(
          (sheet.days || []).map((d) => normalizeDayCoverageArrays({ ...EMPTY_DAY(), ...d })),
          weekStart,
          { todayStr }
        ),
        weekStart,
        sheet.last_24h_break || undefined
      );
      let defaultsApplied = false;
      if (!isManager && driverUserKey) {
        const stored = loadDriverRouteDefaults(driverUserKey);
        const applied = applyRouteDefaultsToWeekDays(days, weekStart, todayStr, stored);
        days = applied.days;
        defaultsApplied = applied.changed;
      }
      let status = sheet.status || "draft";
      let signature = sheet.signature;
      let signed_at = sheet.signed_at;
      if (isPrematureCurrentWeekAttestation(weekStart, status, signature)) {
        status = PREMATURE_ATTESTATION_REOPEN.status;
        signature = undefined;
        signed_at = undefined;
      }
      setSheetData({
        driver_name: sheet.driver_name || "",
        second_driver: sheet.second_driver || "",
        driver_type: sheet.driver_type || "solo",
        jurisdiction_code: jurisdiction,
        last_24h_break: sheet.last_24h_break || "",
        week_starting: weekStart,
        days,
        status,
        signature,
        signed_at,
      });
      setIsDirty(defaultsApplied);
    }
  }, [sheet, isManager, driverUserKey]);

  const prevWeekSheet = useMemo(() => {
    if (!sheetData.driver_name || !sheetData.week_starting) return null;
    const prevDateStr = getPreviousWeekSunday(sheetData.week_starting);
    return (
      allSheets.find(
        (s) =>
          s.id !== sheetId &&
          s.driver_name?.toLowerCase() === sheetData.driver_name?.toLowerCase() &&
          s.week_starting === prevDateStr
      ) || null
    );
  }, [allSheets, sheetData.driver_name, sheetData.week_starting, sheetId]);

  const unsignedPastWeeksForDriver = useUnsignedPastWeeks(
    isManager ? undefined : sessionDriverName || sheetData.driver_name
  );

  const { data: complianceHistoryRemote } = useQuery({
    queryKey: ["sheet", sheetId, "compliance-history"],
    queryFn: () => api.sheets.complianceHistory(sheetId),
    enabled: isManager && !!sheetId,
  });

  const complianceHistoryLocal = useMemo(() => {
    if (isManager || !sheetData.driver_name || !sheetData.week_starting) return null;
    return buildDriverComplianceWeekContext(sheetData.driver_name, sheetData.week_starting, allSheets);
  }, [isManager, sheetData.driver_name, sheetData.week_starting, allSheets]);

  const compliancePayload = useMemo(() => {
    const prevWeekDays = isManager
      ? (complianceHistoryRemote?.prev_week_days ?? prevWeekSheet?.days ?? null)
      : (complianceHistoryLocal?.prevWeekDays ?? prevWeekSheet?.days ?? null);
    return {
      days: sheetData.days,
      driverType: todayCrew.driver_type,
      prevWeekDays,
      historyDays: isManager
        ? (complianceHistoryRemote?.history_days ?? null)
        : (complianceHistoryLocal?.historyDays ?? null),
      last24hBreak: sheetData.last_24h_break || undefined,
      weekStarting: sheetData.week_starting || undefined,
      prevWeekStarting: isManager
        ? (complianceHistoryRemote?.prev_week_starting ?? prevWeekSheet?.week_starting ?? undefined)
        : (complianceHistoryLocal?.prevWeekStarting ?? prevWeekSheet?.week_starting ?? undefined),
      currentDayIndex,
      slotOffsetWithinToday: slotMinute,
      jurisdiction_code: sheetData.jurisdiction_code || DEFAULT_JURISDICTION_CODE,
    };
  }, [
    sheetData.days,
    todayCrew.driver_type,
    sheetData.jurisdiction_code,
    sheetData.last_24h_break,
    sheetData.week_starting,
    prevWeekSheet,
    complianceHistoryRemote,
    complianceHistoryLocal,
    currentDayIndex,
    slotMinute,
    isManager,
  ]);

  const localComplianceResults = useMemo(() => {
    if (!sheetData.days?.length || isManager) return [];
    return runLocalSheetComplianceCheck(compliancePayload);
  }, [isManager, sheetData.days?.length, compliancePayload]);

  const { data: complianceDataRemote, isLoading: complianceLoadingRemote } = useQuery({
    queryKey: ["compliance", sheetId, compliancePayload],
    queryFn: () => api.compliance.check(compliancePayload),
    enabled: isManager && !!sheetData.days?.length,
  });

  const complianceResults: ComplianceCheckResult[] = isManager
    ? (complianceDataRemote?.results ?? [])
    : localComplianceResults;
  const complianceLoading = isManager ? complianceLoadingRemote : false;

  /** Chronological record slices before this sheet — for rolling event timeline (7h gate, open segment). */
  const priorTimelineSlices = useMemo((): TimelineSlice[] => {
    const slices: TimelineSlice[] = [];
    if (compliancePayload.historyDays?.length) {
      slices.push(...compliancePayload.historyDays);
    }
    if (compliancePayload.prevWeekDays?.length) {
      slices.push(...compliancePayload.prevWeekDays);
    }
    return slices;
  }, [compliancePayload.historyDays, compliancePayload.prevWeekDays]);

  const hasComplianceViolations = complianceResults.some((r) => r.type === "violation");
  const hasComplianceWarnings = complianceResults.some((r) => r.type === "warning");
  const hasComplianceInfo = complianceResults.some((r) => r.type === "info");
  const complianceInfoNotes = useMemo(
    () => complianceResults.filter((r) => r.type === "info").map((r) => r.message),
    [complianceResults]
  );

  const driverDayTools = useMemo((): DayCardToolsConfig | undefined => {
    if (isManager) return undefined;
    const violations = complianceResults.filter((r) => r.type === "violation");
    const warnings = complianceResults.filter((r) => r.type === "warning");
    const infos = complianceResults.filter((r) => r.type === "info");
    const issueCount = violations.length + warnings.length;
    let complianceDetail = "All clear";
    let complianceTone: "ok" | "warn" | "issue" = "ok";
    if (issueCount > 0) {
      complianceTone = violations.length > 0 ? "issue" : "warn";
      complianceDetail = `${issueCount} need attention`;
    } else if (infos.length > 0) {
      complianceDetail = `${infos.length} optional note${infos.length === 1 ? "" : "s"}`;
    }
    return {
      sheetId,
      weekStarting: sheetData.week_starting,
      last24hBreak: sheetData.last_24h_break,
      complianceLoading,
      complianceDetail,
      complianceTone,
      unsignedPastWeeksCount: unsignedPastWeeksForDriver.length,
      onOpenGear: () => setGearDrawerOpen(true),
      driverName: driverPageIdentity.name,
    };
  }, [
    isManager,
    complianceResults,
    complianceLoading,
    sheetId,
    sheetData.week_starting,
    sheetData.last_24h_break,
    unsignedPastWeeksForDriver.length,
    driverPageIdentity.name,
  ]);

  const prospectiveWorkWarnings = useMemo(() => {
    if (!sheetData.days?.length || sheetData.status === "completed") return [];
    return getProspectiveWorkWarnings(
      sheetData.days,
      currentDayIndex,
      sheetData.week_starting,
      {
        driverType: todayCrew.driver_type,
        prevWeekDays: compliancePayload.prevWeekDays ?? null,
        historyDays: compliancePayload.historyDays ?? null,
        last24hBreak: sheetData.last_24h_break || undefined,
        prevWeekStarting: compliancePayload.prevWeekStarting,
        jurisdictionCode: sheetData.jurisdiction_code,
      }
    );
  }, [
    sheetData.days,
    sheetData.week_starting,
    todayCrew.driver_type,
    sheetData.last_24h_break,
    sheetData.status,
    sheetData.jurisdiction_code,
    currentDayIndex,
    compliancePayload.prevWeekDays,
    compliancePayload.historyDays,
    compliancePayload.prevWeekStarting,
  ]);

  const prospectiveRouteHint = useMemo(() => {
    if (!sheetData.days?.length || sheetData.status === "completed") return null;
    const reg = buildRiskRegisterFromWeek(sheetData.days, {
      weekStarting: sheetData.week_starting,
      todayYmd: getRegulatoryTodayYmd(sheetData.jurisdiction_code),
      historyDays: compliancePayload.historyDays ?? null,
      prevWeekDays: compliancePayload.prevWeekDays,
      slotOffsetWithinToday: compliancePayload.slotOffsetWithinToday,
      currentDayIndex,
    });
    return reg.driverHint;
  }, [
    sheetData.days,
    sheetData.week_starting,
    sheetData.status,
    sheetData.jurisdiction_code,
    compliancePayload.historyDays,
    compliancePayload.prevWeekDays,
    compliancePayload.slotOffsetWithinToday,
    currentDayIndex,
  ]);

  const prospectiveLogMessages = useMemo(() => {
    const msgs = [...prospectiveWorkWarnings];
    if (prospectiveRouteHint) {
      msgs.unshift(prospectiveRouteHint);
    }
    return msgs;
  }, [prospectiveWorkWarnings, prospectiveRouteHint]);

  const rolling168hMetrics = useMemo(() => {
    if (!sheetData.days?.length || sheetData.status === "completed") return null;
    return complianceStateAt({
      historyDays: compliancePayload.historyDays ?? null,
      prevWeekDays: compliancePayload.prevWeekDays ?? null,
      currentWeekDays: sheetData.days,
      weekStarting: sheetData.week_starting,
      todayYmd: getRegulatoryTodayYmd(sheetData.jurisdiction_code),
      slotOffsetWithinToday: compliancePayload.slotOffsetWithinToday,
      currentDayIndex,
    }).rolling168h;
  }, [
    sheetData.days,
    sheetData.week_starting,
    sheetData.status,
    sheetData.jurisdiction_code,
    compliancePayload.historyDays,
    compliancePayload.prevWeekDays,
    compliancePayload.slotOffsetWithinToday,
    currentDayIndex,
  ]);

  const openComplianceDialog = useCallback(() => {
    setComplianceDialogOpen(true);
  }, []);

  const complianceHref = `/sheets/${sheetId}/compliance`;

  /** Scroll after LogBar modal closes so layout/refs are stable (Start shift blocked → "Go to today's card"). */
  const scrollToCurrentDayCard = useCallback(() => {
    const run = () => {
      const el =
        dayCardElsRef.current[currentDayIndex] ??
        (typeof document !== "undefined" ? document.getElementById(`fatigue-day-${currentDayIndex}`) : null);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.setTimeout(run, 120);
  }, [currentDayIndex]);

  const handleStartShiftBlocked = useCallback(
    (opts?: { openSetup?: boolean }) => {
      scrollToCurrentDayCard();
      if (opts?.openSetup) {
        setTodaySetupOpenRequest((n) => n + 1);
      }
    },
    [scrollToCurrentDayCard]
  );

  const handleTodayDetailsDialogClosed = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.scrollY < 12) {
      window.scrollTo(0, 0);
      setHeroExpandRequest((n) => n + 1);
    }
  }, []);

  const scrollToDayCard = useCallback(
    (dayIndex: number) => {
      if (groupDaysAroundToday) {
        if (dayIndex < currentDayIndex) setPriorWeekDaysExpanded(true);
        if (dayIndex > currentDayIndex) setFutureWeekDaysExpanded(true);
      }
      const run = () => {
        dayCardElsRef.current[dayIndex]?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      window.setTimeout(run, groupDaysAroundToday && dayIndex !== currentDayIndex ? 150 : 80);
    },
    [groupDaysAroundToday, currentDayIndex]
  );

  useEffect(() => {
    if (!sheetData?.days?.length || typeof window === "undefined") return;
    const match = window.location.hash.match(/^#fatigue-day-(\d+)$/);
    if (match) scrollToDayCard(Number(match[1]));
  }, [sheetData?.days?.length, scrollToDayCard]);

  const extendedDaysForShiftStreak = useMemo(() => {
    const prev = (prevWeekSheet?.days ?? []).slice(-3);
    return [...prev, ...sheetData.days];
  }, [prevWeekSheet?.days, sheetData.days]);

  const prevStreakCount = Math.min(3, (prevWeekSheet?.days ?? []).length);

  const getPatternWorkMinutesForCard = useCallback(
    (dayIndex: number) =>
      samePatternWorkMinutesEndingAt(extendedDaysForShiftStreak, prevStreakCount + dayIndex),
    [extendedDaysForShiftStreak, prevStreakCount]
  );

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<FatigueSheet>) => {
      return updateSheetOfflineFirst(sheetId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheet", sheetId] });
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      setIsDirty(false);
      setLastSaved(new Date());
    },
  });

  const saveStatus = saveMutation.isPending
    ? ("saving" as const)
    : isDirty
      ? ("dirty" as const)
      : lastSaved
        ? ("saved" as const)
        : null;

  const buildSavePayload = useCallback((): Partial<FatigueSheet> => {
    const d = sheetDataRef.current;
    return {
      jurisdiction_code: d.jurisdiction_code || DEFAULT_JURISDICTION_CODE,
      driver_name: d.driver_name,
      second_driver: d.second_driver,
      driver_type: d.driver_type,
      destination: null,
      last_24h_break: d.last_24h_break || undefined,
      week_starting: d.week_starting,
      days: d.days,
      status: d.status,
    };
  }, []);

  useEffect(() => {
    if (driverContentLocked || !isDirty || !sheetData.driver_name) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (saveMutation.isPending) return;
      saveMutation.mutate(buildSavePayload());
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [sheetData, isDirty, buildSavePayload, saveMutation.isPending, driverContentLocked]);

  // Best-effort: flush unsaved changes when user background/navigates away.
  useEffect(() => {
    const flush = () => {
      if (!isDirtyRef.current) return;
      const d = sheetDataRef.current;
      if (!canDriverEditSheetContent(d.week_starting, d.status, d.signature)) return;
      if (!d.driver_name) return;
      if (saveMutation.isPending) return;
      saveMutation.mutate(buildSavePayload());
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [buildSavePayload, saveMutation]);

  const handleHeaderChange = useCallback((updates: Partial<typeof sheetData>) => {
    if (driverContentLocked) return;
    setSheetData((prev) => {
      const next = { ...prev, ...updates };
      return { ...next, days: applyLast24hBreakNonWorkRule(next.days, next.week_starting, next.last_24h_break || undefined) };
    });
    setIsDirty(true);
  }, [driverContentLocked]);

  const driverSheetMetaProps = useMemo(
    () => ({
      last24hBreak: sheetData.last_24h_break,
      onLast24hBreakChange: (last_24h_break: string) => {
        handleHeaderChange({ last_24h_break });
      },
    }),
    [sheetData.last_24h_break, handleHeaderChange]
  );

  const handleDayUpdate = useCallback((dayIndex: number, dayData: DayData) => {
    if (driverContentLocked) return;
    setSheetData((prev) => {
      const newDays = [...prev.days];
      newDays[dayIndex] = dayData;
      const withGrids = deriveDaysWithRollover(newDays, prev.week_starting, {
        todayStr: getRegulatoryTodayYmd(prev.jurisdiction_code),
      });
      return { ...prev, days: applyLast24hBreakNonWorkRule(withGrids, prev.week_starting, prev.last_24h_break || undefined) };
    });
    setIsDirty(true);
  }, [driverContentLocked]);

  const handleOpenEndShiftCorrection = useCallback(
    async (dayIndex: number) => {
      if (driverContentLocked) return;
      const prev = sheetDataRef.current;
      const days = prev.days;
      const day = days[dayIndex];
      const startKms = day?.start_kms;
      if (startKms == null || (typeof startKms === "number" && Number.isNaN(startKms))) {
        window.alert("Please enter start km for this day before ending the shift.");
        return;
      }
      if (!dayHasOpenWorkOrBreakSegment(day)) {
        window.alert("This day has no open work or break to end on the record.");
        return;
      }
      const rego = (day?.truck_rego ?? "").trim();
      let serverMaxEndKms: number | null = null;
      if (rego) {
        try {
          const res = await api.sheets.regoMaxEndKms(rego, {
            excludeSheetId: sheetId,
            beforeWeekStarting: prev.week_starting || undefined,
          });
          serverMaxEndKms = res.maxEndKms;
        } catch {
          // Offline: validate with local data only when confirming
        }
      }
      const minAllowed = getMinAllowedStartKms(days, dayIndex, rego, serverMaxEndKms);
      if (minAllowed != null && startKms < minAllowed) {
        window.alert(
          `Start km (${startKms}) cannot be lower than the last recorded end km for this rego (${minAllowed}). Please correct start km on the day card first.`
        );
        return;
      }
      const sheetDayYmd = getSheetDayDateString(prev.week_starting, dayIndex);
      const stopTimeIso =
        suggestedEndShiftTimeAfterLastEvent(day ?? {}) ?? new Date().toISOString();
      setEndShiftError(null);
      setEndShiftEndKms(String(day?.end_kms ?? ""));
      setEndShiftStopHhmm(isoToLocalHHMM(stopTimeIso));
      setEndShiftDialog({
        dayIndex,
        sheetDayYmd,
        dayLabel: formatSheetDisplayDate(sheetDayYmd),
      });
    },
    [driverContentLocked, sheetId]
  );

  const handleEndShiftRequest = handleOpenEndShiftCorrection;

  const handleLogEvent = useCallback(
    (dayIndex: number, type: string) => {
    if (driverContentLocked) return;

    if (type === "work") {
      const prev = sheetDataRef.current;
      const timeline = concatenateTimelineSlices(priorTimelineSlices, prev.days);
      const driverEvents = getSheetOwnerEventsInOrder(timeline);
      const dayFields = getDayWithMergedRouteContext(
        prev.days,
        dayIndex,
        prev.week_starting,
        getRegulatoryTodayYmd(prev.jurisdiction_code),
        storedRouteDefaults
      );
      const blockReason = getWorkLogBlockReason(driverEvents, dayFields);
      if (blockReason) {
        window.alert(blockReason);
        if (dayIndex === currentDayIndex) {
          scrollToCurrentDayCard();
        }
        return;
      }
    }

    setSheetData((prev) => {
      const newDays = [...prev.days];
      const day = newDays[dayIndex];
      const events = day.events || [];
        const newEvent = { time: new Date().toISOString(), type };
      const newEvents = [...events, newEvent];
      newDays[dayIndex] = { ...day, events: newEvents };
      const withGrids = deriveDaysWithRollover(newDays, prev.week_starting, {
        todayStr: getRegulatoryTodayYmd(prev.jurisdiction_code),
      });
      return { ...prev, days: applyLast24hBreakNonWorkRule(withGrids, prev.week_starting, prev.last_24h_break || undefined) };
    });
    setIsDirty(true);
    getCurrentPosition(BEST_EFFORT_OPTIONS)
      .then((loc) => {
        if (!loc) return;
        setSheetData((prev) => {
          const newDays = [...prev.days];
          const day = newDays[dayIndex];
          const events = [...(day.events || [])];
          const last = events[events.length - 1];
          if (last) events[events.length - 1] = { ...last, lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy };
          newDays[dayIndex] = { ...day, events };
          return { ...prev, days: newDays };
        });
        setIsDirty(true);
      })
      .catch(() => {});
  },
  [driverContentLocked, priorTimelineSlices, currentDayIndex, scrollToCurrentDayCard, storedRouteDefaults]);

  const handleEndShiftConfirm = useCallback(async () => {
    if (endShiftDialog == null) return;
    setEndShiftError(null);
    const { dayIndex, sheetDayYmd } = endShiftDialog;
    const trimmed = endShiftEndKms.trim();
    if (trimmed === "") {
      setEndShiftError("End km is required.");
      return;
    }
    const endKmsParsed = Number(trimmed);
    if (Number.isNaN(endKmsParsed) || endKmsParsed < 0) {
      setEndShiftError("Enter a valid end km (0 or greater).");
      return;
    }
    if (!endShiftStopHhmm.trim()) {
      setEndShiftError("Enter when you finished work.");
      return;
    }
    const stopTimeIso = hhmmOnSheetDayToIso(sheetDayYmd, endShiftStopHhmm);
    const days = sheetDataRef.current.days;
    const day = days[dayIndex];
    const timeCheck = validateCorrectEndShiftTime(day, sheetDayYmd, stopTimeIso);
    if (!timeCheck.valid) {
      setEndShiftError(timeCheck.message);
      return;
    }
    const startKms = day?.start_kms ?? null;
    const rego = (day?.truck_rego ?? "").trim();
    let serverMaxEndKms: number | null = null;
    if (rego) {
      try {
        const res = await api.sheets.regoMaxEndKms(rego, {
          excludeSheetId: sheetId,
          beforeWeekStarting: sheetDataRef.current.week_starting || undefined,
        });
        serverMaxEndKms = res.maxEndKms;
      } catch {
        // Offline or error: validate with local data only
      }
    }
    const validation = validateDayKms(days, dayIndex, rego, startKms, endKmsParsed, serverMaxEndKms);
    if (!validation.valid) {
      setEndShiftError(validation.message ?? "Invalid km.");
      return;
    }
    const markRouteOn = routeConfirmDayAfterPriorEndShift(dayIndex, currentDayIndex);
    let daysAfterEndShift: DayData[] | null = null;
    setSheetData((prev) => {
      const corrected = applyStopAtCorrectedTime(prev.days, dayIndex, stopTimeIso, endKmsParsed, {
        markRouteConfirmedOnDayIndex: markRouteOn,
      });
      const withGrids = deriveDaysWithRollover(corrected, prev.week_starting, {
        todayStr: getRegulatoryTodayYmd(prev.jurisdiction_code),
      });
      const finalDays = applyLast24hBreakNonWorkRule(withGrids, prev.week_starting, prev.last_24h_break || undefined);
      daysAfterEndShift = finalDays;
      return { ...prev, days: finalDays };
    });
    setIsDirty(true);
    setEndShiftDialog(null);
    setEndShiftEndKms("");
    setEndShiftStopHhmm("");
    if (daysAfterEndShift && shouldEducateAfterEndShift(daysAfterEndShift, dayIndex)) {
      setShiftPatternPrompt({ dayIndex });
    }
    getCurrentPosition(BEST_EFFORT_OPTIONS)
      .then((loc) => {
        if (!loc) return;
        setSheetData((prev) => {
          const newDays = [...prev.days];
          const d = newDays[dayIndex];
          const events = [...(d.events || [])];
          const last = events[events.length - 1];
          if (last) events[events.length - 1] = { ...last, lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy };
          newDays[dayIndex] = { ...d, events };
          return { ...prev, days: newDays };
        });
        setIsDirty(true);
      })
      .catch(() => {});
  }, [endShiftDialog, endShiftEndKms, endShiftStopHhmm, sheetId, currentDayIndex]);

  const handleShiftPatternSave = useCallback(
    (todayShift: ShiftLabel | "", tomorrowShift: ShiftLabel | "") => {
      if (shiftPatternPrompt == null) return;
      const dayIndex = shiftPatternPrompt.dayIndex;
      setSheetData((prev) => {
        const newDays = [...prev.days];
        if (todayShift) {
          newDays[dayIndex] = { ...newDays[dayIndex], shift_label: todayShift };
        }
        if (tomorrowShift && dayIndex < 6) {
          newDays[dayIndex + 1] = {
            ...newDays[dayIndex + 1],
            shift_label: tomorrowShift,
          };
        }
        return { ...prev, days: newDays };
      });
      setIsDirty(true);
      setShiftPatternPrompt(null);
    },
    [shiftPatternPrompt]
  );

  const fetchServerMaxByRego = useCallback(async (days: DayData[]) => {
    const regos = collectRegosNeedingKm(days);
    const weekStarting = sheetDataRef.current.week_starting;
    const serverMaxByRego: Record<string, number | null> = {};
    await Promise.all(
      regos.map(async (rego) => {
        try {
          const res = await api.sheets.regoMaxEndKms(rego, {
            excludeSheetId: sheetId,
            beforeWeekStarting: weekStarting || undefined,
          });
          serverMaxByRego[regoKey(rego)] = res.maxEndKms;
        } catch {
          serverMaxByRego[regoKey(rego)] = null;
        }
      })
    );
    return serverMaxByRego;
  }, [sheetId]);

  const applyDaysAfterKmChange = useCallback(
    (days: DayData[]) => {
      const withGrids = deriveDaysWithRollover(days, sheetDataRef.current.week_starting, {
        todayStr: getRegulatoryTodayYmd(sheetDataRef.current.jurisdiction_code),
      });
      return applyLast24hBreakNonWorkRule(
        withGrids,
        sheetDataRef.current.week_starting,
        sheetDataRef.current.last_24h_break || undefined
      );
    },
    []
  );

  const persistSheetFromRef = useCallback(() => {
    const data = sheetDataRef.current;
    saveMutation.mutate({
      ...buildSavePayload(),
      signature: data.signature || undefined,
      signed_at: data.signed_at || undefined,
    });
  }, [saveMutation, buildSavePayload]);

  const handleAutoFixKmForSign = useCallback(async () => {
    const prev = sheetDataRef.current;
    const chained = chainRegoKmsAcrossSheet(prev.days, signKmServerMax);
    const finalDays = applyDaysAfterKmChange(chained.days);
    setSheetData((s) => ({ ...s, days: finalDays }));
    setIsDirty(true);
    const err = validateSheetKms(finalDays, { serverMaxByRego: signKmServerMax });
    if (!err) {
      setSignKmFixIssues(null);
      if (kmFixPurpose === "save") {
        persistSheetFromRef();
      } else {
        setShowMarkCompleteConfirm(true);
      }
    } else {
      setSignKmFixIssues(getSheetKmIssues(finalDays, { serverMaxByRego: signKmServerMax }));
    }
  }, [applyDaysAfterKmChange, signKmServerMax, kmFixPurpose, persistSheetFromRef]);

  const handleSave = useCallback(async () => {
    const days = sheetDataRef.current.days;
    const serverMaxByRego = await fetchServerMaxByRego(days);
    setSignKmServerMax(serverMaxByRego);
    const issues = getSheetKmIssues(days, { serverMaxByRego });
    if (issues.length > 0) {
      setKmFixPurpose("save");
      setSignKmFixIssues(issues);
      setGearDrawerOpen(false);
      scrollToDayCard(issues[0]!.dayIndex);
      return;
    }
    setSignKmFixIssues(null);
    persistSheetFromRef();
  }, [fetchServerMaxByRego, persistSheetFromRef, scrollToDayCard]);

  const handleMarkCompleteClick = async () => {
    if (
      !canDriverAttestSheet(
        sheetDataRef.current.week_starting,
        sheetDataRef.current.status,
        sheetDataRef.current.signature
      )
    ) {
      window.alert(DRIVER_SIGN_WEEK_NOT_ENDED_ERROR);
      return;
    }
    const days = sheetDataRef.current.days;
    const serverMaxByRego = await fetchServerMaxByRego(days);
    const kmError = validateSheetKms(days, { serverMaxByRego });
    if (kmError) {
      if (!isManager) {
        setKmFixPurpose("sign");
        setSignKmServerMax(serverMaxByRego);
        setSignKmFixIssues(getSheetKmIssues(days, { serverMaxByRego }));
        return;
      }
      window.alert(kmError);
      return;
    }
    setShowMarkCompleteConfirm(true);
  };

  const handleMarkCompleteConfirm = () => {
    setShowMarkCompleteConfirm(false);
    setShowSignatureDialog(true);
  };

  const handleSignatureConfirm = (signatureDataUrl: string) => {
    const signedAt = new Date().toISOString();
    setSheetData((prev) => ({ ...prev, status: "completed", signature: signatureDataUrl, signed_at: signedAt }));
    setShowSignatureDialog(false);
    setIsDirty(false);
    const attestationOnly = isPastWeek && !isManager;
    saveMutation.mutate(
      attestationOnly
        ? {
            status: "completed",
            signature: signatureDataUrl,
            signed_at: signedAt,
          }
        : {
            driver_name: sheetData.driver_name,
            second_driver: sheetData.second_driver,
            driver_type: sheetData.driver_type,
            destination: null,
            last_24h_break: sheetData.last_24h_break || undefined,
            week_starting: sheetData.week_starting,
            days: sheetData.days,
            status: "completed",
            signature: signatureDataUrl,
            signed_at: signedAt,
          }
    );
  };

  const handleExportPdf = useCallback(() => {
    window.open(api.sheets.exportPdfUrl(sheetId), "_blank");
  }, [sheetId]);

  if (isLoading || !sheet) {
    return (
      <div
        className={cn(
          "min-h-screen bg-slate-50 dark:bg-slate-950",
          canShowLogBar
            ? "pb-[max(1.5rem,var(--driver-end-shift-height,0px))]"
            : "pb-6"
        )}
      >
        <div className="max-w-[1400px] mx-auto px-4 py-6">
          <PageHeader
            backHref={isManager ? "/manager" : "/sheets"}
            backLabel={isManager ? "Manager dashboard" : "Your Sheets"}
            title={PRODUCT_NAME}
            subtitle={TAGLINE_DRIVER}
            driverDisplayName={headerDriverDisplayName}
          />
          <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading sheet…</p>
          </div>
        </div>
      </div>
    );
  }

  const getDriverDayEntryExtras = (dayIndex: number) => {
    if (isManager) {
      return {
        driverType: sheetData.driver_type,
        driverName: driverPageIdentity.name,
      };
    }
    const isTodayCard = getSheetDayDateString(sheetData.week_starting, dayIndex) === todayYmd;
    const isCurrent = dayIndex === currentDayIndex;
    const crew = resolveDayCrew(sheetData.days[dayIndex], sheetData);
    return {
      ...driverSheetMetaProps,
      driverType: crew.driver_type,
      secondDriver: crew.second_driver,
      driverName: driverPageIdentity.name,
      onCrewMetaSync: isTodayCard
        ? (meta: { driver_type: "solo" | "two_up"; second_driver: string }) => {
            handleHeaderChange({
              driver_type: meta.driver_type,
              second_driver: meta.second_driver,
            });
          }
        : undefined,
      dayTools: isCurrent && isTodayCard ? driverDayTools : undefined,
      setupOpenRequest: isCurrent && isTodayCard ? todaySetupOpenRequest : undefined,
      onDetailsDialogClosed: isCurrent && isTodayCard ? handleTodayDetailsDialogClosed : undefined,
    };
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-slate-50 dark:bg-slate-950",
        canShowLogBar
          ? "pb-[max(1.5rem,var(--driver-end-shift-height,0px))]"
          : "pb-6"
      )}
    >
      {canShowLogBar && (
        <>
          <LogBar
            days={sheetData.days}
            currentDayIndex={currentDayIndex}
            weekStarting={sheetData.week_starting}
            priorTimelineSlices={priorTimelineSlices}
            onLogEvent={handleLogEvent}
            onEndShiftRequest={handleEndShiftRequest}
            workRelevantComplianceMessages={prospectiveLogMessages}
            complianceCheckResults={complianceResults}
            prospectiveRouteHint={prospectiveRouteHint}
            rolling168hMetrics={rolling168hMetrics}
            onStartShiftBlocked={handleStartShiftBlocked}
            heroExpandRequest={heroExpandRequest}
            currentDayDisplay={getDayWithMergedRouteContext(
              sheetData.days,
              currentDayIndex,
              sheetData.week_starting,
              todayYmd,
              storedRouteDefaults
            )}
            driverType={todayCrew.driver_type}
            reliefDriverName={todayCrew.second_driver}
            driverName={driverPageIdentity.name}
            forgottenActionReminder={forgottenActionReminder}
            isLiveNow={getSheetDayDateString(sheetData.week_starting, currentDayIndex) === todayYmd}
            complianceButton={{
              onClick: openComplianceDialog,
              hasViolations: hasComplianceViolations,
              hasWarnings: hasComplianceWarnings,
              loading: complianceLoading,
            }}
            onSessionDimmedChange={setDriverSessionDimmed}
            onShiftSegmentChange={setShiftSegmentOpen}
          />
          {!isManager && (
            <DriverGearDrawer
              returnHref={`/sheets/${sheetId}`}
              sheetId={sheetId}
              open={gearDrawerOpen}
              onOpenChange={setGearDrawerOpen}
              showSheetActions
              hideTrigger
              unsignedPastWeeks={!isPastWeek ? unsignedPastWeeksForDriver : []}
              optionalNotes={complianceInfoNotes}
              saveStatus={saveStatus}
              onSave={driverContentLocked ? undefined : handleSave}
              savePending={saveMutation.isPending}
              onMarkComplete={canDriverSign ? handleMarkCompleteClick : undefined}
              markCompleteLabel={isPastWeek ? "Sign record" : undefined}
              onExportPdf={handleExportPdf}
            />
          )}
        </>
      )}
      <div
        className={cn(
          "max-w-[1400px] mx-auto px-4",
          canShowLogBar ? "py-3 sm:py-4" : "py-6"
        )}
      >
        {!driverSessionDimmed && (
        <PageHeader
          backHref={sheetBackNav.href}
          backLabel={sheetBackNav.label}
          title={PRODUCT_NAME}
          subtitle={pageSubtitle}
          compact={canShowLogBar}
          driverDisplayName={headerDriverDisplayName}
          driverIdentity={driverPageIdentity}
          actions={
            sheetData.status === "completed" ? (
              <>
                <div className="w-full basis-full h-0" aria-hidden />
                <Link
                  href={complianceHref}
                  className={cn(
                    driverToolbarBtn,
                    hasComplianceViolations
                      ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800/50"
                      : "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800/50"
                  )}
                >
                  {hasComplianceViolations ? (
                    <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  )}
                  <span>Compliance</span>
                  <span className="font-medium">{hasComplianceViolations ? "Issues" : "OK"}</span>
                </Link>
              </>
            ) : null
          }
        />
        )}

        {saveMutation.isError &&
          (saveMutation.error as Error & { body?: { code?: string; sheet_id?: string } }).body?.code ===
            "PREVIOUS_WEEK_INCOMPLETE" && (
            <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-amber-800">
                {saveMutation.error instanceof Error ? saveMutation.error.message : "Save failed."}
              </p>
              {(saveMutation.error as Error & { body?: { sheet_id?: string } }).body?.sheet_id && (
                <Link
                  href={`/sheets/${(saveMutation.error as Error & { body?: { sheet_id?: string } }).body!.sheet_id}`}
                >
                  <Button variant="outline" size="sm" className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50">
                    Open that sheet
                  </Button>
                </Link>
              )}
            </div>
          )}

        <div ref={dayCardsRef} className="space-y-2 max-w-4xl">
            {isManager && (
              <>
                {sheetData.days?.length > 0 &&
                  (complianceLoading || hasComplianceViolations || hasComplianceWarnings) && (
                    <ComplianceAlertBar
                      sheetId={sheetId}
                      loading={complianceLoading}
                      results={complianceResults}
                    />
                  )}
                {sheetData.days?.length > 0 && !complianceLoading && hasComplianceInfo && (
                  <ComplianceNoticeBar results={complianceResults} />
                )}
              </>
            )}
            {isPastWeek && !isManager && weekOfLabel && (
              <SheetRecordBanner
                weekOfLabel={weekOfLabel}
                isPastWeek
                variant={canDriverSign ? "sign" : "archive"}
                onSign={canDriverSign ? handleMarkCompleteClick : undefined}
              />
            )}
            {isManager && !driverSessionDimmed && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 md:p-4">
              <SheetHeader
                sheetData={sheetData}
                onChange={handleHeaderChange}
                hidePrimaryDriverField
                readOnly={driverContentLocked}
                headerActions={
                    <>
                      {lastSaved && !isDirty && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                          <span className="hidden sm:inline">
                            Saved{" "}
                            {lastSaved.toLocaleTimeString("en-AU", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </span>
                        </span>
                      )}
                      {isDirty && !saveMutation.isPending && !driverContentLocked && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
                          Unsaved changes
                        </span>
                      )}
                      {sheetData.status === "completed" && (
                        <Badge
                          variant="outline"
                          className="border-emerald-300 text-emerald-600 flex items-center gap-1 shrink-0 h-7"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </Badge>
                      )}
                      <DriverSheetActions
                        sheetId={sheetId}
                        onSave={driverContentLocked ? undefined : handleSave}
                        savePending={saveMutation.isPending}
                        onMarkComplete={canDriverSign ? handleMarkCompleteClick : undefined}
                        markCompleteLabel={isPastWeek ? "Sign record" : undefined}
                        onExportPdf={handleExportPdf}
                      />
                    </>
                }
              />
              {matchedRosterPrimary && (
                <CvdMedicalBanner
                  driverLabel={matchedRosterPrimary.name}
                  roleLabel={undefined}
                  expiryYmd={matchedRosterPrimary.cvd_medical_expiry}
                  canAccessManager={canAccessManager}
                />
              )}
              {sheetData.driver_type === "two_up" && matchedRosterSecond && (
                <CvdMedicalBanner
                  driverLabel={matchedRosterSecond.name}
                  roleLabel="Relief driver"
                  expiryYmd={matchedRosterSecond.cvd_medical_expiry}
                  canAccessManager={canAccessManager}
                />
              )}
            </motion.div>
            )}
            {(groupDaysAroundToday
              ? [
                  ...(priorDayIndices.length > 0 ? (["prior-group"] as const) : []),
                  currentDayIndex,
                  ...(futureDayIndices.length > 0 ? (["future-group"] as const) : []),
                ]
              : sheetData.days.map((_, idx) => idx)
            ).map((item) => {
              if (item === "prior-group") {
                return (
                  <DayEntryWeekGroup
                    key="prior-group"
                    title={priorDaysGroupLabels.title}
                    subtitle={priorDaysGroupLabels.subtitle}
                    summary={priorDaysSummary}
                    expanded={priorWeekDaysExpanded}
                    onExpandedChange={setPriorWeekDaysExpanded}
                    readOnly={driverContentLocked}
                    variant="past"
                  >
                    {priorDayIndices.map((idx) => (
                      <div
                        key={idx}
                        id={`fatigue-day-${idx}`}
                        ref={(el) => {
                          dayCardElsRef.current[idx] = el;
                        }}
                        className={canShowLogBar ? "scroll-mt-[var(--driver-log-bar-height,20rem)]" : "scroll-mt-6"}
                      >
                        <DayEntry
                          dayIndex={idx}
                          dayData={getDayWithMergedRouteContext(
                            sheetData.days,
                            idx,
                            sheetData.week_starting,
                            todayYmd,
                            storedRouteDefaults
                          )}
                          continuedShiftRoute={getContinuedShiftRoutePrompt(
                            sheetData.days,
                            idx,
                            sheetData.week_starting,
                            todayYmd
                          )}
                          unclosedPriorShift={getPriorDayUnclosedShiftPrompt(
                            sheetData.days,
                            idx,
                            sheetData.week_starting,
                            todayYmd
                          )}
                          onEndShiftOnDay={handleEndShiftRequest}
                          onUpdate={handleDayUpdate}
                          weekStart={sheetData.week_starting}
                          regos={regos}
                          readOnly={driverContentLocked}
                          patternWorkMinutes={getPatternWorkMinutesForCard(idx)}
                          todayYmd={todayYmd}
                          allDays={sheetData.days}
                          sheetId={sheetId}
                          {...getDriverDayEntryExtras(idx)}
                        />
                      </div>
                    ))}
                  </DayEntryWeekGroup>
                );
              }
              if (item === "future-group") {
                return (
                  <DayEntryWeekGroup
                    key="future-group"
                    title={futureDaysGroupLabels.title}
                    subtitle={futureDaysGroupLabels.subtitle}
                    summary={futureDaysSummary}
                    expanded={futureWeekDaysExpanded}
                    onExpandedChange={setFutureWeekDaysExpanded}
                    readOnly={driverContentLocked}
                    variant="future"
                  >
                    {futureDayIndices.map((idx) => (
                      <div
                        key={idx}
                        id={`fatigue-day-${idx}`}
                        ref={(el) => {
                          dayCardElsRef.current[idx] = el;
                        }}
                        className={canShowLogBar ? "scroll-mt-[var(--driver-log-bar-height,20rem)]" : "scroll-mt-6"}
                      >
                        <DayEntry
                          dayIndex={idx}
                          dayData={getDayWithMergedRouteContext(
                            sheetData.days,
                            idx,
                            sheetData.week_starting,
                            todayYmd,
                            storedRouteDefaults
                          )}
                          continuedShiftRoute={getContinuedShiftRoutePrompt(
                            sheetData.days,
                            idx,
                            sheetData.week_starting,
                            todayYmd
                          )}
                          unclosedPriorShift={getPriorDayUnclosedShiftPrompt(
                            sheetData.days,
                            idx,
                            sheetData.week_starting,
                            todayYmd
                          )}
                          onEndShiftOnDay={handleEndShiftRequest}
                          onUpdate={handleDayUpdate}
                          weekStart={sheetData.week_starting}
                          regos={regos}
                          readOnly={driverContentLocked}
                          patternWorkMinutes={getPatternWorkMinutesForCard(idx)}
                          todayYmd={todayYmd}
                          allDays={sheetData.days}
                          sheetId={sheetId}
                          {...getDriverDayEntryExtras(idx)}
                        />
                      </div>
                    ))}
                  </DayEntryWeekGroup>
                );
              }
              const idx = item as number;
              return (
                <div
                  key={idx}
                  id={`fatigue-day-${idx}`}
                  ref={(el) => {
                    dayCardElsRef.current[idx] = el;
                  }}
                  className={canShowLogBar ? "scroll-mt-[var(--driver-log-bar-height,20rem)]" : "scroll-mt-6"}
                >
                  <DayEntry
                    dayIndex={idx}
                    dayData={getDayWithMergedRouteContext(
                      sheetData.days,
                      idx,
                      sheetData.week_starting,
                      todayYmd,
                      storedRouteDefaults
                    )}
                    continuedShiftRoute={getContinuedShiftRoutePrompt(
                      sheetData.days,
                      idx,
                      sheetData.week_starting,
                      todayYmd
                    )}
                    unclosedPriorShift={getPriorDayUnclosedShiftPrompt(
                      sheetData.days,
                      idx,
                      sheetData.week_starting,
                      todayYmd
                    )}
                    onEndShiftOnDay={handleEndShiftRequest}
                    onUpdate={handleDayUpdate}
                    weekStart={sheetData.week_starting}
                    regos={regos}
                    readOnly={driverContentLocked}
                    patternWorkMinutes={getPatternWorkMinutesForCard(idx)}
                    todayYmd={todayYmd}
                    collapseWhenNotToday={!groupDaysAroundToday}
                    allDays={sheetData.days}
                    sheetId={sheetId}
                    {...getDriverDayEntryExtras(idx)}
                  />
                </div>
              );
            })}
          {sheetData.signature && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm p-4"
            >
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Driver Signature
              </h2>
              <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800">
                <img src={sheetData.signature} alt="Driver signature" className="w-full h-auto" />
              </div>
              {sheetData.signed_at && (
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Signed{" "}
                  {new Date(sheetData.signed_at).toLocaleString("en-AU", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <ComplianceQuickDialog
        open={complianceDialogOpen}
        onOpenChange={setComplianceDialogOpen}
        sheetId={sheetId}
        loading={complianceLoading}
        results={complianceResults}
        driverName={driverPageIdentity.name}
      />
      <SignatureDialog
        open={showSignatureDialog}
        onConfirm={handleSignatureConfirm}
        onCancel={() => setShowSignatureDialog(false)}
        driverName={sheetData.driver_name}
      />
      <SignKmFixDialog
        open={signKmFixIssues != null && signKmFixIssues.length > 0}
        onOpenChange={(open) => !open && setSignKmFixIssues(null)}
        issues={signKmFixIssues ?? []}
        weekOfLabel={weekOfLabel || "this week"}
        purpose={kmFixPurpose}
        onAutoFixStartKm={handleAutoFixKmForSign}
        onGoToDay={scrollToDayCard}
      />
      <Dialog open={showMarkCompleteConfirm} onOpenChange={(open) => !open && setShowMarkCompleteConfirm(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              {isPastWeek ? `Sign week of ${weekOfLabel}` : "Mark sheet complete"}
            </DialogTitle>
            <DialogDescription>
              {isPastWeek
                ? "You are signing a past archive week, not the current logging week. Confirm the record is correct before you sign."
                : "You will sign to confirm. The sheet will be locked as complete. Make sure all entries are correct before continuing."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
            <Button variant="outline" className={driverDialogBtn} onClick={() => setShowMarkCompleteConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkCompleteConfirm} className={cn(driverDialogBtn, "gap-2 bg-emerald-600 hover:bg-emerald-700")}>
              <CheckCircle2 className="w-5 h-5" />
              Continue to sign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {shiftPatternPrompt != null && (
        <ShiftPatternEndShiftDialog
          open
          onOpenChange={(open) => !open && setShiftPatternPrompt(null)}
          todayLabel={formatSheetDisplayDate(
            getSheetDayDateString(sheetData.week_starting, shiftPatternPrompt.dayIndex)
          )}
          nextDayLabel={
            shiftPatternPrompt.dayIndex < 6
              ? formatSheetDisplayDate(
                  getSheetDayDateString(sheetData.week_starting, shiftPatternPrompt.dayIndex + 1)
                )
              : ""
          }
          onSave={handleShiftPatternSave}
        />
      )}
      <EndShiftCorrectionDialog
        open={!!endShiftDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEndShiftDialog(null);
            setEndShiftError(null);
          }
        }}
        dayLabel={endShiftDialog?.dayLabel ?? ""}
        stopTimeHhmm={endShiftStopHhmm}
        onStopTimeHhmmChange={(v) => {
          setEndShiftStopHhmm(v);
          setEndShiftError(null);
        }}
        endKms={endShiftEndKms}
        onEndKmsChange={(v) => {
          setEndShiftEndKms(v);
          setEndShiftError(null);
        }}
        error={endShiftError}
        onConfirm={handleEndShiftConfirm}
      />
    </div>
  );
}
