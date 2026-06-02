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
import { getDisplayNameFromSession } from "@/lib/session-display-name";
import { formatSheetDisplayDate, getPreviousWeekSunday, getRegulatoryTodayYmd } from "@/lib/weeks";
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
  const { data: session } = useSession();
  const isManager = (session?.user as { role?: string | null } | undefined)?.role === "manager";

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
  });

  const { data: allSheets = [] } = useQuery({
    queryKey: ["sheets"],
    queryFn: () => listSheetsOfflineFirst(),
  });

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

  const compliancePayload = useMemo(() => {
    if (!sheet?.days?.length) return null;
    return {
      days: sheet.days,
      driverType: sheet.driver_type,
      prevWeekDays: prevWeekSheet?.days ?? null,
      last24hBreak: sheet.last_24h_break || undefined,
      weekStarting: sheet.week_starting || undefined,
      prevWeekStarting: prevWeekSheet?.week_starting ?? undefined,
      currentDayIndex,
      slotOffsetWithinToday: getSlotOffsetWithinTodayLocal(Date.now(), sheet.jurisdiction_code),
      jurisdiction_code: sheet.jurisdiction_code || DEFAULT_JURISDICTION_CODE,
    };
  }, [sheet, prevWeekSheet, currentDayIndex]);

  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: ["compliance", sheetId, compliancePayload],
    queryFn: () => api.compliance.check(compliancePayload!),
    enabled: !!compliancePayload,
  });

  const onScrollToDay = useCallback(
    (dayIndex: number) => {
      router.push(`/sheets/${sheetId}#fatigue-day-${dayIndex}`);
    },
    [router, sheetId]
  );

  const weekLabel = sheet?.week_starting ? formatSheetDisplayDate(sheet.week_starting) : "";

  const driverDisplayName = isManager
    ? undefined
    : getDisplayNameFromSession(session ?? null) || (sheet?.driver_name || "").trim() || undefined;

  if (isLoading || !sheet) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-6">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <PageHeader
            backHref={`/sheets/${sheetId}`}
            backLabel="Back to sheet"
            title="Compliance check"
            subtitle="Loading…"
            driverDisplayName={driverDisplayName}
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
          subtitle={[PRODUCT_NAME, weekLabel && `Week of ${weekLabel}`].filter(Boolean).join(" · ")}
          driverDisplayName={driverDisplayName}
          icon={<ShieldCheck className="w-5 h-5" />}
        />
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 md:p-5">
          <CompliancePanel
            days={sheet.days ?? []}
            driverType={sheet.driver_type}
            prevWeekDays={prevWeekSheet?.days ?? null}
            last24hBreak={sheet.last_24h_break || undefined}
            weekStarting={sheet.week_starting || undefined}
            prevWeekStarting={prevWeekSheet?.week_starting ?? undefined}
            complianceResults={complianceData?.results ?? null}
            complianceLoading={complianceLoading}
            onScrollToDay={onScrollToDay}
          />
        </div>
      </div>
    </div>
  );
}
