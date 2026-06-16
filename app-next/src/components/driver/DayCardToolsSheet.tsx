"use client";

import Link from "next/link";
import {
  ChevronRight,
  ClipboardList,
  FileSignature,
  Loader2,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { driverDrawerRow, driverSectionLabel, driverIconBtn } from "@/components/driver/driver-ui-classes";
import { DriverRoadsideProduceButton } from "@/components/driver/DriverRoadsideProduceButton";
import { formatSheetDisplayDate } from "@/lib/weeks";

export function DayCardToolsSheet({
  open,
  onOpenChange,
  sheetId,
  weekStarting,
  last24hBreak,
  complianceLoading,
  complianceDetail,
  complianceTone,
  unsignedPastWeeksCount = 0,
  onOpenGear,
  onOpenDaySetup,
  last24hUnset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetId: string;
  weekStarting?: string;
  last24hBreak?: string;
  complianceLoading?: boolean;
  complianceDetail: string;
  complianceTone: "ok" | "warn" | "issue";
  unsignedPastWeeksCount?: number;
  onOpenGear: () => void;
  onOpenDaySetup?: () => void;
  last24hUnset?: boolean;
}) {
  if (!open) return null;

  const complianceHref = `/sheets/${sheetId}/compliance`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-end p-0"
      role="dialog"
      aria-modal
      aria-labelledby="day-card-tools-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 border-0 cursor-default"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4">
          <h2 id="day-card-tools-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Day tools
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(driverIconBtn, "rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800")}
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <section>
            <h3 className={driverSectionLabel}>Week record</h3>
            <div className="space-y-2 text-sm">
              <p className="text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wide">
                  Week
                </span>
                <br />
                {weekStarting ? formatSheetDisplayDate(weekStarting) : "—"}
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wide">
                  Last 24hr break
                </span>
                <br />
                {last24hBreak?.trim() ? (
                  formatSheetDisplayDate(last24hBreak)
                ) : last24hUnset && onOpenDaySetup ? (
                  <button
                    type="button"
                    className="text-amber-700 dark:text-amber-300 font-semibold underline-offset-2 hover:underline"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenDaySetup();
                    }}
                  >
                    Set in day setup
                  </button>
                ) : (
                  "Not set"
                )}
              </p>
            </div>
          </section>

          <section>
            <h3 className={driverSectionLabel}>Compliance</h3>
            {complianceLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden />
                Checking…
              </div>
            ) : (
              <Link
                href={complianceHref}
                onClick={() => onOpenChange(false)}
                className={cn(
                  driverDrawerRow,
                  complianceTone === "issue"
                    ? "border-amber-300 dark:border-amber-700"
                    : complianceTone === "warn"
                      ? "border-amber-200 dark:border-amber-800"
                      : "border-emerald-200 dark:border-emerald-800"
                )}
              >
                <ClipboardList className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                <span className="flex-1 text-left">
                  <span className="block font-semibold">Compliance</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{complianceDetail}</span>
                </span>
                <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
              </Link>
            )}
          </section>

          <section>
            <h3 className={driverSectionLabel}>Roadside</h3>
            <DriverRoadsideProduceButton variant="stacked" onNavigate={() => onOpenChange(false)} />
          </section>

          {unsignedPastWeeksCount > 0 && (
            <section>
              <h3 className={driverSectionLabel}>Records</h3>
              <button
                type="button"
                className={cn(driverDrawerRow, "border-amber-300 dark:border-amber-700 w-full")}
                onClick={() => {
                  onOpenChange(false);
                  onOpenGear();
                }}
              >
                <FileSignature className="w-5 h-5 shrink-0 text-amber-600" aria-hidden />
                <span className="flex-1 text-left text-sm font-medium">
                  {unsignedPastWeeksCount} past week{unsignedPastWeeksCount === 1 ? "" : "s"} need signature
                </span>
                <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
              </button>
            </section>
          )}

          <section>
            <h3 className={driverSectionLabel}>More</h3>
            <button
              type="button"
              className={cn(driverDrawerRow, "w-full")}
              onClick={() => {
                onOpenChange(false);
                onOpenGear();
              }}
            >
              <Settings className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
              <span className="flex-1 text-left text-sm font-medium">Settings &amp; tools</span>
              <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
