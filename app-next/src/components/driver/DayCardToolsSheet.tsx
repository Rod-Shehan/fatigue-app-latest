"use client";

import Link from "next/link";
import {
  ChevronRight,
  ClipboardCheck,
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
import { DECLARED_24H_REST_COPY } from "@/lib/declared-24h-rests";

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
  onOpenFfw,
  ffwFormCompleted = false,
  onOpenPrestart,
  prestartFormCompleted = false,
  onOpenDimensionLoad,
  dimensionLoadFormCompleted = false,
  last24hUnset,
  declared24hRestUnset,
  driverName,
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
  /** Optional trial FFW form — never blocks Start shift. */
  onOpenFfw?: () => void;
  ffwFormCompleted?: boolean;
  /** Optional trial Prestart form — never blocks Start shift. */
  onOpenPrestart?: () => void;
  prestartFormCompleted?: boolean;
  /** Optional trial Dimension & Load — multi-load; never blocks leaving load. */
  onOpenDimensionLoad?: () => void;
  dimensionLoadFormCompleted?: boolean;
  last24hUnset?: boolean;
  /** True when 2×24h (or 4×24h) rest dates are required but not all set yet. */
  declared24hRestUnset?: boolean;
  driverName?: string | null;
}) {
  if (!open) return null;

  const complianceHref = `/sheets/${sheetId}/compliance`;
  const name = driverName?.trim() || "";

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
          <div className="min-w-0">
            <h2 id="day-card-tools-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Day tools
            </h2>
            {name ? (
              <p className="mt-0.5 text-sm font-semibold text-slate-600 dark:text-slate-300 truncate">
                Driver · {name}
              </p>
            ) : null}
          </div>
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
              {name ? (
                <p className="text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wide">
                    Driver
                  </span>
                  <br />
                  {name}
                </p>
              ) : null}
              <p className="text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wide">
                  Week
                </span>
                <br />
                {weekStarting ? formatSheetDisplayDate(weekStarting) : "—"}
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wide">
                  Soft reset (from latest 24h rest end)
                </span>
                <br />
                {last24hBreak?.trim() ? formatSheetDisplayDate(last24hBreak) : "Not set"}
              </p>
              {declared24hRestUnset && onOpenDaySetup ? (
                <p className="text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wide">
                    {DECLARED_24H_REST_COPY.TITLE_2}
                  </span>
                  <br />
                  <button
                    type="button"
                    className="text-amber-700 dark:text-amber-300 font-semibold underline-offset-2 hover:underline"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenDaySetup();
                    }}
                  >
                    Set start &amp; end in day setup
                  </button>
                </p>
              ) : last24hUnset && onOpenDaySetup ? (
                <p className="text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wide">
                    {DECLARED_24H_REST_COPY.TITLE_2}
                  </span>
                  <br />
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
                </p>
              ) : null}
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
            <h3 className={driverSectionLabel}>Optional checks</h3>
            {onOpenFfw || onOpenPrestart || onOpenDimensionLoad ? (
              <div className="space-y-1">
                {onOpenFfw ? (
                  <button
                    type="button"
                    className={cn(driverDrawerRow, "w-full")}
                    onClick={() => {
                      onOpenChange(false);
                      onOpenFfw();
                    }}
                  >
                    <ClipboardCheck className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                    <span className="flex-1 text-left">
                      <span className="block font-semibold">Fitness for Work</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {ffwFormCompleted
                          ? "Form saved for this day — optional to redo"
                          : "Optional signed form — does not block Start shift"}
                      </span>
                    </span>
                    <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                  </button>
                ) : null}
                {onOpenPrestart ? (
                  <button
                    type="button"
                    className={cn(driverDrawerRow, "w-full")}
                    onClick={() => {
                      onOpenChange(false);
                      onOpenPrestart();
                    }}
                  >
                    <ClipboardList className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                    <span className="flex-1 text-left">
                      <span className="block font-semibold">Prestart inspection</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {prestartFormCompleted
                          ? "Form saved for this day — optional to redo"
                          : "Optional vehicle check — two-up can mark not responsible"}
                      </span>
                    </span>
                    <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                  </button>
                ) : null}
                {onOpenDimensionLoad ? (
                  <button
                    type="button"
                    className={cn(driverDrawerRow, "w-full")}
                    onClick={() => {
                      onOpenChange(false);
                      onOpenDimensionLoad();
                    }}
                  >
                    <ClipboardCheck className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                    <span className="flex-1 text-left">
                      <span className="block font-semibold">Dimension & Load</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {dimensionLoadFormCompleted
                          ? "Form saved — you can add another load"
                          : "Optional post-load check — separate driver / loader CoR"}
                      </span>
                    </span>
                    <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-1">
                Open an editable day card to complete optional checks.
              </p>
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
