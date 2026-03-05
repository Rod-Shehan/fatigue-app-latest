"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getSheetOfflineFirst } from "@/lib/offline-api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, ArrowLeft } from "lucide-react";
import ShiftLogView from "@/components/fatigue/ShiftLogView";

const LAST_SHEET_KEY = "fatigue-last-sheet-id";

export default function ShiftLogPage({ sheetId }: { sheetId: string }) {
  useEffect(() => {
    if (sheetId) {
      try {
        sessionStorage.setItem(LAST_SHEET_KEY, sheetId);
      } catch {
        /* ignore */
      }
    }
  }, [sheetId]);

  const { data: sheet, isLoading } = useQuery({
    queryKey: ["sheet", sheetId],
    queryFn: () => getSheetOfflineFirst(sheetId),
  });

  if (isLoading || !sheet) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-6">
        <div className="max-w-[800px] mx-auto px-4 py-6">
          <PageHeader
            backHref={`/sheets/${sheetId}`}
            backLabel="Fatigue Record"
            title="Shift Log"
            subtitle="Loading…"
            icon={<FileText className="w-5 h-5" />}
          />
          <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading shift log…</p>
          </div>
        </div>
      </div>
    );
  }

  const days = sheet.days ?? [];
  const weekStarting = sheet.week_starting ?? "";

  const subtitle = [
    sheet.driver_name,
    weekStarting && `Week starting ${new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-6">
      <div className="max-w-[800px] mx-auto px-4 py-6">
        <PageHeader
          backHref={`/sheets/${sheetId}`}
          backLabel="Fatigue Record"
          title="Shift Log"
          subtitle={subtitle || undefined}
          icon={<FileText className="w-5 h-5" />}
        />
        <Link href={`/sheets/${sheetId}`} className="inline-flex mb-4">
          <Button variant="outline" size="sm" className="gap-1.5 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to fatigue record
          </Button>
        </Link>
        <ShiftLogView days={days} weekStarting={weekStarting} />
      </div>
    </div>
  );
}
