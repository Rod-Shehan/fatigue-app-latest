"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, type ComplianceCheckResult, type FatigueSheet, type DayData } from "@/lib/api";
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
import { Save, FileText, Loader2, CheckCircle2, ScrollText, XCircle, Download, LayoutDashboard, Square, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import SheetHeader from "@/components/fatigue/SheetHeader";
import DayEntry from "@/components/fatigue/DayEntry";
import CompliancePanel from "@/components/fatigue/CompliancePanel";
import SignatureDialog from "@/components/fatigue/SignatureDialog";
import LogBar from "@/components/fatigue/LogBar";
import { deriveDaysWithRollover, applyLast24hBreakNonWorkRule } from "@/components/fatigue/EventLogger";
import { getSheetDayDateString, getTodayLocalDateString } from "@/lib/weeks";
import { getProspectiveWorkWarnings } from "@/lib/compliance";
import { getCurrentPosition, BEST_EFFORT_OPTIONS } from "@/lib/geo";
import { validateDayKms, getMinAllowedStartKms, validateSheetKms } from "@/lib/rego-kms-validation";

const EMPTY_DAY = (): DayData => ({
  day_label: "",
  date: "",
  truck_rego: "",
  destination: "",
  start_kms: undefined,
  end_kms: undefined,
  work_time: Array(48).fill(false),
  breaks: Array(48).fill(false),
  non_work: Array(48).fill(false),
});

function getThisWeekSunday() {
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  return sunday.toISOString().split("T")[0];
}

/** Current day index (0–6) for the sheet week from device date; not user-selectable. */
function getCurrentDayIndex(weekStarting: string): number {
  if (!weekStarting) return new Date().getDay();
  const [y, m, d] = weekStarting.split("-").map(Number);
  const weekStart = new Date(y, m - 1, d);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((todayStart.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(6, diffDays));
}

/**
 * Day card rego and start_km carry-over: when the previous day did not end with "End shift"
 * and the same carry-over rule as work/break applies (this day is today or has events),
 * fill this day's truck_rego and start_kms from the previous day when this day has none.
 * Reset (no carry) when previous day ended with "End shift" or when carry-over rules don't apply.
 */
function getDayWithCarriedOverCardInfo(
  days: DayData[],
  dayIndex: number,
  weekStarting: string
): DayData {
  const day = days[dayIndex] ?? {};
  if (dayIndex === 0) return day;
  const prev = days[dayIndex - 1];
  const prevEvents = prev?.events ?? [];
  const lastPrev = prevEvents[prevEvents.length - 1];
  const prevEndedWithStop = lastPrev?.type === "stop";
  const dateStr = getSheetDayDateString(weekStarting, dayIndex);
  const isToday = dateStr === getTodayLocalDateString();
  const hasEvents = (day.events?.length ?? 0) > 0;
  const carryOverApplies = !prevEndedWithStop && (isToday || hasEvents);
  if (!carryOverApplies) return day;
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
      return { message: "Work has been running for 12+ hours. Tap End Shift if you've finished.", variant: "end-shift" };
    if (elapsedMin >= WORK_BREAK_DUE_MIN)
      return { message: "Time for your 20 min break — tap Break when you start.", variant: "break-due" };
    return null;
  }
  if (last.type === "break") {
    if (elapsedMin >= BREAK_LONG_MIN)
      return { message: "You've been on break for over an hour. Tap Work to resume or End Shift to finish.", variant: "break-long" };
    if (elapsedMin >= BREAK_COMPLETE_MIN)
      return { message: "Break complete — tap Work to resume or End Shift to finish.", variant: "break-complete" };
    return null;
  }
  return null;
}

export function SheetDetail({ sheetId }: { sheetId: string }) {
  const queryClient = useQueryClient();
  const [sheetData, setSheetData] = useState<{
    driver_name: string;
    second_driver: string;
    driver_type: string;
    destination: string;
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
    destination: "",
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
  const currentDayCardRef = useRef<HTMLDivElement | null>(null);

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
  const currentDayIndex = useMemo(
    () => getCurrentDayIndex(sheetData.week_starting),
    [sheetData.week_starting, now]
  );

  const forgottenActionReminder = useMemo(
    () => getForgottenActionReminder(sheetData.days, currentDayIndex),
    [sheetData.days, currentDayIndex, now]
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

  useEffect(() => {
    if (sheet) {
      const weekStart = sheet.week_starting || getThisWeekSunday();
      setSheetData({
        driver_name: sheet.driver_name || "",
        second_driver: sheet.second_driver || "",
        driver_type: sheet.driver_type || "solo",
        destination: sheet.destination || "",
        last_24h_break: sheet.last_24h_break || "",
        week_starting: weekStart,
        days: applyLast24hBreakNonWorkRule(
          deriveDaysWithRollover(
            (sheet.days || []).map((d) => ({ ...EMPTY_DAY(), ...d })),
            weekStart
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
    const currentStart = new Date(sheetData.week_starting);
    const expectedPrevStart = new Date(currentStart);
    expectedPrevStart.setDate(expectedPrevStart.getDate() - 7);
    const prevDateStr = expectedPrevStart.toISOString().split("T")[0];
    return (
      allSheets.find(
        (s) =>
          s.id !== sheetId &&
          s.driver_name?.toLowerCase() === sheetData.driver_name?.toLowerCase() &&
          s.week_starting === prevDateStr
      ) || null
    );
  }, [allSheets, sheetData.driver_name, sheetData.week_starting, sheetId]);

  const compliancePayload = useMemo(() => {
    const today = new Date(now);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const slotOffsetWithinToday = Math.min(
      48,
      Math.max(0, Math.floor((now - todayStart) / (30 * 60 * 1000)))
    );
    return {
      days: sheetData.days,
      driverType: sheetData.driver_type,
      prevWeekDays: prevWeekSheet?.days ?? null,
      last24hBreak: sheetData.last_24h_break || undefined,
      weekStarting: sheetData.week_starting || undefined,
      prevWeekStarting: prevWeekSheet?.week_starting ?? undefined,
      currentDayIndex,
      slotOffsetWithinToday,
    };
  }, [
    sheetData.days,
    sheetData.driver_type,
    sheetData.last_24h_break,
    sheetData.week_starting,
    prevWeekSheet,
    currentDayIndex,
    now,
  ]);
  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: ["compliance", sheetId, compliancePayload],
    queryFn: () => api.compliance.check(compliancePayload),
    enabled: !!sheetData.days?.length,
  });
  const complianceResults: ComplianceCheckResult[] = complianceData?.results ?? [];
  const hasComplianceViolations = complianceResults.some((r) => r.type === "violation");

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
      }
    );
  }, [
    sheetData.days,
    sheetData.week_starting,
    sheetData.driver_type,
    sheetData.last_24h_break,
    sheetData.status,
    currentDayIndex,
    prevWeekSheet?.days,
    prevWeekSheet?.week_starting,
  ]);

  const scrollToCompliance = useCallback(() => {
    document.getElementById("compliance-check")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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

  useEffect(() => {
    if (!isDirty || !sheetData.driver_name) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveMutation.mutate({
        driver_name: sheetData.driver_name,
        second_driver: sheetData.second_driver,
        driver_type: sheetData.driver_type,
        destination: sheetData.destination,
        last_24h_break: sheetData.last_24h_break || undefined,
        week_starting: sheetData.week_starting,
        days: sheetData.days,
        status: sheetData.status,
      });
    }, 30000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [sheetData, isDirty]);

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
      const withGrids = deriveDaysWithRollover(newDays, prev.week_starting);
      return { ...prev, days: applyLast24hBreakNonWorkRule(withGrids, prev.week_starting, prev.last_24h_break || undefined) };
    });
    setIsDirty(true);
  }, []);

  const handleAssumeIdle = useCallback(() => {
    setSheetData((prev) => {
      const newDays = [...prev.days];
      const day = newDays[currentDayIndex] ?? {};
      newDays[currentDayIndex] = { ...day, assume_idle_from: new Date().toISOString() };
      const withGrids = deriveDaysWithRollover(newDays, prev.week_starting);
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
      const withGrids = deriveDaysWithRollover(newDays, prev.week_starting);
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
      const withGrids = deriveDaysWithRollover(newDays, prev.week_starting);
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
      destination: sheetData.destination,
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
      destination: sheetData.destination,
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
            title="Fatigue Record"
            subtitle="WA Commercial Driver Fatigue Management"
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
            leadingIcon={<FileText className="w-5 h-5" />}
            workRelevantComplianceMessages={prospectiveWorkWarnings}
            onAssumeIdle={handleAssumeIdle}
            onStartShiftBlocked={() => currentDayCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            currentDayDisplay={getDayWithCarriedOverCardInfo(sheetData.days, currentDayIndex, sheetData.week_starting)}
            driverType={sheetData.driver_type}
            primaryDriverName={sheetData.driver_name}
            secondDriverName={sheetData.second_driver}
          />
          {forgottenActionReminder && (
            <div
              role="alert"
              className="mx-4 mt-2 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="flex-1 font-medium min-w-0">{forgottenActionReminder.message}</p>
              </div>
              {forgottenActionReminder.variant === "end-shift" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-200 w-full">Choose:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-800/50"
                    onClick={() => handleEndShiftRequest(currentDayIndex)}
                  >
                    <Square className="w-3.5 h-3.5" />
                    End shift at {new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs border-slate-400 dark:border-slate-500 text-slate-700 dark:text-slate-200 hover:bg-amber-100/50 dark:hover:bg-amber-800/30"
                    onClick={handleAssumeIdle}
                  >
                    Mark non-work from {new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <PageHeader
          backHref="/sheets"
          backLabel="Your Sheets"
          title="Fatigue Record"
          subtitle="WA Commercial Driver Fatigue Management"
          actions={
          <>
            <Link
              href="/manager"
              className="inline-flex items-center justify-center gap-1.5 shrink-0 h-8 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 sm:px-3 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Manager
            </Link>
            <Link
              href={`/sheets/${sheetId}/shift-log`}
              className="inline-flex items-center justify-center gap-1.5 shrink-0 h-8 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 sm:px-3 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ScrollText className="w-3.5 h-3.5" />
              Shift Log
            </Link>
            {lastSaved && !isDirty && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">Saved {lastSaved.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
              </span>
            )}
            {isDirty && !saveMutation.isPending && (
              <span className="text-[10px] text-amber-500 font-medium shrink-0">Unsaved changes</span>
            )}
            {sheetData.status === "completed" && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-600 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3" /> Completed
              </Badge>
            )}
            <div className="inline-flex flex-wrap items-center gap-2 shrink-0">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                size="sm"
                className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 text-xs"
              >
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </Button>
              {sheetData.status !== "completed" && (
                <Button
                  type="button"
                  onClick={handleMarkCompleteClick}
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark complete
                </Button>
              )}
              <Button
                type="button"
                onClick={handleExportPdf}
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs border-slate-300 dark:border-slate-600"
              >
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </Button>
            </div>
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
              aria-label={hasComplianceViolations ? "Compliance: issues found — jump to details" : "Compliance: OK — jump to details"}
            >
              {hasComplianceViolations ? (
                <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              )}
              <span>Compliance</span>
              <span className="font-medium">
                {hasComplianceViolations ? "Issues" : "OK"}
              </span>
            </button>
          </>
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

        <div className="flex flex-col lg:flex-row gap-6">
          <div ref={dayCardsRef} className="flex-1 space-y-4">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
              <SheetHeader sheetData={sheetData} onChange={handleHeaderChange} />
            </motion.div>
            {sheetData.days.map((day, idx) => (
                <div key={idx} ref={idx === currentDayIndex ? currentDayCardRef : null} className={sheetData.status !== "completed" ? "scroll-mt-48" : "scroll-mt-6"}>
                  <DayEntry
                    dayIndex={idx}
                    dayData={getDayWithCarriedOverCardInfo(sheetData.days, idx, sheetData.week_starting)}
                    onUpdate={handleDayUpdate}
                    weekStart={sheetData.week_starting}
                    regos={regos}
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
              Enter end odometer. This will log End Shift for today and switch to non-work time. Start km and end km are required; end km must not be lower than any previous entry for this rego.
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
