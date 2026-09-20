"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Loader2,
  Mail,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { driverDrawerRow, driverSectionLabel, driverIconBtn } from "@/components/driver/driver-ui-classes";
import { DriverRoadsideProduceButton } from "@/components/driver/DriverRoadsideProduceButton";
import { formatSheetDisplayDate } from "@/lib/weeks";
import { DECLARED_24H_REST_COPY } from "@/lib/declared-24h-rests";
import { api } from "@/lib/api";
import {
  CHECKLIST_EMAIL_BUTTON_LABEL,
  CHECKLIST_EMAIL_MISSING_MESSAGE,
  FAULT_REPORT_FORM_TITLE,
  FORKLIFT_PRESTART_FORM_TITLE,
  HOOKUP_FORM_TITLE,
  TRAILER_PRESTART_FORM_TITLE,
} from "@/lib/checklist";
import { DRIVER_FORMS_SECTION_LABEL } from "@/lib/product-copy";

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
  onViewFfw,
  ffwFormCompleted = false,
  onOpenPrestart,
  onViewPrestart,
  prestartFormCompleted = false,
  onOpenTrailerPrestart,
  onViewTrailerPrestart,
  trailerPrestartCompleted = false,
  onOpenForkliftPrestart,
  onViewForkliftPrestart,
  forkliftPrestartCompleted = false,
  onOpenDimensionLoad,
  onViewDimensionLoad,
  dimensionLoadFormCompleted = false,
  onOpenHookup,
  onViewHookup,
  hookupFormCompleted = false,
  onOpenFaultReport,
  onViewFaultReport,
  faultReportFormCompleted = false,
  onProduceChecklistPdf,
  onEmailChecklistPdf,
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
  onViewFfw?: () => void;
  ffwFormCompleted?: boolean;
  /** Optional trial Prestart form — never blocks Start shift. */
  onOpenPrestart?: () => void;
  onViewPrestart?: () => void;
  prestartFormCompleted?: boolean;
  onOpenTrailerPrestart?: () => void;
  onViewTrailerPrestart?: () => void;
  trailerPrestartCompleted?: boolean;
  onOpenForkliftPrestart?: () => void;
  onViewForkliftPrestart?: () => void;
  forkliftPrestartCompleted?: boolean;
  /** Optional trial Dimension & Load — multi-load; never blocks leaving load. */
  onOpenDimensionLoad?: () => void;
  onViewDimensionLoad?: () => void;
  dimensionLoadFormCompleted?: boolean;
  onOpenHookup?: () => void;
  onViewHookup?: () => void;
  hookupFormCompleted?: boolean;
  onOpenFaultReport?: () => void;
  onViewFaultReport?: () => void;
  faultReportFormCompleted?: boolean;
  /** Dedicated checklist PDF for this day (not fatigue roadside). */
  onProduceChecklistPdf?: () => void;
  /** Email checklist PDFs; return a short success message for on-sheet feedback. */
  onEmailChecklistPdf?: () => Promise<string>;
  last24hUnset?: boolean;
  /** True when 2×24h (or 4×24h) rest dates are required but not all set yet. */
  declared24hRestUnset?: boolean;
  driverName?: string | null;
}) {
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);
  const [deliveryEmail, setDeliveryEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmailBusy(false);
    setEmailFeedback(null);
    let cancelled = false;
    api.settings
      .getChecklistDelivery()
      .then((d) => {
        if (!cancelled) setDeliveryEmail(d.email);
      })
      .catch(() => {
        if (!cancelled) setDeliveryEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
            <h3 className={driverSectionLabel}>{DRIVER_FORMS_SECTION_LABEL}</h3>
            {onOpenFfw ||
            onViewFfw ||
            onOpenPrestart ||
            onViewPrestart ||
            onOpenTrailerPrestart ||
            onViewTrailerPrestart ||
            onOpenForkliftPrestart ||
            onViewForkliftPrestart ||
            onOpenDimensionLoad ||
            onViewDimensionLoad ||
            onOpenHookup ||
            onViewHookup ||
            onOpenFaultReport ||
            onViewFaultReport ? (
              <div className="space-y-1">
                {onOpenFfw || onViewFfw ? (
                  <div className="space-y-1">
                    {onViewFfw && ffwFormCompleted ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onViewFfw();
                        }}
                      >
                        <ClipboardCheck className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">View Fitness for Work</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Read saved answers and signature
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
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
                          <span className="block font-semibold">
                            {ffwFormCompleted ? "Redo Fitness for Work" : "Fitness for Work"}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {ffwFormCompleted
                              ? "Complete a new signed form for this day"
                              : "Optional signed form — does not block Start shift"}
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {onOpenPrestart || onViewPrestart ? (
                  <div className="space-y-1">
                    {onViewPrestart && prestartFormCompleted ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onViewPrestart();
                        }}
                      >
                        <ClipboardList className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">View vehicle pre-departure</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Read saved inspection or not-responsible note
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
                          <span className="block font-semibold">
                            {prestartFormCompleted ? "Redo vehicle pre-departure" : "Vehicle pre-departure"}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {prestartFormCompleted
                              ? "Complete a new signed vehicle check for this day"
                              : "Optional vehicle check — two-up can mark not responsible"}
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {onOpenTrailerPrestart || onViewTrailerPrestart ? (
                  <div className="space-y-1">
                    {onViewTrailerPrestart && trailerPrestartCompleted ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onViewTrailerPrestart();
                        }}
                      >
                        <ClipboardList className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">View {TRAILER_PRESTART_FORM_TITLE}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Read saved trailer inspection
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                    {onOpenTrailerPrestart ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onOpenTrailerPrestart();
                        }}
                      >
                        <ClipboardList className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">
                            {trailerPrestartCompleted
                              ? `Redo ${TRAILER_PRESTART_FORM_TITLE}`
                              : TRAILER_PRESTART_FORM_TITLE}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Optional trailer check — not on the week PDF
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {onOpenForkliftPrestart || onViewForkliftPrestart ? (
                  <div className="space-y-1">
                    {onViewForkliftPrestart && forkliftPrestartCompleted ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onViewForkliftPrestart();
                        }}
                      >
                        <ClipboardList className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">View {FORKLIFT_PRESTART_FORM_TITLE}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Read saved forklift inspection
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                    {onOpenForkliftPrestart ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onOpenForkliftPrestart();
                        }}
                      >
                        <ClipboardList className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">
                            {forkliftPrestartCompleted
                              ? `Redo ${FORKLIFT_PRESTART_FORM_TITLE}`
                              : FORKLIFT_PRESTART_FORM_TITLE}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Optional forklift check — not on the week PDF
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {onOpenDimensionLoad || onViewDimensionLoad ? (
                  <div className="space-y-1">
                    {onViewDimensionLoad && dimensionLoadFormCompleted ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onViewDimensionLoad();
                        }}
                      >
                        <ClipboardCheck className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">View Dimension & Load</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Read saved load check(s) for this day
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
                          <span className="block font-semibold">
                            {dimensionLoadFormCompleted
                              ? "Add Dimension & Load"
                              : "Dimension & Load"}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {dimensionLoadFormCompleted
                              ? "Add another post-load check"
                              : "Optional post-load check — separate driver / loader CoR"}
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {onOpenHookup || onViewHookup ? (
                  <div className="space-y-1">
                    {onViewHookup && hookupFormCompleted ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onViewHookup();
                        }}
                      >
                        <ClipboardCheck className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">View {HOOKUP_FORM_TITLE}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Read saved hook-up check(s) for this day
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                    {onOpenHookup ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onOpenHookup();
                        }}
                      >
                        <ClipboardCheck className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">
                            {hookupFormCompleted ? `Add ${HOOKUP_FORM_TITLE}` : HOOKUP_FORM_TITLE}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {hookupFormCompleted
                              ? "Add another coupling check"
                              : "Optional fifth-wheel coupling check — not on the week PDF"}
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {onOpenFaultReport || onViewFaultReport ? (
                  <div className="space-y-1">
                    {onViewFaultReport && faultReportFormCompleted ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onViewFaultReport();
                        }}
                      >
                        <ClipboardCheck className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">View {FAULT_REPORT_FORM_TITLE}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Read saved fault report(s) for this day
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                    {onOpenFaultReport ? (
                      <button
                        type="button"
                        className={cn(driverDrawerRow, "w-full")}
                        onClick={() => {
                          onOpenChange(false);
                          onOpenFaultReport();
                        }}
                      >
                        <ClipboardCheck className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block font-semibold">
                            {faultReportFormCompleted
                              ? `Add ${FAULT_REPORT_FORM_TITLE}`
                              : FAULT_REPORT_FORM_TITLE}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {faultReportFormCompleted
                              ? "Add another signed fault record"
                              : "Signed WAHVA fault record — does not replace a Fault tick"}
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-1">
                Open an editable day card to complete forms.
              </p>
            )}
          </section>

          {onProduceChecklistPdf || onEmailChecklistPdf ? (
            <section>
              <h3 className={driverSectionLabel}>Checklist PDF</h3>
              <div className="space-y-2">
                {onProduceChecklistPdf ? (
                  <button
                    type="button"
                    className={cn(driverDrawerRow, "w-full")}
                    onClick={() => {
                      onOpenChange(false);
                      onProduceChecklistPdf();
                    }}
                  >
                    <FileSignature className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                    <span className="flex-1 text-left">
                      <span className="block font-semibold">Produce checklist PDFs</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        One sheet per signed log, dated week ending — not the fatigue roadside PDF
                      </span>
                    </span>
                    <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                  </button>
                ) : null}
                {onEmailChecklistPdf ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={emailBusy}
                      className={cn(driverDrawerRow, "w-full", emailBusy && "opacity-70")}
                      onClick={() => {
                        void (async () => {
                          setEmailFeedback(null);
                          setEmailBusy(true);
                          try {
                            const text = await onEmailChecklistPdf();
                            setEmailFeedback({
                              tone: "ok",
                              text: text || "Sent.",
                            });
                          } catch (e) {
                            setEmailFeedback({
                              tone: "err",
                              text:
                                e instanceof Error
                                  ? e.message
                                  : "Could not email checklist PDFs.",
                            });
                          } finally {
                            setEmailBusy(false);
                          }
                        })();
                      }}
                    >
                      {emailBusy ? (
                        <Loader2
                          className="w-5 h-5 shrink-0 text-slate-500 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <Mail className="w-5 h-5 shrink-0 text-slate-500" aria-hidden />
                      )}
                      <span className="flex-1 text-left">
                        <span className="block font-semibold">
                          {emailBusy ? "Sending…" : CHECKLIST_EMAIL_BUTTON_LABEL}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {deliveryEmail
                            ? `Separate PDF per type to ${deliveryEmail}`
                            : CHECKLIST_EMAIL_MISSING_MESSAGE}
                        </span>
                      </span>
                      {!emailBusy ? (
                        <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                      ) : null}
                    </button>
                    {emailFeedback ? (
                      <p
                        role="status"
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm leading-snug",
                          emailFeedback.tone === "ok"
                            ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                            : "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200"
                        )}
                      >
                        {emailFeedback.text}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

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
