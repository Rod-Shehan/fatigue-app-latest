"use client";

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Rego } from "@/lib/api";
import { SHIFT_PATTERN_FIELD_HELP } from "@/lib/shift-change";

export type DayCardFields = {
  truck_rego?: string;
  start_location?: string;
  destination?: string;
  start_kms?: number | null;
  shift_label?: "A" | "B" | "";
};

const fieldClass =
  "h-12 text-base font-medium placeholder:text-slate-500 dark:placeholder:text-slate-400";

export function DayCardDetailsDialog({
  open,
  onOpenChange,
  dayTitle,
  dateLabel,
  initial,
  regos,
  onConfirm,
  showShiftPatternEducation,
  consecutiveWorkDays,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayTitle: string;
  dateLabel: string;
  initial: DayCardFields;
  regos: Rego[];
  onConfirm: (fields: DayCardFields) => void;
  showShiftPatternEducation?: boolean;
  consecutiveWorkDays?: number;
}) {
  const [draft, setDraft] = useState<DayCardFields>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  const set = (field: keyof DayCardFields, value: unknown) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const regoLabels = (() => {
    const labels = regos.map((r) => r.label);
    const current = draft.truck_rego?.trim();
    if (current && !labels.includes(current)) labels.unshift(current);
    return labels;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{dayTitle}</DialogTitle>
          <DialogDescription className="text-base text-slate-600 dark:text-slate-300">
            {dateLabel} — route and vehicle for this day
          </DialogDescription>
        </DialogHeader>

        {showShiftPatternEducation && (
          <p className="text-sm leading-snug text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <span className="font-semibold">Shift pattern:</span> you&apos;ve worked {consecutiveWorkDays} days in
            a row. If you swap day ↔ night, set pattern below and plan 24 hours off at the change.
          </p>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Start location</Label>
            <Input
              value={draft.start_location || ""}
              onChange={(e) => set("start_location", e.target.value)}
              placeholder="Where you started this day"
              className={fieldClass}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Destination</Label>
            <Input
              value={draft.destination || ""}
              onChange={(e) => set("destination", e.target.value)}
              placeholder="Where you finished or are heading"
              className={fieldClass}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Rego</Label>
            <Select
              value={draft.truck_rego?.trim() || "__none__"}
              onValueChange={(v) => set("truck_rego", v === "__none__" ? "" : v)}
            >
              <SelectTrigger className={`${fieldClass} w-full`}>
                <SelectValue placeholder="Select rego" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select rego —</SelectItem>
                {regoLabels.map((label) => (
                  <SelectItem key={label} value={label} className="font-mono text-base">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label
              className="text-sm font-semibold text-slate-700 dark:text-slate-200"
              title={SHIFT_PATTERN_FIELD_HELP}
            >
              Shift pattern (optional)
            </Label>
            <Select
              value={draft.shift_label || "__none__"}
              onValueChange={(v) => set("shift_label", v === "__none__" ? "" : v)}
            >
              <SelectTrigger className={`${fieldClass} w-full`}>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not set</SelectItem>
                <SelectItem value="A">Day (A)</SelectItem>
                <SelectItem value="B">Night (B)</SelectItem>
              </SelectContent>
            </Select>
            {showShiftPatternEducation ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{SHIFT_PATTERN_FIELD_HELP}</p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">Optional — for day ↔ night changes after 5+ work days.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Start kilometres</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={draft.start_kms ?? ""}
              onChange={(e) =>
                set("start_kms", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="Odometer at start"
              className={`${fieldClass} tabular-nums`}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
          <Button type="button" variant="outline" className="min-h-11 text-base" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11 text-base bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              onConfirm(draft);
              onOpenChange(false);
            }}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
