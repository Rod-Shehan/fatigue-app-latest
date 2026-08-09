"use client";

import Link from "next/link";
import { Archive, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { driverCardBtn } from "@/components/driver/driver-ui-classes";
import {
  formatPastWeekArchiveBannerBody,
  formatPastWeekArchiveBannerTitle,
  formatResignPastWeekBody,
  formatResignPastWeekTitle,
  formatSignPastWeekBody,
  formatSignPastWeekTitle,
  SIGNED_CURRENT_WEEK_ARCHIVE_BODY,
  SIGNED_CURRENT_WEEK_ARCHIVE_TITLE,
  SIGN_CURRENT_WEEK_BODY,
  SIGN_CURRENT_WEEK_TITLE,
  SHEET_ATTESTATION_WORKFLOW,
} from "@/lib/product-copy";

export function SheetRecordBanner({
  weekOfLabel,
  isPastWeek,
  variant,
  onSign,
}: {
  /** Display date for the sheet's week (e.g. "22 Mar 2026"). */
  weekOfLabel: string;
  isPastWeek: boolean;
  variant: "archive" | "sign" | "resign";
  onSign?: () => void;
}) {
  const isArchive = variant === "archive";

  const copy =
    variant === "resign"
      ? isPastWeek
        ? {
            title: formatResignPastWeekTitle(weekOfLabel),
            body: formatResignPastWeekBody(weekOfLabel),
          }
        : {
            title: SHEET_ATTESTATION_WORKFLOW.RESIGN_AFTER_AMENDMENT_TITLE,
            body: SHEET_ATTESTATION_WORKFLOW.RESIGN_AFTER_AMENDMENT_BODY,
          }
      : variant === "sign"
        ? isPastWeek
          ? {
              title: formatSignPastWeekTitle(weekOfLabel),
              body: formatSignPastWeekBody(weekOfLabel),
            }
          : {
              title: SIGN_CURRENT_WEEK_TITLE,
              body: SIGN_CURRENT_WEEK_BODY,
            }
        : isPastWeek
          ? {
              title: formatPastWeekArchiveBannerTitle(weekOfLabel),
              body: formatPastWeekArchiveBannerBody(),
            }
          : {
              title: SIGNED_CURRENT_WEEK_ARCHIVE_TITLE,
              body: SIGNED_CURRENT_WEEK_ARCHIVE_BODY,
            };

  return (
    <div
      className={cn(
        "mb-4 rounded-xl border p-4 flex flex-col sm:flex-row sm:items-start gap-3",
        isArchive
          ? "border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/60"
          : "border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40"
      )}
      role="status"
    >
      {isArchive ? (
        <Archive className="w-5 h-5 text-slate-600 dark:text-slate-300 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <PenLine className="w-5 h-5 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5" aria-hidden />
      )}
      <div className="flex-1 min-w-0 space-y-2">
        {isPastWeek ? (
          <p className="text-sm font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
            Not your current logging week
          </p>
        ) : null}
        <p
          className={cn(
            "text-sm font-semibold",
            isArchive ? "text-slate-900 dark:text-slate-100" : "text-emerald-900 dark:text-emerald-100"
          )}
        >
          {copy.title}
        </p>
        <p
          className={cn(
            "text-sm leading-snug",
            isArchive ? "text-slate-600 dark:text-slate-300" : "text-emerald-800 dark:text-emerald-200"
          )}
        >
          {copy.body}
        </p>
        {isPastWeek && (
          <Link
            href="/driver"
            className={cn(
              driverCardBtn,
              "inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            )}
          >
            Go to current week (Drive home)
          </Link>
        )}
      </div>
      {(variant === "sign" || variant === "resign") && onSign && (
        <Button
          type="button"
          className="shrink-0 w-full sm:w-auto min-h-[48px] h-12 gap-2 text-base font-semibold bg-emerald-600 hover:bg-emerald-700"
          onClick={onSign}
        >
          <PenLine className="w-5 h-5" />
          Sign record
        </Button>
      )}
    </div>
  );
}
