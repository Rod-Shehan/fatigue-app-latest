"use client";



import { useState, useEffect, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import Link from "next/link";

import { type FatigueSheet } from "@/lib/api";

import { getHours } from "@/lib/compliance";

import { formatHoursStatistic } from "@/lib/hours";

import { listSheetsOfflineFirst } from "@/lib/offline-api";

import { getThisWeekSunday, isPastRegulatoryWeek, normalizeWeekDateString, parseLocalDate } from "@/lib/weeks";

import { Button } from "@/components/ui/button";

import { PageHeader } from "@/components/PageHeader";

import { DriverMoreMenu } from "@/components/driver/DriverMoreMenu";

import { PRODUCT_NAME, TAGLINE_DRIVER } from "@/lib/branding";

import { SHEETS_LIST_TAGLINE } from "@/lib/product-copy";

import { format } from "date-fns";

import { useSession } from "next-auth/react";

import { getDisplayNameFromSession } from "@/lib/session-display-name";

import { FileText, Loader2, ChevronRight, Truck, Clock, BookOpen } from "lucide-react";



const LAST_SHEET_KEY = "fatigue-last-sheet-id";



function getTotalWorkHours(sheet: FatigueSheet) {

  if (!sheet.days) return 0;

  return sheet.days.reduce((total, day) => total + getHours(day.work_time), 0);

}



export function SheetsList() {

  const { data: session } = useSession();

  const driverDisplayName = getDisplayNameFromSession(session ?? null) || undefined;

  const [backToSheetId, setBackToSheetId] = useState<string | null>(null);

  useEffect(() => {

    try {

      const id = sessionStorage.getItem(LAST_SHEET_KEY);

      if (id) setBackToSheetId(id);

    } catch {

      /* ignore */

    }

  }, []);



  const { data: sheets = [], isLoading } = useQuery({

    queryKey: ["sheets"],

    queryFn: () => listSheetsOfflineFirst(),

  });



  const thisSunday = getThisWeekSunday();

  const currentWeekSheet = useMemo(

    () =>

      sheets.find((s) => s.week_starting && normalizeWeekDateString(s.week_starting) === thisSunday) ?? null,

    [sheets, thisSunday]

  );



  const openThisWeekHref = currentWeekSheet ? `/sheets/${currentWeekSheet.id}` : "/sheets/new";

  const lastOpenedSheet = useMemo(
    () => (backToSheetId ? sheets.find((s) => s.id === backToSheetId) : null),
    [sheets, backToSheetId]
  );
  const lastOpenedIsCurrentWeek = Boolean(
    lastOpenedSheet?.week_starting &&
      normalizeWeekDateString(lastOpenedSheet.week_starting) === thisSunday
  );

  const backHref =
    backToSheetId && lastOpenedIsCurrentWeek ? `/sheets/${backToSheetId}` : "/driver";

  const backLabel =
    backToSheetId && lastOpenedIsCurrentWeek ? "This week" : "Drive home";



  return (

    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">

        <div className="mb-6">

          <PageHeader

            backHref={backHref}

            backLabel={backLabel}

            title={PRODUCT_NAME}

            subtitle={TAGLINE_DRIVER}

            driverDisplayName={driverDisplayName}

            icon={<Truck className="w-5 h-5" />}

            actions={

              <div className="flex flex-wrap items-center gap-2">

                <Link href={openThisWeekHref}>

                  <Button className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white dark:text-slate-100 gap-2 min-h-[44px] sm:min-h-9">

                    <Clock className="w-4 h-4" aria-hidden />

                    This week

                  </Button>

                </Link>

                <DriverMoreMenu />

              </div>

            }

          />

        </div>



        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">

          {SHEETS_LIST_TAGLINE}{" "}

          <Link href="/driver/help" className="text-slate-700 dark:text-slate-300 underline underline-offset-2">

            How it works

          </Link>

        </p>



        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 mt-6">

          Your weeks

        </h2>



        {isLoading && (

          <div className="flex justify-center py-20">

            <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />

          </div>

        )}

        {!isLoading && sheets.length === 0 && (

          <div className="text-center py-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6">

            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">

              <FileText className="w-7 h-7 text-slate-300 dark:text-slate-500" />

            </div>

            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">No weekly records yet</p>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">

              Open this week to start your record.

            </p>

            <Link href="/sheets/new">

              <Button className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white gap-2">

                <Clock className="w-4 h-4" />

                Open this week

              </Button>

            </Link>

            <p className="mt-4">

              <Link

                href="/driver/help"

                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"

              >

                <BookOpen className="w-3.5 h-3.5" />

                How your record works

              </Link>

            </p>

          </div>

        )}

        <div className="space-y-3">

          {sheets.map((sheet) => {

            const isActive = backToSheetId !== null && sheet.id === backToSheetId;

            const isCurrentWeek =

              sheet.week_starting && normalizeWeekDateString(sheet.week_starting) === thisSunday;

            const isPastWeek =
              sheet.week_starting && isPastRegulatoryWeek(sheet.week_starting, thisSunday);

            const statusLabel = isPastWeek
              ? sheet.signature
                ? "Signed"
                : "Needs signature"
              : sheet.status === "completed"
                ? "Signed"
                : "Open";

            return (

              <div

                key={sheet.id}

                className={`rounded-xl border-2 shadow-md transition-all ${

                  isActive

                    ? "bg-slate-100 dark:bg-slate-800 border-slate-500 dark:border-slate-400 ring-2 ring-slate-400/30 dark:ring-slate-300/20 hover:shadow-lg"

                    : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:shadow-lg hover:border-slate-400 dark:hover:border-slate-600"

                }`}

              >

                <Link href={`/sheets/${sheet.id}`} className="flex items-center justify-between p-4 md:p-5">

                  <div className="flex items-center gap-4 min-w-0">

                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">

                      <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />

                    </div>

                    <div className="min-w-0">

                      {sheet.week_starting && (

                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">

                          Week of {format(parseLocalDate(sheet.week_starting), "dd MMM yyyy")}

                        </p>

                      )}

                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">

                        {isCurrentWeek && (

                          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">

                            This week

                          </span>

                        )}

                        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono md:hidden">

                          {formatHoursStatistic(getTotalWorkHours(sheet))}h work

                        </span>

                      </div>

                    </div>

                  </div>

                  <div className="flex items-center gap-3 shrink-0">

                    <span className="hidden md:inline text-sm font-mono text-slate-500 dark:text-slate-400">

                      {formatHoursStatistic(getTotalWorkHours(sheet))}h

                    </span>

                    <span

                      className={`text-xs px-2 py-0.5 rounded border ${

                        statusLabel === "Signed"

                          ? "border-emerald-300 text-emerald-600 dark:text-emerald-400"

                          : statusLabel === "Needs signature"

                            ? "border-amber-300 text-amber-700 dark:text-amber-300"

                            : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400"

                      }`}

                    >

                      {statusLabel}

                    </span>

                    <ChevronRight className="w-4 h-4 text-slate-300" />

                  </div>

                </Link>

              </div>

            );

          })}

        </div>

      </div>

    </div>

  );

}

