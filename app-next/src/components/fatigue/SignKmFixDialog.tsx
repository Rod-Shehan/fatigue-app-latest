"use client";

import React, { useState } from "react";
import { AlertCircle, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SheetKmIssue } from "@/lib/rego-kms-validation";
import { driverDialogBtn } from "@/components/driver/driver-ui-classes";
import { cn } from "@/lib/utils";

export function SignKmFixDialog({
  open,
  onOpenChange,
  issues,
  onAutoFixStartKm,
  onGoToDay,
  weekOfLabel,
  purpose = "sign",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: SheetKmIssue[];
  onAutoFixStartKm: () => Promise<void>;
  onGoToDay: (dayIndex: number) => void;
  weekOfLabel: string;
  /** Why km fix was opened — adjusts helper copy. */
  purpose?: "save" | "sign";
}) {
  const [fixing, setFixing] = useState(false);
  const canAutoFix = issues.some((i) => i.canAutoFixStart);

  const handleAutoFix = async () => {
    setFixing(true);
    try {
      await onAutoFixStartKm();
    } finally {
      setFixing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[min(90vh,640px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            Kilometres need a quick fix
          </DialogTitle>
          <DialogDescription className="text-left">
            {purpose === "save"
              ? "Fix the days below, then tap Save again. For the same rego, each day’s start km must be at least the previous day’s end km (or the last fleet reading)."
              : `Fix the days below, then sign the week of ${weekOfLabel}. Start km must follow the previous end km for each rego.`}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          {issues.map((issue) => (
            <li
              key={`${issue.dayIndex}-${issue.code}`}
              className="flex flex-col gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-2"
            >
              <span className="font-semibold text-slate-800 dark:text-slate-100">{issue.dayLabel}</span>
              <span className="text-slate-600 dark:text-slate-400">{issue.message}</span>
              {issue.code === "missing_end" ||
              issue.code === "end_invalid" ||
              issue.code === "start_too_low" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 w-fit min-h-9 text-xs font-semibold"
                  onClick={() => {
                    onGoToDay(issue.dayIndex);
                    onOpenChange(false);
                  }}
                >
                  Edit {issue.dayLabel}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 pt-2">
          {canAutoFix && (
            <Button
              type="button"
              className={cn(driverDialogBtn, "w-full gap-2 bg-emerald-600 hover:bg-emerald-700")}
              disabled={fixing}
              onClick={() => void handleAutoFix()}
            >
              {fixing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Wrench className="w-5 h-5 shrink-0" />
              )}
              Fill missing start km
            </Button>
          )}
          <Button variant="outline" className={cn(driverDialogBtn, "w-full")} onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
