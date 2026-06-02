"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Download,
  Loader2,
  Save,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const inlineBtn =
  "h-9 gap-1.5 text-xs min-h-[44px] sm:min-h-9";
const stackedBtn =
  "w-full h-14 min-h-[56px] gap-3 justify-start px-4 text-base font-semibold rounded-xl";

export function DriverSheetActions({
  sheetId,
  onSave,
  savePending = false,
  onMarkComplete,
  markCompleteLabel,
  onExportPdf,
  layout = "inline",
}: {
  sheetId: string;
  onSave?: () => void;
  savePending?: boolean;
  onMarkComplete?: () => void;
  markCompleteLabel?: string;
  onExportPdf?: () => void;
  /** inline = manager toolbar; stacked = mobile gear drawer (full-width rows). */
  layout?: "inline" | "stacked";
}) {
  const completeLabel = markCompleteLabel ?? "Mark complete";
  const stacked = layout === "stacked";
  const iconSize = stacked ? "w-5 h-5" : "w-3.5 h-3.5";

  return (
    <div className={cn(stacked ? "flex flex-col gap-2 w-full" : "flex flex-wrap items-center gap-1.5")}>
      {onSave && (
        <Button
          type="button"
          variant="outline"
          size={stacked ? "default" : "sm"}
          className={cn(stacked ? stackedBtn : inlineBtn)}
          disabled={savePending}
          onClick={onSave}
        >
          {savePending ? (
            <Loader2 className={cn(iconSize, "animate-spin shrink-0")} />
          ) : (
            <Save className={cn(iconSize, "shrink-0")} />
          )}
          Save
        </Button>
      )}
      {onMarkComplete && (
        <Button
          type="button"
          variant="outline"
          size={stacked ? "default" : "sm"}
          className={cn(
            stacked ? stackedBtn : inlineBtn,
            "border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200"
          )}
          onClick={onMarkComplete}
        >
          <CheckCircle2 className={cn(iconSize, "shrink-0")} />
          {completeLabel}
        </Button>
      )}
      {onExportPdf && (
        <Button
          type="button"
          variant="outline"
          size={stacked ? "default" : "sm"}
          className={cn(stacked ? stackedBtn : inlineBtn)}
          onClick={onExportPdf}
        >
          <Download className={cn(iconSize, "shrink-0")} />
          Export PDF
        </Button>
      )}
      {stacked ? (
        <Link
          href={`/sheets/${sheetId}/shift-log`}
          className={cn(
            "inline-flex items-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700",
            stackedBtn
          )}
        >
          <ScrollText className={cn(iconSize, "shrink-0")} />
          Shift log
        </Link>
      ) : (
        <Link
          href={`/sheets/${sheetId}/shift-log`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px] sm:min-h-9"
        >
          <ScrollText className="w-3.5 h-3.5 shrink-0" />
          Shift log
        </Link>
      )}
    </div>
  );
}
