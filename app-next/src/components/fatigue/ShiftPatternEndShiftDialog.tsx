"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Moon, Sun } from "lucide-react";
import {
  SHIFT_PATTERN_END_SHIFT_PROMPT,
  oppositeShiftLabel,
  shiftLabelDisplay,
  type ShiftLabel,
} from "@/lib/shift-change";

export function ShiftPatternEndShiftDialog({
  open,
  onOpenChange,
  todayLabel,
  nextDayLabel,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Sunday 24 May" */
  todayLabel: string;
  /** e.g. "Monday 25 May" — empty if next day is outside this sheet week */
  nextDayLabel: string;
  onSave: (todayShift: ShiftLabel | "", tomorrowShift: ShiftLabel | "") => void;
}) {
  const [changingPattern, setChangingPattern] = useState<boolean | null>(null);
  const [todayShift, setTodayShift] = useState<ShiftLabel>("A");
  const [tomorrowShift, setTomorrowShift] = useState<ShiftLabel>("B");

  useEffect(() => {
    if (!open) {
      setChangingPattern(null);
      setTodayShift("A");
      setTomorrowShift("B");
    }
  }, [open]);

  useEffect(() => {
    if (changingPattern) setTomorrowShift(oppositeShiftLabel(todayShift));
  }, [changingPattern, todayShift]);

  const handleClose = () => {
    setChangingPattern(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shift pattern check</DialogTitle>
          <DialogDescription className="text-left space-y-2 pt-1">
            <span className="block">{SHIFT_PATTERN_END_SHIFT_PROMPT}</span>
            <span className="block text-slate-600 dark:text-slate-300">
              <strong>Start shift / End shift</strong> buttons log your work.{" "}
              <strong>Shift pattern (A/B)</strong> tells us if you are on a day or night pattern when the rule applies.
            </span>
          </DialogDescription>
        </DialogHeader>

        {changingPattern === null ? (
          <div className="flex flex-col gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { onSave("", ""); handleClose(); }}>
              No — same pattern tomorrow
            </Button>
            <Button type="button" onClick={() => setChangingPattern(true)}>
              Yes — changing day ↔ night
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Today ({todayLabel})
              </Label>
              <Select value={todayShift} onValueChange={(v) => setTodayShift(v as ShiftLabel)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">
                    <span className="inline-flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5" /> Day (A)
                    </span>
                  </SelectItem>
                  <SelectItem value="B">
                    <span className="inline-flex items-center gap-1.5">
                      <Moon className="w-3.5 h-3.5" /> Night (B)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {nextDayLabel ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Next work day ({nextDayLabel})
                </Label>
                <Select
                  value={tomorrowShift}
                  onValueChange={(v) => setTomorrowShift(v as ShiftLabel)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Day (A)</SelectItem>
                    <SelectItem value="B">Night (B)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-amber-700 dark:text-amber-200">
                  Pattern change: {shiftLabelDisplay(todayShift)} → {shiftLabelDisplay(tomorrowShift)}. Do not tap Work
                  until at least 24 hours after your End shift.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Set {shiftLabelDisplay(oppositeShiftLabel(todayShift))} on your next sheet day when you start the new
                pattern, and keep 24h+ off between End shift and Work.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const tmr =
                    nextDayLabel ? tomorrowShift : "";
                  onSave(todayShift, tmr);
                  handleClose();
                }}
              >
                Save pattern labels
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
