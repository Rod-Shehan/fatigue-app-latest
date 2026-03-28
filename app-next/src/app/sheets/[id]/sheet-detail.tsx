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
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
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
import {
  Save,
  Loader2,
  CheckCircle2,
  ScrollText,
  XCircle,
  Download,
  LayoutDashboard,
  MessageSquare,
  Square,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import SheetHeader from "@/components/fatigue/SheetHeader";
import { CvdMedicalBanner } from "@/components/fatigue/CvdMedicalBanner";
import DayEntry from "@/components/fatigue/DayEntry";
import CompliancePanel from "@/components/fatigue/CompliancePanel";
import SignatureDialog from "@/components/fatigue/SignatureDialog";
import LogBar from "@/components/fatigue/LogBar";
import {
  deriveDaysWithRollover,
  applyLast24hBreakNonWorkRule,
  getEffectiveOpenActivityAtDayEnd,
} from "@/components/fatigue/EventLogger";
import {
  getSheetDayDateString,
  getPreviousWeekSunday,
  getRegulatoryTodayYmd,
  getThisWeekSunday,
  normalizeWeekDateString,
} from "@/lib/weeks";
import { getProspectiveWorkWarnings, getSlotOffsetWithinTodayLocal } from "@/lib/compliance";
import { getCurrentPosition, BEST_EFFORT_OPTIONS } from "@/lib/geo";
import { validateDayKms, getMinAllowedStartKms, validateSheetKms } from "@/lib/rego-kms-validation";
import { DEFAULT_JURISDICTION_CODE } from "@/lib/jurisdiction";
import { MINUTES_PER_DAY, normalizeDayCoverageArrays } from "@/lib/coverage/derive-minute-coverage";
import { getDisplayNameFromSession } from "@/lib/session-display-name";
import { formatUnsignedPastWeeksBlockMessage } from "@/lib/product-copy";

const EMPTY_DAY = (): DayData => ({
  day_label: "",
  date: "",
  truck_rego: "",
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

/**
 * Day card rego and start_km carry-over when the previous calendar day ended with open work/break
 * (same end-of-day rule as deriveDaysWithRollover). No carry after End shift or when previous day closed in non-work.
 */
function getDayWithCarriedOverCardInfo(
  days: DayData[],
  dayIndex: number,
  weekStarting: string,
  todayYmd: string
): DayData {
  const day = days[dayIndex] ?? {};
  if (dayIndex === 0) return day;
  const prev = days[dayIndex - 1];
  const dateStrPrev = getSheetDayDateString(weekStarting, dayIndex - 1);
  const openAtEnd = getEffectiveOpenActivityAtDayEnd(prev, dateStrPrev, todayYmd);
  if (openAtEnd == null) return day;
  const hasOwnRego = (day.truck_rego ?? "").toString().trim() !== "";
  const hasOwnStartKms = day.start_kms != null && !Number.isNaN(Number(day.start_kms));
  return {
    ...day,
    truck_rego: hasOwnRego ? day.truck_rego : (prev?.truck_rego ?? day.truck_rego ?? ""),
    start_kms: hasOwnStartKms ? day.start_kms : (prev?.start_kms ?? day.start_kms),
  };
}

/** Reminder when driver may have forgotten to log work / break / end shift. */
const WORK_BREAK_DUE_MIN = 5 * 60;
const WORK_FORGOT_END_SHIFT_MIN = 12 * 60;
const BREAK_COMPLETE_MIN = 20;
const BREAK_LONG_MIN = 60;

const AUTO_SAVE_DEBOUNCE_MS = 5000;

function getForgottenActionReminder(
  days: DayData[],
  currentDayIndex: number
): { message: string; variant: "break-due" | "end-shift" | "break-complete" | "break-long" } | null {
  const day = days[currentDayIndex];
  const events = day?.events ?? [];
  const last = events[events.length - 1];
  if (!last || last.type === "stop") return null;
  const elapsedMin = Math.floor((Date.now() - new Date(last.time).getTime()) / 60000);
  if (last.type === "work") {
    if (elapsedMin >= WORK_FORGOT_END_SHIFT_MIN)
      return { message: "Work has been running for 12+ hours. Tap End shift if you've finished.", variant: "end-shift" };
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

const MANAGER_LOGIN_HREF = `/login?callbackUrl=${encodeURIComponent("/manager")}&managerLogin=1`;

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
  const [endShiftDialog, setEndShiftDialog] = useState<{ dayIndex: number } | null>(null);
  const [endShiftEndKms, setEndShiftEndKms] = useState("");
  const [endShiftError, setEndShiftError] = useState<string | null>(null);
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
    if (sheetId) {
      try {
        sessionStorage.setItem("fatigue-last-sheet-id", sheetId);
      } catch {
        /* ignore */
      }
    }
  }, [sheetId]);
  const todayYmd = useMemo(
    () => getRegulatoryTodayYmd(sheetData.jurisdiction_code),
    [sheetData.jurisdiction_code, now]
  );

  const currentDayIndex = useMemo(
    () => getCurrentDayIndex(sheetData.week_starting, todayYmd),
    [sheetData.week_starting, todayYmd]
  );

  const forgottenActionReminder = useMemo(
    () => getForgottenActionReminder(sheetData.days, currentDayIndex),
    [sheetData.days, currentDayIndex, now]
  );

  // Re-derive time grids every minute so non-work accumulates in real-time on the current day
  useEffect(() => {
    setSheetData((prev) => {
      const reDerived = deriveDaysWithRollover(prev.days, prev.week_starting, {
        todayStr: getRegulatoryTodayYmd(prev.jurisdiction_code),
      });
      return { ...prev, days: applyLast24hBreakNonWorkRule(reDerived, prev.week_starting, prev.last_24h_break || undefined) };
    });
  }, [now]);

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

  /** Past weeks (before current Sunday) for this driver that are not signed — block new work until signed. */
  const unsignedPastWeeksForDriver = useMemo(() => {
    if (isManager) return [];
    const me = (sessionDriverName || sheetData.driver_name || "").trim().toLowerCase();
    if (!me) return [];
    const thisSun = getThisWeekSunday();
    return allSheets.filter((s) => {
      const primary = s.driver_name?.trim().toLowerCase();
      const second = s.second_driver?.trim().toLowerCase();
      const isMySheet = primary === me || second === me;
      return (
        isMySheet &&
        s.week_starting &&
        normalizeWeekDateString(s.week_starting) < thisSun &&
        s.status !== "completed"
      );
    });
  }, [allSheets, sheetData.driver_name, sessionDriverName, isManager]);

  const blockLoggingWorkReason = useMemo(() => {
    if (isManager || unsignedPastWeeksForDriver.length === 0) return null;
    return formatUnsignedPastWeeksBlockMessage(unsignedPastWeeksForDriver.length);
  }, [isManager, unsignedPastWeeksForDriver.length]);

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

  const scrollToCompliance = useCallback(() => {
    document.getElementById("compliance-check")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
    if (!isDirty || !sheetData.driver_name) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (saveMutation.isPending) return;
      saveMutation.mutate(buildSavePayload());
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [sheetData, isDirty, buildSavePayload, saveMutation.isPending]);

  // Best-effort: flush unsaved changes when user background/navigates away.
  useEffect(() => {
    const flush = () => {
      if (!isDirtyRef.current) return;
      const d = sheetDataRef.current;
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
    setSheetData((prev) => {
      const next = { ...prev, ...updates };
      return { ...next, days: applyLast24hBreakNonWorkRule(next.days, next.week_starting, next.last_24h_break || undefined) };
    });
    setIsDirty(true);
  }, []);

  const handleDayUpdate = useCallback((dayIndex: number, dayData: DayData) => {
    setSheetData((prev) => {
      const newDays = [...prev.days];
      newDays[dayIndex] = dayData;
      const withGrids = deriveDaysWithRollover(newDays, prev.week_starting, {
        todayStr: getRegulatoryTodayYmd(prev.jurisdiction_code),
      });
      return { ...prev, days: applyLast24hBreakNonWorkRule(withGrids, prev.week_starting, prev.last_24h_break || undefined) };
    });
    setIsDirty(true);
  }, []);

  const handleAssumeIdle = useCallback(() => {
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
  }, [currentDayIndex]);

  const handleLogEvent = useCallback(
    (dayIndex: number, type: string, driver?: "primary" | "second") => {
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
  []);

  const handleEndShiftRequest = useCallback(async (dayIndex: number) => {
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
      return { ...prev, days: applyLast24hBreakNonWorkRule(withGrids, prev.week_starting, prev.last_24h_break || undefined) };
    });
    setIsDirty(true);
    setEndShiftDialog(null);
    setEndShiftEndKms("");
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
    saveMutation.mutate({
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
    });
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
      {sheetData.status !== "completed" && (
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
            complianceButton={{
              onClick: scrollToCompliance,
              hasViolations: hasComplianceViolations,
              hasWarnings: hasComplianceWarnings,
              loading: complianceLoading,
            }}
            blockLoggingWorkReason={blockLoggingWorkReason}
          />
        </>
      )}
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <PageHeader
          backHref="/sheets"
          backLabel="Your Sheets"
          title={PRODUCT_NAME}
          subtitle={TAGLINE_DRIVER}
          driverDisplayName={headerDriverDisplayName}
          driverIdentity={driverPageIdentity}
          actions={
            sheetData.status === "completed" ? (
              <>
                <div className="w-full basis-full h-0" aria-hidden />
                <button
                  type="button"
                  onClick={scrollToCompliance}
                  className={`inline-flex items-center gap-1.5 shrink-0 h-8 sm:h-9 rounded-md border px-2.5 sm:px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 ${
                    hasComplianceViolations
                      ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800/50"
                      : "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800/50"
                  }`}
                  title={hasComplianceViolations ? "View compliance — issues found" : "View compliance — OK"}
                  aria-label={
                    hasComplianceViolations ? "Compliance: issues found — jump to details" : "Compliance: OK — jump to details"
                  }
                >
                  {hasComplianceViolations ? (
                    <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  )}
                  <span>Compliance</span>
                  <span className="font-medium">{hasComplianceViolations ? "Issues" : "OK"}</span>
                </button>
              </>
            ) : null
          }
        />

        <nav
          className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3"
          aria-label={`${PRODUCT_NAME} toolbar`}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 shrink-0"
                aria-label="File: save, mark complete, or export PDF"
              >
                File
                <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[11rem]">
              <DropdownMenuItem
                onSelect={() => {
                  handleSave();
                }}
                disabled={saveMutation.isPending}
                className="text-xs"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Save className="w-3.5 h-3.5 shrink-0" />
                )}
                Save
              </DropdownMenuItem>
              {sheetData.status !== "completed" && (
                <DropdownMenuItem
                  onSelect={() => {
                    handleMarkCompleteClick();
                  }}
                  className="text-xs"
                  title="Sign off this record when the week is finished"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Mark complete
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => {
                  handleExportPdf();
                }}
                className="text-xs"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div
            className="w-px h-7 shrink-0 self-center bg-slate-400/90 dark:bg-slate-600"
            aria-hidden
          />

          <Link
            href={`/sheets/${sheetId}/shift-log`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 text-xs text-slate-600 dark:text-slate-300 h-8 shrink-0"
            )}
          >
            <ScrollText className="w-3.5 h-3.5" />
            Shift Log
          </Link>

          <div
            className="w-px h-7 shrink-0 self-center bg-slate-400/90 dark:bg-slate-600"
            aria-hidden
          />

          <Link
            href={canAccessManager ? "/manager" : MANAGER_LOGIN_HREF}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 text-xs text-slate-600 dark:text-slate-300 h-8 shrink-0"
            )}
            title={
              canAccessManager
                ? "Manager dashboard"
                : "Sign in with a manager account to open the manager dashboard"
            }
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Manager
          </Link>

          <div
            className="w-px h-7 shrink-0 self-center bg-slate-400/90 dark:bg-slate-600"
            aria-hidden
          />

          <Link
            href="/driver/messages"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 text-xs text-slate-600 dark:text-slate-300 h-8 shrink-0"
            )}
            title="Messages with your manager"
            aria-label="Messages"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Message
          </Link>

          <div
            className="w-px h-7 shrink-0 self-center bg-slate-400/90 dark:bg-slate-600"
            aria-hidden
          />

          <div className="flex flex-wrap items-center gap-2 min-h-8">
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
            {isDirty && !saveMutation.isPending && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
                Unsaved changes
              </span>
            )}
            {sheetData.status === "completed" && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-600 flex items-center gap-1 shrink-0 h-7">
                <CheckCircle2 className="w-3 h-3" /> Completed
              </Badge>
            )}
          </div>
        </nav>

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

        <div className="flex flex-col lg:flex-row gap-6">
          <div ref={dayCardsRef} className="flex-1 space-y-4">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
              <SheetHeader sheetData={sheetData} onChange={handleHeaderChange} hidePrimaryDriverField />
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
                  className={sheetData.status !== "completed" ? "scroll-mt-48" : "scroll-mt-6"}
                >
                  <DayEntry
                    dayIndex={idx}
                    dayData={getDayWithCarriedOverCardInfo(sheetData.days, idx, sheetData.week_starting, todayYmd)}
                    onUpdate={handleDayUpdate}
                    weekStart={sheetData.week_starting}
                    regos={regos}
                    canEditTimes={canAccessManager && sheetData.status !== "completed"}
                    todayYmd={todayYmd}
                  />
                </div>
              ))}
          </div>
          <div id="compliance-check" className="w-full lg:w-80 shrink-0 scroll-mt-24">
            <div className="lg:sticky lg:top-6 space-y-4">
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 uppercase tracking-wider">Compliance Check</h2>
                <CompliancePanel
                  days={sheetData.days}
                  driverType={sheetData.driver_type}
                  prevWeekDays={prevWeekSheet?.days || null}
                  last24hBreak={sheetData.last_24h_break || undefined}
                  weekStarting={sheetData.week_starting || undefined}
                  prevWeekStarting={prevWeekSheet?.week_starting ?? undefined}
                  complianceResults={complianceData?.results ?? null}
                  complianceLoading={complianceLoading}
                />
              </motion.div>
              {sheetData.signature && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm p-4">
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
        </div>
      </div>

      <SignatureDialog
        open={showSignatureDialog}
        onConfirm={handleSignatureConfirm}
        onCancel={() => setShowSignatureDialog(false)}
        driverName={sheetData.driver_name}
      />
      <Dialog open={showMarkCompleteConfirm} onOpenChange={(open) => !open && setShowMarkCompleteConfirm(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Mark sheet complete
            </DialogTitle>
            <DialogDescription>
              You will sign to confirm. The sheet will be locked as complete. Make sure all entries are correct before continuing.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowMarkCompleteConfirm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleMarkCompleteConfirm} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Continue to sign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setEndShiftDialog(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleEndShiftConfirm} className="gap-1.5">
                <Square className="w-3.5 h-3.5" />
                End shift
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
