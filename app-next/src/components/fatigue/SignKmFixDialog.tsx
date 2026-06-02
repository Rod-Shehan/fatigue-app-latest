"use client";

import React, { useState } from "react";
import Link from "next/link";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: SheetKmIssue[];
  onAutoFixStartKm: () => Promise<void>;
  onGoToDay: (dayIndex: number) => void;
  weekOfLabel: string;
}) {
  const [fixing, setFixing] = useState(false);
  const canAutoFix = issues.some((i) => i.canAutoFixStart);
  const endKmOnly = issues.length > 0 && issues.every((i) => i.code === "missing_end");

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
          <DialogDescription className="text-left space-y-2">
            <span className="block">
              Before you can sign the week of {weekOfLabel}, odometer readings for each day you drove must link
              together for the same rego (and match the fleet record where one exists).
            </span>
            {canAutoFix && (
              <span className="block text-slate-700 dark:text-slate-300">
                Tap <span className="font-semibold">Fix start km automatically</span> to set each day&apos;s start km
                from the previous end km — you only need to enter any missing end km.
              </span>
            )}
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
              {issue.code === "missing_end" || issue.code === "end_invalid" ? (
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
              Fix start km automatically
            </Button>
          )}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-end">
            <Button variant="outline" className={driverDialogBtn} onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Link href="/sheets" className="w-full sm:w-auto">
              <Button variant="outline" className={cn(driverDialogBtn, "w-full")}>
                Your weeks
              </Button>
            </Link>
            {!endKmOnly && (
              <Link href="/driver" className="w-full sm:w-auto">
                <Button variant="outline" className={cn(driverDialogBtn, "w-full")}>
                  Current week
                </Button>
              </Link>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
