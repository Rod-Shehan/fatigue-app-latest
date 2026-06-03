"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { runPlanValidationError } from "@/lib/route-plan";
import { api } from "@/lib/api";
import {
  SHIFT_PATTERN_FIELD_HELP,
  formatPatternStreakForDisplay,
} from "@/lib/shift-change";
import {
  formatOdometerGuideLine,
  getOdometerGuideForDay,
  validateDayKms,
  type DayWithKms,
} from "@/lib/rego-kms-validation";
import {
  DayEventsEditor,
  normalizeDayEvents,
  type DayEventDraft,
} from "@/components/fatigue/DayEventsEditor";

export type DayCardFields = {
  truck_rego?: string;
  start_location?: string;
  destination?: string;
  start_kms?: number | null;
  end_kms?: number | null;
  shift_label?: "A" | "B" | "";
  route_label?: string;
  planned_distance_km?: number | null;
  planned_on_duty_hours?: number | null;
  route_source?: "adhoc" | "driver_saved" | "org_preset";
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
  dayIndex,
  sheetDays,
  sheetDayYmd,
  initialEvents = [],
  eventsEditable = false,
  sheetId,
  weekStarting,
  driverType,
  onConfirm,
  showShiftPatternEducation,
  patternWorkMinutes = 0,
  continuedFromPreviousDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayTitle: string;
  dateLabel: string;
  initial: DayCardFields;
  regos: Rego[];
  /** Index of this day in sheetDays (for rolling km validation). */
  dayIndex: number;
  /** Full week days — used to validate start/end km against prior days on the same rego. */
  sheetDays: DayWithKms[];
  /** Calendar day YYYY-MM-DD for time inputs. */
  sheetDayYmd: string;
  initialEvents?: DayEventDraft[];
  /** When true, driver can edit/add/remove events in this dialog. */
  eventsEditable?: boolean;
  sheetId?: string;
  weekStarting?: string;
  driverType?: string;
  onConfirm: (fields: DayCardFields, events: DayEventDraft[]) => void;
  showShiftPatternEducation?: boolean;
  /** Rolling minutes on same shift pattern ending at this day. */
  patternWorkMinutes?: number;
  /** When shift continued overnight — pre-filled fields may be carried from the prior day. */
  continuedFromPreviousDay?: string;
}) {
  const [draft, setDraft] = useState<DayCardFields>(initial);
  const [draftEvents, setDraftEvents] = useState<DayEventDraft[]>(initialEvents);
  const [kmError, setKmError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [serverMaxEndKms, setServerMaxEndKms] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    // Important: keep dialog draft stable while open. The parent sheet can refetch/invalidate
    // during autosave which would otherwise blow away in-progress typing.
    setDraft(initial);
    setDraftEvents(
      normalizeDayEvents(
        initialEvents.filter((e) => e && typeof e.time === "string" && typeof e.type === "string")
      )
    );
    setKmError(null);
    setPlanError(null);
    setServerMaxEndKms(null);
  }, [open]);

  const regoForGuide = (draft.truck_rego ?? "").trim();

  useEffect(() => {
    if (!open || !regoForGuide) {
      setServerMaxEndKms(null);
      return;
    }
    let cancelled = false;
    api.sheets
      .regoMaxEndKms(regoForGuide, {
        excludeSheetId: sheetId,
        beforeWeekStarting: weekStarting,
      })
      .then((res) => {
        if (!cancelled) setServerMaxEndKms(res.maxEndKms);
      })
      .catch(() => {
        if (!cancelled) setServerMaxEndKms(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, regoForGuide, sheetId, weekStarting]);

  const odometerGuide = useMemo(() => {
    if (!regoForGuide) return null;
    return getOdometerGuideForDay(sheetDays, dayIndex, regoForGuide, serverMaxEndKms);
  }, [regoForGuide, sheetDays, dayIndex, serverMaxEndKms]);

  const odometerGuideLine = formatOdometerGuideLine(odometerGuide);
  const startPlaceholder =
    odometerGuide?.minAllowed != null
      ? String(odometerGuide.minAllowed)
      : "Odometer at start";

  const set = (field: keyof DayCardFields, value: unknown) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const regoLabels = (() => {
    const labels = regos.map((r) => r.label);
    const current = draft.truck_rego?.trim();
    if (current && !labels.includes(current)) labels.unshift(current);
    return labels;
  })();

  const regoSet = (draft.truck_rego ?? "").trim() !== "";

  const handleConfirm = async () => {
    setKmError(null);
    setPlanError(null);
    const planErr = runPlanValidationError(draft);
    if (planErr) {
      setPlanError(planErr);
      return;
    }
    const rego = (draft.truck_rego ?? "").trim();
    if (rego) {
      if (draft.start_kms == null || Number.isNaN(Number(draft.start_kms))) {
        setKmError("Start km is required when rego is set.");
        return;
      }
      if (draft.end_kms == null || Number.isNaN(Number(draft.end_kms))) {
        setKmError("End km is required when rego is set (odometer at end of shift).");
        return;
      }
    }
    const daysForValidation: DayWithKms[] = sheetDays.map((d, i) =>
      i === dayIndex
        ? {
            truck_rego: draft.truck_rego,
            start_kms: draft.start_kms,
            end_kms: draft.end_kms,
          }
        : d
    );
    let serverMaxEndKms: number | null = null;
    if (rego) {
      setConfirming(true);
      try {
        const res = await api.sheets.regoMaxEndKms(rego, {
          excludeSheetId: sheetId,
          beforeWeekStarting: weekStarting,
        });
        serverMaxEndKms = res.maxEndKms;
      } catch {
        /* offline: validate with this sheet only */
      } finally {
        setConfirming(false);
      }
    }
    const validation = validateDayKms(
      daysForValidation,
      dayIndex,
      rego,
      draft.start_kms ?? null,
      draft.end_kms ?? null,
      serverMaxEndKms
    );
    if (!validation.valid) {
      setKmError(validation.message ?? "Invalid kilometres.");
      return;
    }
    onConfirm(draft, normalizeDayEvents(draftEvents));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,720px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{dayTitle}</DialogTitle>
          <DialogDescription className="text-base text-slate-600 dark:text-slate-300">
            {dateLabel} — route, kilometres, and work / break / non-work times for this day
          </DialogDescription>
        </DialogHeader>

        {showShiftPatternEducation && (
          <p className="text-sm leading-snug text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <span className="font-semibold">Shift pattern:</span> you&apos;ve reached{" "}
            {formatPatternStreakForDisplay(patternWorkMinutes)}. If you swap day ↔ night, set pattern below and
            plan 24 hours off between End shift and your next Work at the change.
          </p>
        )}

        {continuedFromPreviousDay && (
          <p className="text-sm leading-snug text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <span className="font-semibold">Continued shift:</span> values below may be carried from {continuedFromPreviousDay}.
            Check and confirm they are correct for this day.
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
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-3 space-y-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Run plan (optional)</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
              For upcoming days: expected distance and/or on-duty time. Used for forward-looking fatigue exposure
              (not a compliance violation until work is logged).
            </p>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Route name</Label>
              <Input
                value={draft.route_label || ""}
                onChange={(e) => set("route_label", e.target.value)}
                placeholder="e.g. Kalgoorlie return"
                className={fieldClass}
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Expected hours</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={draft.planned_on_duty_hours ?? ""}
                  onChange={(e) =>
                    set("planned_on_duty_hours", e.target.value === "" ? null : Number(e.target.value))
                  }
                  placeholder="e.g. 9"
                  className={`${fieldClass} tabular-nums`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Expected km</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={draft.planned_distance_km ?? ""}
                  onChange={(e) =>
                    set("planned_distance_km", e.target.value === "" ? null : Number(e.target.value))
                  }
                  placeholder="e.g. 420"
                  className={`${fieldClass} tabular-nums`}
                />
              </div>
            </div>
            {planError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {planError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Start km{regoSet ? <span className="text-red-600 dark:text-red-400 font-normal"> *</span> : null}
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                value={draft.start_kms ?? ""}
                onChange={(e) =>
                  set("start_kms", e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder={startPlaceholder}
                className={`${fieldClass} tabular-nums`}
              />
              {regoSet && odometerGuideLine ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                  {odometerGuideLine}
                  {odometerGuide?.minAllowed != null &&
                  (draft.start_kms == null || Number.isNaN(Number(draft.start_kms))) ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="font-semibold text-teal-700 dark:text-teal-400 underline-offset-2 hover:underline"
                        onClick={() => set("start_kms", odometerGuide.minAllowed)}
                      >
                        Fill
                      </button>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                End km{regoSet ? <span className="text-red-600 dark:text-red-400 font-normal"> *</span> : null}
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                value={draft.end_kms ?? ""}
                onChange={(e) =>
                  set("end_kms", e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="At end of shift"
                className={`${fieldClass} tabular-nums`}
              />
            </div>
          </div>
          {kmError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {kmError}
            </p>
          ) : null}
          {regoSet ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
              Both readings required to sign the week. End shift can capture end km on the day you finish.
            </p>
          ) : null}
        </div>

        {(eventsEditable || draftEvents.length > 0) && (
          <DayEventsEditor
            sheetDayYmd={sheetDayYmd}
            events={draftEvents}
            onChange={setDraftEvents}
            readOnly={!eventsEditable}
            sheetId={sheetId}
            driverType={driverType}
          />
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
          <Button type="button" variant="outline" className="min-h-11 text-base" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11 text-base bg-emerald-600 hover:bg-emerald-700"
            disabled={confirming}
            onClick={() => void handleConfirm()}
          >
            {confirming ? "Checking…" : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
