"use client";

import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { driverDialogBtn } from "@/components/driver/driver-ui-classes";
import { cn } from "@/lib/utils";

export function EndShiftCorrectionDialog({
  open,
  onOpenChange,
  dayLabel,
  stopTimeHhmm,
  onStopTimeHhmmChange,
  endKms,
  onEndKmsChange,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Calendar day label for the record being corrected (display only). */
  dayLabel: string;
  stopTimeHhmm: string;
  onStopTimeHhmmChange: (hhmm: string) => void;
  endKms: string;
  onEndKmsChange: (value: string) => void;
  error: string | null;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Square className="w-5 h-5" />
            End shift
          </DialogTitle>
          <DialogDescription>
            Record when you finished work on {dayLabel}. Times after this count as non-work on your
            rolling timeline. End km is required for WAHVA.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label
              htmlFor="end-shift-time"
              className="text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              When did you finish work?
            </Label>
            <Input
              id="end-shift-time"
              type="time"
              value={stopTimeHhmm}
              onChange={(e) => onStopTimeHhmmChange(e.target.value)}
              className="h-11 text-base font-mono"
              aria-invalid={!!error}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-shift-kms" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              End km (required)
            </Label>
            <Input
              id="end-shift-kms"
              type="number"
              min={0}
              placeholder="e.g. 12345"
              value={endKms}
              onChange={(e) => onEndKmsChange(e.target.value)}
              className="font-mono"
              aria-invalid={!!error}
              aria-describedby={error ? "end-shift-error" : undefined}
            />
          </div>
          {error && (
            <p id="end-shift-error" className="text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
            <Button variant="outline" className={driverDialogBtn} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onConfirm} className={cn(driverDialogBtn, "gap-2")}>
              <Square className="w-5 h-5" />
              End shift
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
