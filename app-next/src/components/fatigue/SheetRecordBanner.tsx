"use client";

import { AlertCircle, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHEET_ATTESTATION_WORKFLOW } from "@/lib/product-copy";

export function SheetRecordBanner({
  variant,
  onSign,
}: {
  variant: "archive" | "sign" | "resign";
  onSign?: () => void;
}) {
  const copy =
    variant === "resign"
      ? {
          title: SHEET_ATTESTATION_WORKFLOW.RESIGN_AFTER_AMENDMENT_TITLE,
          body: SHEET_ATTESTATION_WORKFLOW.RESIGN_AFTER_AMENDMENT_BODY,
        }
      : variant === "sign"
        ? {
            title: SHEET_ATTESTATION_WORKFLOW.SIGN_ARCHIVED_WEEK_TITLE,
            body: SHEET_ATTESTATION_WORKFLOW.SIGN_ARCHIVED_WEEK_BODY,
          }
        : {
            title: "Past week — read-only record",
            body: "This week is closed for logging. You can review it here; corrections go through your manager.",
          };

  return (
    <div
      className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-4 flex flex-col sm:flex-row sm:items-start gap-3"
      role="status"
    >
      <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{copy.title}</p>
        <p className="text-sm text-amber-800 dark:text-amber-200">{copy.body}</p>
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
