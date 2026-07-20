"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ComplianceCheckResult } from "@/lib/api";
import {
  complianceMessagesFixableInDaySetup,
  declared24hRestsIncomplete,
  isComplianceMessageFixableInDaySetup,
  SETUP_WEEK_RECORD_BUTTON_LABEL,
} from "@/lib/declared-24h-rests";

export function ComplianceQuickDialog({
  open,
  onOpenChange,
  sheetId,
  loading,
  results,
  driverName,
  onSetupWeekRecord,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetId: string;
  loading?: boolean;
  results: ComplianceCheckResult[];
  driverName?: string | null;
  /** Scroll to today and open Set up day (header rest dates). */
  onSetupWeekRecord?: () => void;
}) {
  const href = `/sheets/${sheetId}/compliance`;
  const violations = results.filter((r) => r.type === "violation");
  const warnings = results.filter((r) => r.type === "warning");
  const issues = [...violations, ...warnings];
  const name = driverName?.trim() || "";
  const showSetupRecord =
    !!onSetupWeekRecord && issues.some((r) => isComplianceMessageFixableInDaySetup(r.message));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : violations.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            )}
            Compliance snapshot
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-left space-y-2 pt-1">
              {name ? (
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Driver · {name}</p>
              ) : null}
              {loading && <p>Checking your record against WA solo rules…</p>}
              {!loading && violations.length === 0 && warnings.length === 0 && (
                <p>No issues detected on this sheet right now.</p>
              )}
              {!loading &&
                issues.slice(0, 3).map((r, i) => (
                  <p key={i} className="text-sm text-slate-700 dark:text-slate-300">
                    • {r.message}
                  </p>
                ))}
              {!loading && issues.length > 3 && (
                <p className="text-xs text-slate-500">+ {issues.length - 3} more on the full check page</p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {showSetupRecord ? (
            <Button
              size="sm"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                onOpenChange(false);
                onSetupWeekRecord?.();
              }}
            >
              {SETUP_WEEK_RECORD_BUTTON_LABEL}
            </Button>
          ) : null}
          <Link href={href} onClick={() => onOpenChange(false)}>
            <Button size="sm" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
              Open full compliance check
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
