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
import { Loader2, CheckCircle2, XCircle, Square, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import SheetHeader from "@/components/fatigue/SheetHeader";
import { CvdMedicalBanner } from "@/components/fatigue/CvdMedicalBanner";
import DayEntry from "@/components/fatigue/DayEntry";
import { ComplianceAlertBar, ComplianceNoticeBar } from "@/components/fatigue/ComplianceAlertBar";
import { ComplianceQuickDialog } from "@/components/fatigue/ComplianceQuickDialog";
import SignatureDialog from "@/components/fatigue/SignatureDialog";
import LogBar from "@/components/fatigue/LogBar";
import { ShiftPatternEndShiftDialog } from "@/components/fatigue/ShiftPatternEndShiftDialog";
import { DriverComplianceStrip } from "@/components/driver/DriverComplianceStrip";
import { DriverRecordsStrip } from "@/components/driver/DriverRecordsStrip";
import { DriverGearDrawer } from "@/components/driver/DriverGearDrawer";
import { DriverSheetActions } from "@/components/driver/DriverSheetActions";
import { driverDialogBtn } from "@/components/driver/driver-ui-classes";
import { deriveDaysWithRollover, applyLast24hBreakNonWorkRule } from "@/components/fatigue/EventLogger";
import {
  getDayWithCarriedOverCardInfo,
  getContinuedShiftRoutePrompt,
} from "@/lib/day-route-carry";
import {
  formatSheetDisplayDate,
  getSheetDayDateString,
  getPreviousWeekSunday,
  getRegulatoryTodayYmd,
  getThisWeekSunday,
  isPastRegulatoryWeek,
  normalizeWeekDateString,
} from "@/lib/weeks";
import { canDriverEditSheetContent, canDriverLogOnSheet } from "@/lib/sheet-record";
import { SheetRecordBanner } from "@/components/fatigue/SheetRecordBanner";
import {
  consecutiveWorkDaysEndingAt,
  shouldEducateAfterEndShift,
  type ShiftLabel,
} from "@/lib/shift-change";
import { getProspectiveWorkWarnings, getSlotOffsetWithinTodayLocal } from "@/lib/compliance";
import { getCurrentPosition, BEST_EFFORT_OPTIONS } from "@/lib/geo";
import { validateDayKms, getMinAllowedStartKms, validateSheetKms } from "@/lib/rego-kms-validation";
import { DEFAULT_JURISDICTION_CODE } from "@/lib/jurisdiction";
import { MINUTES_PER_DAY, normalizeDayCoverageArrays } from "@/lib/coverage/derive-minute-coverage";
import { getDisplayNameFromSession } from "@/lib/session-display-name";
import { cn } from "@/lib/utils";
import {
  formatPastWeekArchiveSubtitle,
  formatSignBlockedPastWeekMessage,
} from "@/lib/product-copy";
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
      return { message: "No log updates for 7+ hours. Tap End shift if you've finished (or log Break if you stopped).", variant: "end-shift" };
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
  const [signBlockedMessage, setSignBlockedMessage] = useState<string | null>(null);
  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
  const [endShiftDialog, setEndShiftDialog] = useState<{ dayIndex: number } | null>(null);
  const [endShiftEndKms, setEndShiftEndKms] = useState("");
  const [endShiftError, setEndShiftError] = useState<string | null>(null);
  const [shiftPatternPrompt, setShiftPatternPrompt] = useState<{ dayIndex: number } | null>(null);
  /** LogBar work/break segment open — used to open large mobile tools on day-card tap. */
  const [shiftSegmentOpenForMobile, setShiftSegmentOpenForMobile] = useState(false);
  const [mobileLogToolsOpen, setMobileLogToolsOpen] = useState(false);
  const [gearDrawerOpen, setGearDrawerOpen] = useState(false);
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

  const forgottenActionReminder = useMemo(
    () => getForgottenActionReminder(sheetData.days, currentDayIndex, sheetData.week_starting, todayYmd),
    [sheetData.days, currentDayIndex, sheetData.week_starting, todayYmd, now]
  );

  const { data: sheet, isLoading } = useQuery({
    queryKey: ["sheet", sheetId],
    queryFn: () => getSheetOfflineFirst(sheetId),
  });

  const { data: allSheets = [] } = useQuery({
    queryKey: ["sheets"],
    queryFn: () => listSheetsOfflineFirst(),
  });

  const { data: regos = [] } = useQuery({
    queryKey: ["regos"],
    queryFn: () => listRegosOfflineFirst(),
  });

  const { data: rosterDrivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
  });

  const { data: session, status: sessionStatus } = useSession();
  const isManager = (session?.user as { role?: string | null } | undefined)?.role === "manager";

  const isPastWeek = useMemo(
    () => isPastRegulatoryWeek(sheetData.week_starting),
    [sheetData.week_starting]
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
    () => !isManager && !sheetData.signature,
    [isManager, sheetData.signature]
  );

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
  }, [now, isManager]);

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
      setSheetData({
        driver_name: sheet.driver_name || "",
        second_driver: sheet.second_driver || "",
        driver_type: sheet.driver_type || "solo",
        jurisdiction_code: sheet.jurisdiction_code || DEFAULT_JURISDICTION_CODE,
        last_24h_break: sheet.last_24h_break || "",
        week_starting: weekStart,
        days: applyLast24hBreakNonWorkRule(
          deriveDaysWithRollover(
            (sheet.days || []).map((d) => normalizeDayCoverageArrays({ ...EMPTY_DAY(), ...d })),
            weekStart,
            { todayStr: getRegulatoryTodayYmd(sheet.jurisdiction_code || DEFAULT_JURISDICTION_CODE) }
          ),
          weekStart,
          sheet.last_24h_break || undefined
        ),
        status: sheet.status || "draft",
        signature: sheet.signature,
        signed_at: sheet.signed_at,
      });
      setIsDirty(false);
    }
  }, [sheet]);

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

  const compliancePayload = useMemo(() => {
    const slotOffsetWithinToday = getSlotOffsetWithinTodayLocal(now, sheetData.jurisdiction_code);
    return {
      days: sheetData.days,
      driverType: sheetData.driver_type,
      prevWeekDays: prevWeekSheet?.days ?? null,
      last24hBreak: sheetData.last_24h_break || undefined,
      weekStarting: sheetData.week_starting || undefined,
      prevWeekStarting: prevWeekSheet?.week_starting ?? undefined,
      currentDayIndex,
      slotOffsetWithinToday,
      jurisdiction_code: sheetData.jurisdiction_code || DEFAULT_JURISDICTION_CODE,
    };
  }, [
    sheetData.days,
    sheetData.driver_type,
    sheetData.jurisdiction_code,
    sheetData.last_24h_break,
    sheetData.week_starting,
    prevWeekSheet,
    currentDayIndex,
    now,
    sheetData.jurisdiction_code,
  ]);
  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: ["compliance", sheetId, compliancePayload],
    queryFn: () => api.compliance.check(compliancePayload),
    enabled: !!sheetData.days?.length,
  });
  const complianceResults: ComplianceCheckResult[] = complianceData?.results ?? [];
  const hasComplianceViolations = complianceResults.some((r) => r.type === "violation");
  const hasComplianceWarnings = complianceResults.some((r) => r.type === "warning");
  const hasComplianceInfo = complianceResults.some((r) => r.type === "info");
  const complianceInfoNotes = useMemo(
    () => complianceResults.filter((r) => r.type === "info").map((r) => r.message),
    [complianceResults]
  );

  const prospectiveWorkWarnings = useMemo(() => {
    if (!sheetData.days?.length || sheetData.status === "completed") return [];
    return getProspectiveWorkWarnings(
      sheetData.days,
      currentDayIndex,
      sheetData.week_starting,
      {
        driverType: sheetData.driver_type,
        prevWeekDays: prevWeekSheet?.days ?? null,
        last24hBreak: sheetData.last_24h_break || undefined,
        prevWeekStarting: prevWeekSheet?.week_starting ?? undefined,
        jurisdictionCode: sheetData.jurisdiction_code,
      }
    );
  }, [
    sheetData.days,
    sheetData.week_starting,
    sheetData.driver_type,
    sheetData.last_24h_break,
    sheetData.status,
    sheetData.jurisdiction_code,
    currentDayIndex,
    prevWeekSheet?.days,
    prevWeekSheet?.week_starting,
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

  const scrollToDayCard = useCallback((dayIndex: number) => {
    const run = () => {
      dayCardElsRef.current[dayIndex]?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.setTimeout(run, 80);
  }, []);

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

  const getConsecutiveWorkDaysForCard = useCallback(
    (dayIndex: number) =>
      consecutiveWorkDaysEndingAt(extendedDaysForShiftStreak, prevStreakCount + dayIndex),
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

  const handleAssumeIdle = useCallback(() => {
    if (driverContentLocked) return;
    setSheetData((prev) => {
      const newDays = [...prev.days];
      const day = newDays[currentDayIndex] ?? {};
      newDays[currentDayIndex] = { ...day, assume_idle_from: new Date().toISOString() };
      const withGrids = deriveDaysWithRollover(newDays, prev.week_starting, {
        todayStr: getRegulatoryTodayYmd(prev.jurisdiction_code),
      });
      return { ...prev, days: applyLast24hBreakNonWorkRule(withGrids, prev.week_starting, prev.last_24h_break || undefined) };
    });
    setIsDirty(true);
  }, [currentDayIndex, driverContentLocked]);

  const handleLogEvent = useCallback(
    (dayIndex: number, type: string, driver?: "primary" | "second") => {
    if (driverContentLocked) return;
    setSheetData((prev) => {
      const newDays = [...prev.days];
      const day = newDays[dayIndex];
      const events = day.events || [];
        const baseEvent: { time: string; type: string; driver?: "primary" | "second" } = {
          time: new Date().toISOString(),
          type,
        };
        const newEvent =
          type === "work" && prev.driver_type === "two_up"
            ? { ...baseEvent, driver: driver ?? "primary" }
            : baseEvent;
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
  [driverContentLocked]);

  const handleEndShiftRequest = useCallback(async (dayIndex: number) => {
    if (driverContentLocked) return;
    const days = sheetDataRef.current.days;
    const day = days[dayIndex];
    const startKms = day?.start_kms;
    if (startKms == null || (typeof startKms === "number" && Number.isNaN(startKms))) {
      window.alert("Please enter start km for today before ending the shift.");
      return;
    }
    const rego = (day?.truck_rego ?? "").trim();
    let serverMaxEndKms: number | null = null;
    if (rego) {
      try {
        const res = await api.sheets.regoMaxEndKms(rego);
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
    setEndShiftError(null);
    setEndShiftEndKms(String(sheetDataRef.current.days[dayIndex]?.end_kms ?? ""));
    setEndShiftDialog({ dayIndex });
  }, []);

  const handleEndShiftConfirm = useCallback(async () => {
    if (endShiftDialog == null) return;
    setEndShiftError(null);
    const dayIndex = endShiftDialog.dayIndex;
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
    const days = sheetDataRef.current.days;
    const day = days[dayIndex];
    const startKms = day?.start_kms ?? null;
    const rego = (day?.truck_rego ?? "").trim();
    let serverMaxEndKms: number | null = null;
    if (rego) {
      try {
        const res = await api.sheets.regoMaxEndKms(rego);
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
    let daysAfterEndShift: DayData[] | null = null;
    setSheetData((prev) => {
      const newDays = [...prev.days];
      const d = newDays[dayIndex];
      const events = d.events || [];
      const newEvent = { time: new Date().toISOString(), type: "stop" };
      const newEvents = [...events, newEvent];
      newDays[dayIndex] = { ...d, end_kms: endKmsParsed, events: newEvents };
      const withGrids = deriveDaysWithRollover(newDays, prev.week_starting, {
        todayStr: getRegulatoryTodayYmd(prev.jurisdiction_code),
      });
      const finalDays = applyLast24hBreakNonWorkRule(withGrids, prev.week_starting, prev.last_24h_break || undefined);
      daysAfterEndShift = finalDays;
      return { ...prev, days: finalDays };
    });
    setIsDirty(true);
    setEndShiftDialog(null);
    setEndShiftEndKms("");
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
  }, [endShiftDialog, endShiftEndKms]);

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

  const handleSave = () => {
    const kmError = validateSheetKms(sheetData.days);
    if (kmError) {
      window.alert(kmError);
      return;
    }
    saveMutation.mutate({
      driver_name: sheetData.driver_name,
      second_driver: sheetData.second_driver,
      driver_type: sheetData.driver_type,
      destination: null,
      last_24h_break: sheetData.last_24h_break || undefined,
      week_starting: sheetData.week_starting,
      days: sheetData.days,
      status: sheetData.status,
      signature: sheetData.signature || undefined,
      signed_at: sheetData.signed_at || undefined,
    });
  };

  const handleMarkCompleteClick = () => {
    const kmError = validateSheetKms(sheetData.days);
    if (kmError) {
      if (isPastWeek && !isManager) {
        setSignBlockedMessage(
          formatSignBlockedPastWeekMessage(kmError, weekOfLabel || "this week")
        );
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-6">
        <div className="max-w-[1400px] mx-auto px-4 py-6">
          <PageHeader
            backHref="/sheets"
            backLabel="Your Sheets"
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-6">
      {canShowLogBar && (
        <>
          <LogBar
            days={sheetData.days}
            currentDayIndex={currentDayIndex}
            weekStarting={sheetData.week_starting}
            onLogEvent={handleLogEvent}
            onEndShiftRequest={handleEndShiftRequest}
            workRelevantComplianceMessages={prospectiveWorkWarnings}
            onAssumeIdle={handleAssumeIdle}
            onStartShiftBlocked={scrollToCurrentDayCard}
            currentDayDisplay={getDayWithCarriedOverCardInfo(sheetData.days, currentDayIndex, sheetData.week_starting, todayYmd)}
            driverType={sheetData.driver_type}
            primaryDriverName={sheetData.driver_name}
            secondDriverName={sheetData.second_driver}
            forgottenActionReminder={forgottenActionReminder}
            isLiveNow={getSheetDayDateString(sheetData.week_starting, currentDayIndex) === todayYmd}
            complianceButton={{
              onClick: openComplianceDialog,
              hasViolations: hasComplianceViolations,
              hasWarnings: hasComplianceWarnings,
              loading: complianceLoading,
            }}
            onShiftSegmentChange={setShiftSegmentOpenForMobile}
            mobileToolsOpen={mobileLogToolsOpen}
            onMobileToolsOpenChange={setMobileLogToolsOpen}
          />
        </>
      )}
      <div
        className={cn(
          "max-w-[1400px] mx-auto px-4",
          canShowLogBar ? "py-3 sm:py-4" : "py-6"
        )}
      >
        <PageHeader
          backHref={isPastWeek ? "/sheets" : "/driver"}
          backLabel={isPastWeek ? "Your weeks" : "Drive home"}
          title={PRODUCT_NAME}
          subtitle={pageSubtitle}
          compact={canShowLogBar}
          driverDisplayName={headerDriverDisplayName}
          driverIdentity={canShowLogBar ? undefined : driverPageIdentity}
          actions={
            sheetData.status === "completed" ? (
              <>
                <div className="w-full basis-full h-0" aria-hidden />
                <Link
                  href={complianceHref}
                  className={`inline-flex items-center gap-1.5 shrink-0 min-h-[44px] h-11 sm:h-10 rounded-md border px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 ${
                    hasComplianceViolations
                      ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800/50"
                      : "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800/50"
                  }`}
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
            {!isManager ? (
              <>
                {sheetData.days?.length > 0 && (
                  <DriverComplianceStrip
                    sheetId={sheetId}
                    loading={complianceLoading}
                    results={complianceResults}
                  />
                )}
                {!isPastWeek && unsignedPastWeeksForDriver.length > 0 && (
                  <DriverRecordsStrip
                    count={unsignedPastWeeksForDriver.length}
                    onOpen={() => setGearDrawerOpen(true)}
                  />
                )}
              </>
            ) : (
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
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 md:p-4">
              <SheetHeader
                sheetData={sheetData}
                onChange={handleHeaderChange}
                hidePrimaryDriverField
                readOnly={driverContentLocked}
                headerActions={
                  isManager ? (
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
                  ) : (
                    <DriverGearDrawer
                      returnHref={`/sheets/${sheetId}`}
                      sheetId={sheetId}
                      open={gearDrawerOpen}
                      onOpenChange={setGearDrawerOpen}
                      showSheetActions
                      unsignedPastWeeks={!isPastWeek ? unsignedPastWeeksForDriver : []}
                      optionalNotes={complianceInfoNotes}
                      saveStatus={saveStatus}
                      onSave={driverContentLocked ? undefined : handleSave}
                      savePending={saveMutation.isPending}
                      onMarkComplete={canDriverSign ? handleMarkCompleteClick : undefined}
                      markCompleteLabel={isPastWeek ? "Sign record" : undefined}
                      onExportPdf={handleExportPdf}
                    />
                  )
                }
              />
              {matchedRosterPrimary && (
                <CvdMedicalBanner
                  driverLabel={matchedRosterPrimary.name}
                  roleLabel={sheetData.driver_type === "two_up" ? "Primary" : undefined}
                  expiryYmd={matchedRosterPrimary.cvd_medical_expiry}
                  canAccessManager={canAccessManager}
                />
              )}
              {sheetData.driver_type === "two_up" && matchedRosterSecond && (
                <CvdMedicalBanner
                  driverLabel={matchedRosterSecond.name}
                  roleLabel="Second"
                  expiryYmd={matchedRosterSecond.cvd_medical_expiry}
                  canAccessManager={canAccessManager}
                />
              )}
            </motion.div>
            {sheetData.days.map((day, idx) => (
                <div
                  key={idx}
                  id={`fatigue-day-${idx}`}
                  ref={(el) => {
                    dayCardElsRef.current[idx] = el;
                  }}
                  className={canShowLogBar ? "scroll-mt-48" : "scroll-mt-6"}
                  onPointerDown={(e) => {
                    if (!canShowLogBar) return;
                    if (!shiftSegmentOpenForMobile || idx !== currentDayIndex) return;
                    const t = e.target;
                    if (!(t instanceof HTMLElement)) return;
                    if (
                      t.closest(
                        "input, textarea, select, button, a, label, [role='button'], [role='slider'], canvas"
                      )
                    ) {
                      return;
                    }
                    setMobileLogToolsOpen(true);
                  }}
                >
                <DayEntry
                  dayIndex={idx}
                  dayData={getDayWithCarriedOverCardInfo(sheetData.days, idx, sheetData.week_starting, todayYmd)}
                  continuedShiftRoute={getContinuedShiftRoutePrompt(
                    sheetData.days,
                    idx,
                    sheetData.week_starting,
                    todayYmd
                  )}
                  onUpdate={handleDayUpdate}
                  weekStart={sheetData.week_starting}
                  regos={regos}
                  readOnly={driverContentLocked}
                  consecutiveWorkDays={getConsecutiveWorkDaysForCard(idx)}
                  todayYmd={todayYmd}
                  allDays={sheetData.days}
                  sheetId={sheetId}
                  driverType={sheetData.driver_type}
                />
                </div>
              ))}
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
      />
      <SignatureDialog
        open={showSignatureDialog}
        onConfirm={handleSignatureConfirm}
        onCancel={() => setShowSignatureDialog(false)}
        driverName={sheetData.driver_name}
      />
      <Dialog open={!!signBlockedMessage} onOpenChange={(open) => !open && setSignBlockedMessage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Cannot sign this past week yet
            </DialogTitle>
            <DialogDescription className="text-left">{signBlockedMessage}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-end pt-2">
            <Button variant="outline" className={driverDialogBtn} onClick={() => setSignBlockedMessage(null)}>
              Close
            </Button>
            <Link href="/sheets" className="w-full sm:w-auto">
              <Button variant="outline" className={driverDialogBtn}>
                Your weeks
              </Button>
            </Link>
            <Link href="/driver" className="w-full sm:w-auto">
              <Button className={cn(driverDialogBtn, "bg-emerald-600 hover:bg-emerald-700")}>
                Current week
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
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
      <Dialog open={!!endShiftDialog} onOpenChange={(open) => !open && setEndShiftDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="w-5 h-5" />
              End shift
            </DialogTitle>
            <DialogDescription>
              Enter end odometer. This will log End shift for today and switch to non-work time. Start km and end km are required; end km must not be lower than any previous entry for this rego.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Label htmlFor="end-shift-kms" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              End km (required)
            </Label>
            <Input
              id="end-shift-kms"
              type="number"
              min={0}
              placeholder="e.g. 12345"
              value={endShiftEndKms}
              onChange={(e) => { setEndShiftEndKms(e.target.value); setEndShiftError(null); }}
              className="font-mono"
              aria-invalid={!!endShiftError}
              aria-describedby={endShiftError ? "end-shift-error" : undefined}
            />
            {endShiftError && (
              <p id="end-shift-error" className="text-xs text-red-600 dark:text-red-400" role="alert">
                {endShiftError}
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
              <Button variant="outline" className={driverDialogBtn} onClick={() => setEndShiftDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleEndShiftConfirm} className={cn(driverDialogBtn, "gap-2")}>
                <Square className="w-5 h-5" />
                End shift
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
