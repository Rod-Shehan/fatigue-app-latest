"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PRODUCT_NAME } from "@/lib/branding";
import CompliancePanel from "@/components/fatigue/CompliancePanel";
import { getSheetOfflineFirst, listSheetsOfflineFirst } from "@/lib/offline-api";
import { api } from "@/lib/api";
import { getSlotOffsetWithinTodayLocal } from "@/lib/compliance";
import { DEFAULT_JURISDICTION_CODE } from "@/lib/jurisdiction";
import {
  buildDriverComplianceWeekContext,
  runLocalSheetComplianceCheck,
} from "@/lib/sheet-compliance-local";
import { getDisplayNameFromSession } from "@/lib/session-display-name";
import { isFleetManagerRole } from "@/lib/roles";
import { resolveSheetDriverDisplayName } from "@/lib/sheet-driver-display-name";
import { formatSheetDisplayDate, getPreviousWeekSunday, getRegulatoryTodayYmd } from "@/lib/weeks";
import { last24hBreakEndMsFromIso } from "@/lib/last-24h-break-range";
import { useSession } from "next-auth/react";

function getCurrentDayIndex(weekStarting: string, todayYmd: string): number {
  const [ty, tm, td] = todayYmd.split("-").map(Number);
  const today = new Date(ty, tm - 1, td);
  if (!weekStarting) return today.getDay();
  const [y, m, d] = weekStarting.split("-").map(Number);
  const weekStart = new Date(y, m - 1, d);
  const diffDays = Math.round((today.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(6, diffDays));
}

export default function SheetCompliancePage({ sheetId }: { sheetId: string }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const sessionRole = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const isManager = isFleetManagerRole(sessionRole);

  useEffect(() => {
    if (sheetId) {
      try {
        sessionStorage.setItem("fatigue-last-sheet-id", sheetId);
      } catch {
        /* ignore */
      }
    }
  }, [sheetId]);

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

  const { data: complianceHistoryRemote } = useQuery({
    queryKey: ["sheet", sheetId, "compliance-history"],
    queryFn: () => api.sheets.complianceHistory(sheetId),
    enabled: isManager && !!sheetId,
  });

  const complianceHistoryLocal = useMemo(() => {
    if (isManager || !sheet?.driver_name || !sheet.week_starting) return null;
    return buildDriverComplianceWeekContext(sheet.driver_name, sheet.week_starting, allSheets);
  }, [isManager, sheet?.driver_name, sheet?.week_starting, allSheets]);

  const prevWeekSheet = useMemo(() => {
    if (!sheet?.week_starting || !sheet.driver_name) return null;
    const prevDateStr = getPreviousWeekSunday(sheet.week_starting);
    return (
      allSheets.find(
        (s) =>
          s.id !== sheetId &&
          s.driver_name?.toLowerCase() === sheet.driver_name?.toLowerCase() &&
          s.week_starting === prevDateStr
      ) ?? null
    );
  }, [allSheets, sheet, sheetId]);

  const todayYmd = getRegulatoryTodayYmd(sheet?.jurisdiction_code);
  const currentDayIndex = sheet?.week_starting
    ? getCurrentDayIndex(sheet.week_starting, todayYmd)
    : 0;

  const prevWeekDays = isManager
    ? (complianceHistoryRemote?.prev_week_days ?? prevWeekSheet?.days ?? null)
    : (complianceHistoryLocal?.prevWeekDays ?? prevWeekSheet?.days ?? null);
  const prevWeekStarting = isManager
    ? (complianceHistoryRemote?.prev_week_starting ?? prevWeekSheet?.week_starting ?? undefined)
    : (complianceHistoryLocal?.prevWeekStarting ?? prevWeekSheet?.week_starting ?? undefined);

  const compliancePayload = useMemo(() => {
    if (!sheet?.days?.length) return null;
    return {
      days: sheet.days,
      driverType: sheet.driver_type,
      prevWeekDays,
      historyDays: isManager
        ? (complianceHistoryRemote?.history_days ?? null)
        : (complianceHistoryLocal?.historyDays ?? null),
      last24hBreak: sheet.last_24h_break || undefined,
      last24hBreakEndMs: last24hBreakEndMsFromIso(sheet.last_24h_break_end),
      weekStarting: sheet.week_starting || undefined,
      prevWeekStarting,
      currentDayIndex,
      slotOffsetWithinToday: getSlotOffsetWithinTodayLocal(Date.now(), sheet.jurisdiction_code),
      jurisdiction_code: sheet.jurisdiction_code || DEFAULT_JURISDICTION_CODE,
    };
  }, [
    sheet,
    prevWeekDays,
    prevWeekStarting,
    complianceHistoryRemote,
    complianceHistoryLocal,
    currentDayIndex,
    isManager,
  ]);

  const localComplianceResults = useMemo(() => {
    if (!compliancePayload || isManager) return null;
    return runLocalSheetComplianceCheck(compliancePayload);
  }, [compliancePayload, isManager]);

  const { data: complianceDataRemote, isLoading: complianceLoadingRemote } = useQuery({
    queryKey: ["compliance", sheetId, compliancePayload],
    queryFn: () => api.compliance.check(compliancePayload!),
    enabled: isManager && !!compliancePayload,
  });

  const complianceResults = isManager ? (complianceDataRemote?.results ?? null) : localComplianceResults;
  const complianceLoading = isManager ? complianceLoadingRemote : false;

  const onScrollToDay = useCallback(
    (dayIndex: number) => {
      router.push(`/sheets/${sheetId}#fatigue-day-${dayIndex}`);
    },
    [router, sheetId]
  );

  const weekLabel = sheet?.week_starting ? formatSheetDisplayDate(sheet.week_starting) : "";

  const sheetDriverName = (sheet?.driver_name || "").trim();
  const sessionDriverNameForCompliance = getDisplayNameFromSession(session ?? null);

  const driverPageIdentity = useMemo(() => {
    const name = resolveSheetDriverDisplayName({
      sheetDriverName: sheetDriverName,
      sessionDisplayName: sessionDriverNameForCompliance,
      isFleetOversight: isManager,
      sessionLoading: sessionStatus === "loading",
    });
    if (!name || name === "—") return null;
    return { name, isManagerView: isManager };
  }, [isManager, sheetDriverName, sessionDriverNameForCompliance, sessionStatus]);

  const driverDisplayName = isManager
    ? undefined
    : sessionDriverNameForCompliance || sheetDriverName || undefined;

  const pageSubtitle = useMemo(() => {
    const parts: string[] = [];
    parts.push(PRODUCT_NAME);
    if (weekLabel) parts.push(`Week of ${weekLabel}`);
    return parts.join(" · ");
  }, [weekLabel]);

  if (isLoading || !sheet) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-6">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <PageHeader
            backHref={`/sheets/${sheetId}`}
            backLabel="Back to sheet"
            title="Compliance check"
            subtitle={pageSubtitle || "Loading…"}
            driverDisplayName={driverDisplayName}
            driverIdentity={driverPageIdentity ?? undefined}
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-3" />
            <p className="text-sm text-slate-500">Loading compliance…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader
          backHref={`/sheets/${sheetId}`}
          backLabel="Back to sheet"
          title="Compliance check"
          subtitle={pageSubtitle}
          driverDisplayName={driverDisplayName}
          driverIdentity={driverPageIdentity ?? undefined}
          icon={<ShieldCheck className="w-5 h-5" />}
        />
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 md:p-5">
          <CompliancePanel
            days={sheet.days ?? []}
            driverType={sheet.driver_type}
            prevWeekDays={prevWeekDays}
            last24hBreak={sheet.last_24h_break || undefined}
            weekStarting={sheet.week_starting || undefined}
            prevWeekStarting={prevWeekStarting}
            complianceResults={complianceResults}
            complianceLoading={complianceLoading}
            onScrollToDay={onScrollToDay}
          />
        </div>
      </div>
    </div>
  );
}
