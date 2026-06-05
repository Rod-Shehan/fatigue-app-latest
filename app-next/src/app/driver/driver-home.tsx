"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useDriverAuth } from "@/hooks/use-driver-auth";
import { Briefcase, ChevronRight, Coffee, Loader2, Moon, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DriverSettingsLink } from "@/components/driver/DriverSettingsLink";
import { DriverRoadsideProduceButton } from "@/components/driver/DriverRoadsideProduceButton";
import { InstallAndSetupCard } from "@/components/pwa/InstallAndSetupCard";
import { DeviceBackupRestoreBanner } from "@/components/pwa/DeviceBackupRestoreBanner";
import { useDeviceBackup } from "@/hooks/use-device-backup";
import { driverListRow, driverSectionLabel } from "@/components/driver/driver-ui-classes";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";
import { getDriverHomeShiftStatus, type DriverShiftActivity } from "@/lib/driver-home-status";
import { getSheetOfflineFirst, listSheetsOfflineFirst } from "@/lib/offline-api";
import { DEFAULT_JURISDICTION_CODE } from "@/lib/jurisdiction";
import {
  findSheetForWeekStarting,
  formatSheetDisplayDate,
  getRegulatoryTodayYmd,
  getSheetDayDateString,
  getThisWeekSunday,
} from "@/lib/weeks";

const ACTIVITY_ICON: Record<DriverShiftActivity, React.ComponentType<{ className?: string }>> = {
  idle: Moon,
  work: Briefcase,
  break: Coffee,
  stopped: Square,
};

function getCurrentDayIndex(weekStarting: string, todayYmd: string): number {
  const [ty, tm, td] = todayYmd.split("-").map(Number);
  const today = new Date(ty, tm - 1, td);
  if (!weekStarting) return today.getDay();
  const [y, m, d] = weekStarting.split("-").map(Number);
  const weekStart = new Date(y, m - 1, d);
  const diffDays = Math.round((today.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(6, diffDays));
}

export function DriverHome() {
  const { user, isOfflineSession } = useDriverAuth();
  const { restoreNotice, dismissRestoreNotice } = useDeviceBackup(user?.email);
  const driverName = user?.name?.trim() || (user?.email?.includes("@") ? user.email.split("@")[0] : "") || "";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const thisSunday = getThisWeekSunday();
  const todayYmd = getRegulatoryTodayYmd(DEFAULT_JURISDICTION_CODE);

  const { data: sheets, isLoading: sheetsLoading, isError } = useQuery({
    queryKey: ["sheets"],
    queryFn: () => listSheetsOfflineFirst(),
  });

  const currentWeekSheet = useMemo(
    () => (sheets ? findSheetForWeekStarting(sheets, thisSunday) : undefined),
    [sheets, thisSunday]
  );

  const sheetId = currentWeekSheet?.id;

  const { data: sheet, isLoading: sheetLoading } = useQuery({
    queryKey: ["sheet", sheetId],
    queryFn: () => getSheetOfflineFirst(sheetId!),
    enabled: !!sheetId,
  });

  const currentDayIndex = sheet?.week_starting
    ? getCurrentDayIndex(sheet.week_starting, todayYmd)
    : getCurrentDayIndex(thisSunday, todayYmd);

  const shiftStatus = useMemo(() => {
    if (!sheet?.days?.length) {
      return getDriverHomeShiftStatus([], currentDayIndex, thisSunday, todayYmd, now);
    }
    return getDriverHomeShiftStatus(
      sheet.days,
      currentDayIndex,
      sheet.week_starting || thisSunday,
      todayYmd,
      now
    );
  }, [sheet, currentDayIndex, thisSunday, todayYmd, now]);

  const continueHref = sheetId ? `/sheets/${sheetId}` : "/sheets/new";
  const weekLabel = formatSheetDisplayDate(thisSunday);
  const todayLabel = formatSheetDisplayDate(
    sheet?.week_starting
      ? getSheetDayDateString(sheet.week_starting, currentDayIndex)
      : todayYmd
  );

  const StatusIcon = ACTIVITY_ICON[shiftStatus.activity];
  const loading = sheetsLoading || (!!sheetId && sheetLoading);

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 px-4 text-center">
        <p className="text-slate-600 dark:text-slate-300">Could not load your records.</p>
        <Link href="/sheets">
          <Button variant="outline">Your weeks</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-slate-50/95 dark:border-slate-800 dark:bg-slate-950/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{PRODUCT_NAME}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {driverName ? `Hi, ${driverName}` : "Drive"}
              {isOfflineSession ? " · offline" : ""}
            </p>
          </div>
          <DriverSettingsLink />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-hidden />
            <p className="text-sm text-slate-500">Loading this week…</p>
          </div>
        ) : (
          <>
            <InstallAndSetupCard />

            {restoreNotice && (
              <DeviceBackupRestoreBanner
                weekCount={restoreNotice.weekCount}
                onDismiss={dismissRestoreNotice}
              />
            )}

            <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
              <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <p className={driverSectionLabel}>
                  This week · {weekLabel}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Today · {todayLabel}</p>
              </div>

              <div className="p-4 flex gap-3 items-start">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    shiftStatus.activity === "work"
                      ? "bg-blue-600 text-white"
                      : shiftStatus.activity === "break"
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                  }`}
                  aria-hidden
                >
                  <StatusIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-50 leading-tight">
                    {shiftStatus.headline}
                  </p>
                  {shiftStatus.detail && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{shiftStatus.detail}</p>
                  )}
                </div>
              </div>
            </div>

            <Link href={continueHref} className="block">
              <Button
                className="w-full h-14 text-base font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-md"
              >
                {sheetId ? "Continue logging" : "Open this week"}
                <ChevronRight className="w-5 h-5" />
              </Button>
            </Link>

            <DriverRoadsideProduceButton variant="primary" />

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <Link href="/sheets" className={cn(driverListRow, "justify-between")}>
                Your weeks
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
