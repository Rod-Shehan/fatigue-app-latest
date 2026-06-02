"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  FileSignature,
  Loader2,
  Settings,
  X,
} from "lucide-react";
import type { FatigueSheet } from "@/lib/api";
import { formatSheetDisplayDate } from "@/lib/weeks";
import { cn } from "@/lib/utils";
import { driverDrawerRow, driverSectionLabel, driverIconBtn } from "@/components/driver/driver-ui-classes";
import { DriverSheetActions } from "./DriverSheetActions";

export function DriverGearDrawer({
  returnHref,
  sheetId,
  unsignedPastWeeks = [],
  optionalNotes = [],
  saveStatus,
  onSave,
  savePending,
  onMarkComplete,
  markCompleteLabel,
  onExportPdf,
  showSheetActions = false,
  open: openControlled,
  onOpenChange,
  className,
}: {
  returnHref?: string;
  sheetId?: string;
  unsignedPastWeeks?: FatigueSheet[];
  optionalNotes?: string[];
  saveStatus?: "saved" | "dirty" | "saving" | null;
  onSave?: () => void;
  savePending?: boolean;
  onMarkComplete?: () => void;
  markCompleteLabel?: string;
  onExportPdf?: () => void;
  showSheetActions?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openControlled ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;
  const settingsHref =
    returnHref && returnHref !== "/driver"
      ? `/driver/settings?from=${encodeURIComponent(returnHref)}`
      : "/driver/settings";

  const badgeCount =
    (unsignedPastWeeks.length > 0 ? 1 : 0) + (saveStatus === "dirty" ? 1 : 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          "border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900",
          "text-slate-700 dark:text-slate-200",
          "hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
          className
        )}
        aria-label="Settings and tools"
        title="Settings"
      >
        <Settings className="h-7 w-7" strokeWidth={2} aria-hidden />
        {badgeCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-end p-0"
          role="dialog"
          aria-modal
          aria-labelledby="driver-gear-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 border-0 cursor-default"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4">
              <h2 id="driver-gear-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Settings &amp; tools
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(driverIconBtn, "rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800")}
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {showSheetActions && sheetId && (
                <section>
                  <h3 className={driverSectionLabel}>This week</h3>
                  {saveStatus === "saved" && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" aria-hidden />
                      All changes saved
                    </p>
                  )}
                  {saveStatus === "dirty" && (
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-3 font-semibold">
                      Unsaved changes
                    </p>
                  )}
                  {saveStatus === "saving" && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden />
                      Saving…
                    </p>
                  )}
                  <DriverSheetActions
                    layout="stacked"
                    sheetId={sheetId}
                    onSave={onSave}
                    savePending={savePending}
                    onMarkComplete={onMarkComplete}
                    markCompleteLabel={markCompleteLabel}
                    onExportPdf={onExportPdf}
                  />
                </section>
              )}

              {unsignedPastWeeks.length > 0 && (
                <section>
                  <h3 className={driverSectionLabel}>Records to sign</h3>
                  <ul className="space-y-2">
                    {unsignedPastWeeks.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/sheets/${s.id}`}
                          onClick={() => setOpen(false)}
                          className={driverDrawerRow}
                        >
                          <FileSignature className="w-5 h-5 shrink-0 text-amber-600" aria-hidden />
                          <span className="flex-1 text-left leading-snug">
                            Sign week of {s.week_starting ? formatSheetDisplayDate(s.week_starting) : "—"}
                          </span>
                          <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {optionalNotes.length > 0 && (
                <section>
                  <h3 className={driverSectionLabel}>Optional notes</h3>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-3 space-y-2">
                    {optionalNotes.slice(0, 3).map((msg, i) => (
                      <p key={i} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {msg}
                      </p>
                    ))}
                  </div>
                  {sheetId && (
                    <Link
                      href={`/sheets/${sheetId}/compliance`}
                      onClick={() => setOpen(false)}
                      className={cn(driverDrawerRow, "mt-2")}
                    >
                      <span className="flex-1 text-left">View in compliance</span>
                      <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                    </Link>
                  )}
                </section>
              )}

              <section>
                <Link href={settingsHref} onClick={() => setOpen(false)} className={driverDrawerRow}>
                  <Settings className="w-5 h-5 shrink-0" aria-hidden />
                  <span className="flex-1 text-left">All settings</span>
                  <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                </Link>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
