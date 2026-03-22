"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { type FatigueSheet } from "@/lib/api";
import { listSheetsOfflineFirst } from "@/lib/offline-api";
import { parseLocalDate } from "@/lib/weeks";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { format } from "date-fns";
import { signOut, useSession } from "next-auth/react";
import { getDisplayNameFromSession } from "@/lib/session-display-name";
import { Plus, FileText, Loader2, Clock, ChevronRight, Truck, LogOut, MessageSquare } from "lucide-react";

const LAST_SHEET_KEY = "fatigue-last-sheet-id";

function getTotalWorkHours(sheet: FatigueSheet) {
  if (!sheet.days) return 0;
  return sheet.days.reduce((total, day) => {
    const slots = (day.work_time || []).filter(Boolean).length;
    return total + slots * 0.5;
  }, 0);
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

  const backHref = backToSheetId ? `/sheets/${backToSheetId}` : undefined;
  const backLabel = backToSheetId ? "Current sheet" : undefined;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <PageHeader
            backHref={backHref}
            backLabel={backLabel}
            title="Driver Fatigue Log"
            subtitle="WA Commercial Vehicle Fatigue Management"
            driverDisplayName={driverDisplayName}
            icon={<Truck className="w-5 h-5" />}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="gap-2 text-slate-600 dark:text-slate-300"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </Button>
                <Link href="/driver/messages">
                  <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-300">
                    <MessageSquare className="w-4 h-4" />
                    Messages
                  </Button>
                </Link>
                <Link href="/sheets/new">
                  <Button className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white dark:text-slate-100 gap-2">
                    <Plus className="w-4 h-4" /> Start New Week
                  </Button>
                </Link>
              </div>
            }
          />
        </div>
        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-6">Your Sheets</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
          Complete and sign the current week&apos;s sheet before starting a new one.
        </p>
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
            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">No fatigue sheets yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              Start a new week to log work, breaks, and compliance. Create your first sheet to get started.
            </p>
            <Link href="/sheets/new">
              <Button className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white dark:text-slate-100 gap-2">
                <Plus className="w-4 h-4" />
                Create your first sheet
              </Button>
            </Link>
          </div>
        )}
        <div className="space-y-3">
          {sheets.map((sheet) => {
            const isActive = backToSheetId !== null && sheet.id === backToSheetId;
            return (
            <div
              key={sheet.id}
              className={`rounded-xl border-2 shadow-md transition-all ${
                isActive
                  ? "bg-slate-100 dark:bg-slate-800 border-slate-500 dark:border-slate-400 ring-2 ring-slate-400/30 dark:ring-slate-300/20 hover:shadow-lg hover:border-slate-600 dark:hover:border-slate-300"
                  : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:shadow-lg hover:border-slate-400 dark:hover:border-slate-600"
              }`}
            >
              <Link href={`/sheets/${sheet.id}`} className="flex items-center justify-between p-4 md:p-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{sheet.driver_name || "Unnamed Driver"}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {sheet.week_starting && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                          Week of {format(parseLocalDate(sheet.week_starting), "dd MMM yyyy")}
                        </span>
                      )}
                      {sheet.destination && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">→ {sheet.destination}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden md:inline text-sm font-mono text-slate-500 dark:text-slate-400">
                    {getTotalWorkHours(sheet)}h
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${
                      sheet.status === "completed"
                        ? "border-emerald-300 text-emerald-600"
                        : "border-slate-200 text-slate-400"
                    }`}
                  >
                    {sheet.status === "completed" ? "Done" : "Draft"}
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
