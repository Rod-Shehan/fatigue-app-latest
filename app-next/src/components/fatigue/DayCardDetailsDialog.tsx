"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { hasRunPlanContent, runPlanValidationError } from "@/lib/route-plan";
import { api } from "@/lib/api";
import {
  dayCardFieldsFromPreset,
  formatRoutePresetOption,
  validateRoutePresetCreateInput,
} from "@/lib/route-preset";
import { ROUTE_CATALOGUE_EMPTY_HINT, ROUTE_CATALOGUE_LOAD_ERROR_HINT } from "@/lib/product-copy";
import { Loader2 } from "lucide-react";
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
import { dayEventsIncludeStop, validateEndKmsRequiredForStop } from "@/lib/end-shift-kms";
import {
  DayEventsEditor,
  normalizeDayEvents,
  type DayEventDraft,
} from "@/components/fatigue/DayEventsEditor";
import { Declared24hRestsField } from "@/components/fatigue/Declared24hRestsField";
import { DriverTypeFields } from "@/components/fatigue/DriverTypeFields";

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
  route_preset_id?: string;
  /** Legacy field — no longer collected in Set up day; retained for historical sheet JSON. */
  alertness_level?: 1 | 2 | 3 | 4 | 5;
  driver_type?: "solo" | "two_up";
  second_driver?: string;
};

const fieldClass =
  "h-12 text-base font-medium placeholder:text-slate-500 dark:placeholder:text-slate-400";

type RouteSetupMode = "catalogue" | "custom" | "none";

