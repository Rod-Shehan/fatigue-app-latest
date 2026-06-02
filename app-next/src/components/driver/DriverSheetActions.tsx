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

export function DriverSheetActions({
  sheetId,
  onSave,
  savePending = false,
  onMarkComplete,
  markCompleteLabel,
  onExportPdf,
}: {
  sheetId: string;
  onSave?: () => void;
  savePending?: boolean;
  onMarkComplete?: () => void;
  markCompleteLabel?: string;
  onExportPdf?: () => void;
}) {
  const completeLabel = markCompleteLabel ?? "Mark complete";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {onSave && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs min-h-[44px] sm:min-h-9"
          disabled={savePending}
          onClick={onSave}
        >
          {savePending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          ) : (
            <Save className="w-3.5 h-3.5 shrink-0" />
          )}
          Save
        </Button>
      )}
      {onMarkComplete && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs min-h-[44px] sm:min-h-9 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200"
          onClick={onMarkComplete}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          {completeLabel}
        </Button>
      )}
      {onExportPdf && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs min-h-[44px] sm:min-h-9"
          onClick={onExportPdf}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          PDF
        </Button>
      )}
      <Link
        href={`/sheets/${sheetId}/shift-log`}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px] sm:min-h-9"
      >
        <ScrollText className="w-3.5 h-3.5 shrink-0" />
        Shift log
      </Link>
    </div>
  );
}
