"use client";

import Link from "next/link";
import { AlertCircle, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatPastWeekArchiveSubtitle,
  formatResignPastWeekBody,
  formatResignPastWeekTitle,
  formatSignPastWeekBody,
  formatSignPastWeekTitle,
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
        : {
            title: isPastWeek
              ? formatPastWeekArchiveSubtitle(weekOfLabel)
              : "Past week — read-only record",
            body: isPastWeek
              ? "This past week is closed for logging. You can review it here; corrections go through your manager."
              : "This week is closed for logging. You can review it here; corrections go through your manager.",
          };

  return (
    <div
      className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-4 flex flex-col sm:flex-row sm:items-start gap-3"
      role="status"
    >
      <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0 space-y-2">
        {isPastWeek && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800/90 dark:text-amber-200/90">
            Past week · not current week
          </p>
        )}
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{copy.title}</p>
        <p className="text-sm text-amber-800 dark:text-amber-200">{copy.body}</p>
        {isPastWeek && (
          <Link
            href="/driver"
            className="inline-block text-sm font-semibold text-emerald-800 dark:text-emerald-300 underline underline-offset-2"
          >
            Go to current week (Drive home)
          </Link>
        )}
      </div>
      {(variant === "sign" || variant === "resign") && onSign && (
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          onClick={onSign}
        >
          <PenLine className="w-3.5 h-3.5" />
          Sign record
        </Button>
      )}
    </div>
  );
}
