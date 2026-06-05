"use client";

import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeviceBackupRestoreBanner({
  weekCount,
  onDismiss,
}: {
  weekCount: number;
  onDismiss: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 px-4 py-3 flex items-start gap-3"
      role="status"
    >
      <CheckCircle2 className="w-5 h-5 text-teal-700 dark:text-teal-300 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-teal-950 dark:text-teal-100">
          Recovered {weekCount} week{weekCount !== 1 ? "s" : ""} from on-device backup
        </p>
        <p className="text-xs text-teal-900/80 dark:text-teal-200/90 mt-0.5">
          Your records were restored from a backup saved on this phone.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8 text-teal-800 dark:text-teal-200"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
