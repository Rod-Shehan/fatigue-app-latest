"use client";

import Link from "next/link";
import { ChevronLeft, FileBadge } from "lucide-react";
import { DriverRoadsideProduceButton } from "@/components/driver/DriverRoadsideProduceButton";
import {
  ROADSIDE_PRODUCE_BUTTON_LABEL,
  ROADSIDE_PRODUCE_DAYS,
  ROADSIDE_PDF_DISCLAIMER,
} from "@/lib/roadside-pdf";
import { driverIconBtn } from "@/components/driver/driver-ui-classes";

export function DriverRoadsideProducePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-slate-50/95 dark:border-slate-800 dark:bg-slate-950/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <Link
            href="/driver"
            className={driverIconBtn}
            aria-label="Back to drive home"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {ROADSIDE_PRODUCE_BUTTON_LABEL}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">For regulator inspection</p>
          </div>
          <FileBadge className="w-7 h-7 text-amber-600 shrink-0" aria-hidden />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/30 p-4 space-y-3">
          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            When an officer asks to see your records, open a single PDF with your last{" "}
            <strong>{ROADSIDE_PRODUCE_DAYS} calendar days</strong> of weekly sheets — diary grids,
            compliance summary, and shift log for each week in that period.
          </p>
          <ol className="text-sm text-slate-700 dark:text-slate-300 space-y-2 list-decimal list-inside">
            <li>Tap the button below (works offline after your weeks are saved).</li>
            <li>Share or show the PDF on your phone.</li>
            <li>Keep signed records for at least 3 years — this export is produce only.</li>
          </ol>
        </div>

        <DriverRoadsideProduceButton variant="primary" />

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-0.5">
          {ROADSIDE_PDF_DISCLAIMER}
        </p>

        <Link
          href="/driver/guide"
          className="block text-center text-sm font-semibold text-teal-700 dark:text-teal-400 hover:underline"
        >
          More in the user manual
        </Link>
      </main>
    </div>
  );
}