export function DayCardDetailsDialog({
  open,
  onOpenChange,
  dayTitle,
  dateLabel,
  driverName,
  initial,
  regos,
  dayIndex,
  sheetDays,
  sheetDayYmd,
  initialEvents = [],
  eventsEditable = false,
  sheetId,
  weekStarting,
  declared24hRests,
  declared24hRestFieldCount = 0,
  onDeclared24hRestChange,
  allowHeaderRestAmend = false,
  readOnly = false,
  onConfirm,
  showShiftPatternEducation,
  patternWorkMinutes = 0,
  continuedFromPreviousDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayTitle: string;
  dateLabel: string;
  /** Shown so Edit day is clearly for this driver (and for manager cross-check). */
  driverName?: string | null;
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
  declared24hRests?: import("@/lib/declared-24h-rests").Declared24hRestFields;
  declared24hRestFieldCount?: 0 | 2 | 4;
  onDeclared24hRestChange?: (
    key: import("@/lib/declared-24h-rests").Declared24hRestKey,
    range: import("@/lib/last-24h-break-range").Last24hBreakRange | null
  ) => void;
  /** Manager: change locked week-header rest dates from Edit day. */
  allowHeaderRestAmend?: boolean;
  readOnly?: boolean;
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
  const [saveCatalogueError, setSaveCatalogueError] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState<RouteSetupMode>("catalogue");
  const [presetPick, setPresetPick] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [serverMaxEndKms, setServerMaxEndKms] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const {
    data: routePresets = [],
    isLoading: presetsLoading,
    isError: presetsError,
  } = useQuery({
    queryKey: ["route-presets"],
    queryFn: () => api.routePresets.list(),
    enabled: open,
  });

  const saveToCatalogueMutation = useMutation({
    mutationFn: () =>
      api.routePresets.create({
        label: (draft.route_label ?? "").trim(),
        start_location: (draft.start_location ?? "").trim() || null,
        destination: (draft.destination ?? "").trim() || null,
        planned_on_duty_hours: draft.planned_on_duty_hours ?? null,
        planned_distance_km: draft.planned_distance_km ?? null,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["route-presets"] });
      setSaveCatalogueError(null);
      setRouteMode("catalogue");
      setPresetPick(created.id);
      setDraft((prev) => ({
        ...prev,
        ...dayCardFieldsFromPreset(created),
        start_kms: prev.start_kms,
        end_kms: prev.end_kms,
        truck_rego: prev.truck_rego,
        shift_label: prev.shift_label,
      }));
    },
    onError: () => setSaveCatalogueError("Could not save to catalogue. Try again."),
  });

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
    setSaveCatalogueError(null);
    setServerMaxEndKms(null);
    const pid = initial.route_preset_id?.trim();
    if (pid) {
      setRouteMode("catalogue");
      setPresetPick(pid);
    } else if (hasRunPlanContent(initial)) {
      setRouteMode("custom");
      setPresetPick("");
    } else {
      setRouteMode("catalogue");
      setPresetPick("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || presetsLoading) return;
    const pid = initial.route_preset_id?.trim();
    if (pid && routePresets.some((p) => p.id === pid)) {
      setRouteMode("catalogue");
      setPresetPick(pid);
    } else if (hasRunPlanContent(initial)) {
      setRouteMode("custom");
      setPresetPick("");
    } else if (routePresets.length === 0 || presetsError) {
      setRouteMode("custom");
      setPresetPick("");
    }
  }, [open, presetsLoading, routePresets, presetsError, initial]);

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
    setDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (
        field === "route_label" ||
        field === "planned_distance_km" ||
        field === "planned_on_duty_hours"
      ) {
        setRouteMode("custom");
        setPresetPick("");
        return {
          ...next,
          route_preset_id: undefined,
          route_source: hasRunPlanContent(next) ? ("adhoc" as const) : undefined,
        };
      }
      return next;
    });
  };

  const switchRouteMode = (mode: RouteSetupMode) => {
    setRouteMode(mode);
    setPlanError(null);
    setSaveCatalogueError(null);
    if (mode === "none") {
      setPresetPick("");
      setDraft((prev) => ({
        ...prev,
        route_label: "",
        planned_distance_km: null,
        planned_on_duty_hours: null,
        route_preset_id: undefined,
        route_source: undefined,
      }));
      return;
    }
    if (mode === "custom") {
      setPresetPick("");
      setDraft((prev) => ({
        ...prev,
        route_preset_id: undefined,
        route_source: hasRunPlanContent(prev) ? ("adhoc" as const) : undefined,
      }));
    }
  };

  const applyPresetSelection = (value: string) => {
    setPresetPick(value);
    setPlanError(null);
    setSaveCatalogueError(null);
    const preset = routePresets.find((p) => p.id === value);
    if (!preset) return;
    setRouteMode("catalogue");
    setDraft((prev) => ({
      ...prev,
      ...dayCardFieldsFromPreset(preset),
      start_kms: prev.start_kms,
      end_kms: prev.end_kms,
      truck_rego: prev.truck_rego,
      shift_label: prev.shift_label,
    }));
  };

  const catalogueFilledRoute =
    routeMode === "catalogue" && presetPick && routePresets.some((p) => p.id === presetPick);

  const handleSaveToCatalogue = () => {
    setSaveCatalogueError(null);
    const err = validateRoutePresetCreateInput({
      label: draft.route_label ?? "",
      planned_distance_km: draft.planned_distance_km ?? null,
      planned_on_duty_hours: draft.planned_on_duty_hours ?? null,
    });
    if (err) {
      setSaveCatalogueError(err);
      return;
    }
    saveToCatalogueMutation.mutate();
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
    }
    const stopKmError = validateEndKmsRequiredForStop(draftEvents, draft.end_kms, {
      sheetDays,
      dayIndex,
      dayStartKms: draft.start_kms,
    });
    if (stopKmError) {
      setKmError(stopKmError);
      return;
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
            {dateLabel} — crew, route, kilometres, and work / break / non-work times for this day
            {driverName?.trim() ? (
              <span className="mt-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-100">
                Driver · {driverName.trim()}
              </span>
            ) : null}
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
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-3">
            <DriverTypeFields
              driverType={draft.driver_type ?? "solo"}
              secondDriver={draft.second_driver}
              onDriverTypeChange={(type) => set("driver_type", type)}
              onSecondDriverChange={(name) => set("second_driver", name)}
              readOnly={readOnly}
            />
          </div>

          {declared24hRestFieldCount >= 2 && onDeclared24hRestChange && (
            <Declared24hRestsField
              fieldCount={declared24hRestFieldCount === 4 ? 4 : 2}
              values={declared24hRests ?? {}}
              onRangeChange={onDeclared24hRestChange}
              readOnly={readOnly}
              allowAmend={allowHeaderRestAmend}
            />
          )}

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-3 space-y-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Route setup</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
              Pick a saved run plan to fill From, To, and expected hours/km — or enter a custom trip.
              Run plans feed forward-looking fatigue exposure only (not compliance until work is logged).
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["catalogue", "Saved run plan"],
                  ["custom", "Custom trip"],
                  ["none", "No run plan"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => switchRouteMode(mode)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    routeMode === mode
                      ? "border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-100"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {routeMode === "catalogue" ? (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Saved run plan
                </Label>
                <Select
                  value={presetPick || "__pick__"}
                  onValueChange={(v) => {
                    if (v !== "__pick__") applyPresetSelection(v);
                  }}
                  disabled={presetsLoading}
                >
                  <SelectTrigger className={`${fieldClass} w-full`}>
                    <SelectValue
                      placeholder={presetsLoading ? "Loading routes…" : "Select a saved route"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__pick__" disabled>
                      Select a saved route…
                    </SelectItem>
                    {routePresets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatRoutePresetOption(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {catalogueFilledRoute ? (
                  <p className="text-xs text-teal-700 dark:text-teal-300">
                    From, To, and run plan filled from catalogue — check below and adjust if needed.
                  </p>
                ) : null}
                {presetsError ? (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {ROUTE_CATALOGUE_LOAD_ERROR_HINT}
                  </p>
                ) : null}
                {!presetsLoading && !presetsError && routePresets.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-snug">
                    {ROUTE_CATALOGUE_EMPTY_HINT}
                  </p>
                ) : null}
              </div>
            ) : null}
            {routeMode === "custom" ? (
              <div className="space-y-3">
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
                {hasRunPlanContent(draft) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={saveToCatalogueMutation.isPending}
                    onClick={handleSaveToCatalogue}
                  >
                    {saveToCatalogueMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Save to route catalogue
                  </Button>
                ) : null}
              </div>
            ) : null}
            {saveCatalogueError ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {saveCatalogueError}
              </p>
            ) : null}
            {planError ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {planError}
              </p>
            ) : null}
          </div>

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
                End km
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
              {dayEventsIncludeStop(draftEvents) ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                  Required here when you worked on this day before End shift. For an overnight finish (End shift only
                  on this card), leave blank if end km is already on the previous day — then you can enter start km and
                  start the next shift.
                </p>
              ) : regoSet ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                  Optional now — enter when you End shift, or before signing the week.
                </p>
              ) : null}
            </div>
          </div>
          {kmError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {kmError}
            </p>
          ) : null}
          {regoSet ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
              Start km is required to begin work. End km is required when you End shift on the same day you worked, and
              again before sign-off. Overnight finish: end km stays on the previous day.
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
            driverType={draft.driver_type ?? "solo"}
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
