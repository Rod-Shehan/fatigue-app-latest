"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveDriverRouteDefaults, hasRouteExceptKms, inferRouteCarryMode } from "@/lib/driver-route-defaults";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowRight, ChevronDown, MoreVertical } from "lucide-react";
import WorkSafeDaySheet from "./WorkSafeDaySheet";
import { motion } from "framer-motion";
import type { Rego } from "@/lib/api";
import { formatSheetDisplayDate, getSheetDayDateString } from "@/lib/weeks";
import { getHours } from "@/lib/compliance";
import { formatHoursStatistic } from "@/lib/hours";
import { formatPatternStreakForDisplay, patternStreakThresholdMet } from "@/lib/shift-change";
import { DayCardDetailsDialog, type DayCardFields } from "./DayCardDetailsDialog";
import { DayTripChecklist } from "./DayTripChecklist";
import { FitnessForWorkForm } from "@/components/checklist/FitnessForWorkForm";
import { PrestartForm } from "@/components/checklist/PrestartForm";
import { DimensionLoadForm } from "@/components/checklist/DimensionLoadForm";
import { ChecklistRecordViewer } from "@/components/checklist/ChecklistRecordViewer";
import {
  appendChecklistToDay,
  hasCompletedChecklistOfType,
  listCompletedChecklistsOfType,
  type ChecklistRecord,
  type ChecklistRecordType,
} from "@/lib/checklist";
import { api } from "@/lib/api";
import { getEffectiveOpenActivityAtDayEnd } from "@/components/fatigue/EventLogger";
import { cn } from "@/lib/utils";
import {
  CONTINUED_SHIFT_ROUTE_CARD_NOTE,
  formatContinuedShiftRouteBanner,
} from "@/lib/product-copy";
import {
  driverAmberBtn,
  driverCard,
  driverCardBtn,
  driverCardDefault,
  driverCardToday,
  driverCollapsedRow,
  driverIconBtnBordered,
  driverPanel,
} from "@/components/driver/driver-ui-classes";
import type { DayWithKms } from "@/lib/rego-kms-validation";
import { formatRunPlanSummary, hasRunPlanContent } from "@/lib/route-plan";
import { DayCardToolsSheet } from "@/components/driver/DayCardToolsSheet";
import { formatDayCrewLabel, resolveDayCrew } from "@/lib/day-crew";

export type DayCardToolsConfig = {
  sheetId: string;
  weekStarting?: string;
  last24hBreak?: string;
  declared24hRestUnset?: boolean;
  complianceLoading?: boolean;
  complianceDetail: string;
  complianceTone: "ok" | "warn" | "issue";
  unsignedPastWeeksCount?: number;
  onOpenGear: () => void;
  driverName?: string | null;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DayData = DayCardFields & {
  end_kms?: number | null;
  route_confirmed?: boolean;
  route_label?: string;
  planned_distance_km?: number | null;
  planned_on_duty_hours?: number | null;
  route_source?: "adhoc" | "driver_saved" | "org_preset";
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  events?: { time: string; type: string; driver?: "primary" | "second" }[];
  date?: string;
  checklists?: ChecklistRecord[];
};

function formatShiftLabel(label?: "A" | "B" | ""): string {
  if (label === "A") return "Day (A)";
  if (label === "B") return "Night (B)";
  return "—";
}

function formatKm(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-AU");
}

function StatBlock({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-semibold truncate mt-0.5",
          emphasis ? "text-amber-900 dark:text-amber-100" : "text-slate-900 dark:text-slate-100",
          mono && "font-mono tabular-nums tracking-tight"
        )}
      >
        {value || "—"}
      </p>
    </div>
  );
}

export default function DayEntry({
  dayIndex,
  dayData,
  continuedShiftRoute = null,
  onUpdate,
  weekStart,
  regos = [],
  readOnly = false,
  patternWorkMinutes = 0,
  todayYmd,
  /** When true (default), past/future days render as a single summary row. */
  collapseWhenNotToday = true,
  allDays = [],
  sheetId,
  driverType,
  secondDriver,
  declared24hRests,
  declared24hRestFieldCount = 0,
  onDeclared24hRestChange,
  onCrewMetaSync,
  dayTools,
  setupOpenRequest,
  onDetailsDialogClosed,
  driverName,
  allowHeaderRestAmend = false,
  activityBeforeDay = null,
}: {
  dayIndex: number;
  dayData: DayData;
  /** When set, open work/break continues from the prior day — prompt to confirm route on this card. */
  continuedShiftRoute?: { previousDayName: string } | null;
  onUpdate: (idx: number, d: DayData) => void;
  weekStart: string;
  regos?: Rego[];
  readOnly?: boolean;
  /** Rolling minutes on the same shift pattern ending at this day (not calendar days). */
  patternWorkMinutes?: number;
  todayYmd: string;
  collapseWhenNotToday?: boolean;
  allDays?: DayWithKms[];
  sheetId?: string;
  driverType?: string;
  secondDriver?: string;
  declared24hRests?: import("@/lib/declared-24h-rests").Declared24hRestFields;
  declared24hRestFieldCount?: 0 | 2 | 4;
  onDeclared24hRestChange?: (
    key: import("@/lib/declared-24h-rests").Declared24hRestKey,
    range: import("@/lib/last-24h-break-range").Last24hBreakRange | null
  ) => void;
  /** When today's crew is confirmed in Set up day, sync sheet header for LogBar / compliance. */
  onCrewMetaSync?: (crew: { driver_type: "solo" | "two_up"; second_driver: string }) => void;
  /** Sheet-level tools (compliance, PDF, gear) — today only. */
  dayTools?: DayCardToolsConfig;
  /** Parent bump opens Set up day (e.g. Start shift blocked → Go to today's card). */
  setupOpenRequest?: number;
  /** Fired when Set up / Edit day dialog closes. */
  onDetailsDialogClosed?: () => void;
  /** Shown in Edit day so the form is clearly for this driver. */
  driverName?: string | null;
  /** Manager: change locked week-header rest dates from Edit day. */
  allowHeaderRestAmend?: boolean;
  /** Open activity before this week day 0 (prior week carry). */
  activityBeforeDay?: import("@/lib/day-event-edit-rules").PriorOpenActivity;
}) {
  const getDateStr = () => {
    if (!weekStart) return "";
    return formatSheetDisplayDate(getSheetDayDateString(weekStart, dayIndex));
  };
  const getISODate = () => (weekStart ? getSheetDayDateString(weekStart, dayIndex) : todayYmd);

  const kmsTotal =
    dayData.end_kms != null && dayData.start_kms != null ? Math.max(0, dayData.end_kms - dayData.start_kms) : 0;

  const sheetDayYmd = weekStart ? getSheetDayDateString(weekStart, dayIndex) : todayYmd;
  const isToday = sheetDayYmd === todayYmd;
  const isPast = sheetDayYmd < todayYmd;
  const isFuture = sheetDayYmd > todayYmd;

  const { data: session } = useSession();
  const driverUserKey = (session?.user as { email?: string | null } | undefined)?.email?.trim() ?? "";

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [ffwOpen, setFfwOpen] = useState(false);
  const [prestartOpen, setPrestartOpen] = useState(false);
  const [dimensionLoadOpen, setDimensionLoadOpen] = useState(false);
  const [viewChecklistType, setViewChecklistType] = useState<ChecklistRecordType | null>(null);
  const [runPlanOpen, setRunPlanOpen] = useState(false);
  const [expanded, setExpanded] = useState(isToday);
  const lastSetupOpenRequestRef = useRef(0);

  const events = useMemo(() => {
    const base = (dayData.events ?? []).filter((e) => e && typeof e.time === "string" && typeof e.type === "string");
    return [...base].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [dayData.events]);

  const showShiftPatternEducation =
    patternStreakThresholdMet(patternWorkMinutes) && !dayData.shift_label;

  const canEditDetails = !readOnly;
  const ffwFormCompleted = hasCompletedChecklistOfType(dayData.checklists, "ffw");
  const prestartFormCompleted = hasCompletedChecklistOfType(dayData.checklists, "prestart");
  const dimensionLoadFormCompleted = hasCompletedChecklistOfType(
    dayData.checklists,
    "dimension_load"
  );
  const hasAnyChecklistRecord =
    ffwFormCompleted || prestartFormCompleted || dimensionLoadFormCompleted;

  const openFfwForm = useCallback(() => {
    if (!canEditDetails) return;
    setToolsOpen(false);
    setFfwOpen(true);
  }, [canEditDetails]);

  const openPrestartForm = useCallback(() => {
    if (!canEditDetails) return;
    setToolsOpen(false);
    setPrestartOpen(true);
  }, [canEditDetails]);

  const openDimensionLoadForm = useCallback(() => {
    if (!canEditDetails) return;
    setToolsOpen(false);
    setDimensionLoadOpen(true);
  }, [canEditDetails]);

  const openViewChecklist = useCallback((type: ChecklistRecordType) => {
    setToolsOpen(false);
    setViewChecklistType(type);
  }, []);

  const produceDayChecklistPdf = useCallback(() => {
    if (!dayTools?.sheetId) return;
    setToolsOpen(false);
    window.open(api.sheets.checklistPdfUrl(dayTools.sheetId, dayIndex), "_blank");
  }, [dayTools?.sheetId, dayIndex]);

  const emailDayChecklistPdf = useCallback(async () => {
    if (!dayTools?.sheetId) return;
    setToolsOpen(false);
    try {
      await api.sheets.emailChecklistPdf(dayTools.sheetId, dayIndex);
      window.alert("Checklist PDF emailed to Circadia holding inbox.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not email checklist PDF";
      window.alert(msg);
    }
  }, [dayTools?.sheetId, dayIndex]);

  const saveFfwRecord = useCallback(
    (record: ChecklistRecord) => {
      onUpdate(dayIndex, appendChecklistToDay(dayData, record));
    },
    [dayData, dayIndex, onUpdate]
  );

  const savePrestartRecord = useCallback(
    (record: ChecklistRecord) => {
      onUpdate(dayIndex, appendChecklistToDay(dayData, record));
    },
    [dayData, dayIndex, onUpdate]
  );

  const saveDimensionLoadRecord = useCallback(
    (record: ChecklistRecord) => {
      onUpdate(dayIndex, appendChecklistToDay(dayData, record));
    },
    [dayData, dayIndex, onUpdate]
  );

  useEffect(() => {
    if (!setupOpenRequest || setupOpenRequest <= lastSetupOpenRequestRef.current) return;
    lastSetupOpenRequestRef.current = setupOpenRequest;
    if (canEditDetails) setDetailsOpen(true);
  }, [setupOpenRequest, canEditDetails]);

  const handleDetailsOpenChange = useCallback(
    (open: boolean) => {
      setDetailsOpen(open);
      if (!open) onDetailsDialogClosed?.();
    },
    [onDetailsDialogClosed]
  );

  const runPlanSummary = formatRunPlanSummary(dayData);
  const usesRunPlan = inferRouteCarryMode(dayData) === "run_plan" && hasRunPlanContent(dayData);
  const showManualFromTo = !usesRunPlan;

  const hasRouteDetails = usesRunPlan
    ? hasRunPlanContent(dayData) ||
      (dayData.truck_rego ?? "").trim() !== "" ||
      (dayData.start_location ?? "").trim() !== "" ||
      dayData.start_kms != null
    : (dayData.start_location ?? "").trim() !== "" ||
      (dayData.destination ?? "").trim() !== "" ||
      (dayData.truck_rego ?? "").trim() !== "" ||
      dayData.start_kms != null;

  const detailsComplete = usesRunPlan
    ? (dayData.truck_rego ?? "").trim() !== "" &&
      dayData.start_kms != null &&
      !Number.isNaN(Number(dayData.start_kms))
    : (dayData.truck_rego ?? "").trim() !== "" &&
      (dayData.start_location ?? "").trim() !== "" &&
      (dayData.destination ?? "").trim() !== "" &&
      dayData.start_kms != null &&
      !Number.isNaN(Number(dayData.start_kms));

  const showInlineStartKm =
    isToday &&
    canEditDetails &&
    (usesRunPlan
      ? (dayData.truck_rego ?? "").trim() !== ""
      : hasRouteExceptKms(dayData)) &&
    !detailsComplete;

  const showRunPlanSection = usesRunPlan && isFuture && !!runPlanSummary;
  const showRunPlanInCard = usesRunPlan && !isFuture && !!runPlanSummary;

  const dayCrew = resolveDayCrew(dayData, {
    driver_type: driverType,
    second_driver: secondDriver,
  });

  const workHours = getHours(dayData.work_time);
  const collapsedSummary = isFuture
    ? "Upcoming"
    : workHours > 0
      ? `${formatHoursStatistic(workHours)}h work`
      : (dayData.events?.length ?? 0) > 0
        ? "Logged"
        : "No activity";

  if (collapseWhenNotToday && !isToday && !expanded) {
    const summaryLabel = readOnly ? `${collapsedSummary}. Read only.` : `${collapsedSummary}. Tap to expand and edit.`;
    const rowClass = cn(
      driverCollapsedRow,
      readOnly
        ? isPast
          ? "bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-90"
          : "bg-slate-50/80 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80"
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 active:bg-slate-100 transition-colors"
    );
    const inner = (
      <>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
            isPast
              ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          )}
        >
          {DAY_NAMES[dayIndex]?.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate leading-tight">
            {DAY_NAMES[dayIndex]}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 tabular-nums truncate">{getDateStr()}</p>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
          {collapsedSummary}
        </span>
        {!readOnly && <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" aria-hidden />}
      </>
    );
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: dayIndex * 0.02 }}
      >
        {readOnly ? (
          <div className={rowClass} aria-label={`${DAY_NAMES[dayIndex]}, ${getDateStr()}. ${summaryLabel}`}>
            {inner}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={rowClass}
            aria-label={`${DAY_NAMES[dayIndex]}, ${getDateStr()}. ${summaryLabel}`}
            aria-expanded={false}
          >
            {inner}
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.04 }}
      className={cn(
        driverCard,
        isToday ? driverCardToday : driverCardDefault
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold shrink-0",
              isToday
                ? "bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-900"
                : "bg-slate-900 dark:bg-slate-600 text-white dark:text-slate-200"
            )}
          >
            {DAY_NAMES[dayIndex]?.charAt(0)}
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "text-base font-bold",
                isToday ? "text-amber-800 dark:text-amber-300" : "text-slate-800 dark:text-slate-100"
              )}
            >
              {DAY_NAMES[dayIndex]}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{getDateStr()}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:w-auto sm:ml-auto">
          {dayTools && (
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              className={driverIconBtnBordered}
              aria-label="Day tools — compliance, records, settings"
            >
              <MoreVertical className="h-6 w-6" aria-hidden />
            </button>
          )}
          {collapseWhenNotToday && !isToday && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[44px] h-11 text-xs text-slate-500 rounded-xl"
              onClick={() => setExpanded(false)}
            >
              Collapse
            </Button>
          )}
          {canEditDetails && (
            <Button
              type="button"
              variant={detailsComplete ? "outline" : "default"}
              size="default"
              className={cn(
                driverCardBtn,
                "w-full sm:w-auto",
                !detailsComplete && "bg-amber-600 hover:bg-amber-700 text-white"
              )}
              onClick={() => setDetailsOpen(true)}
            >
              <Pencil className="w-5 h-5 shrink-0" aria-hidden />
              {hasRouteDetails ? "Edit day" : "Set up day"}
            </Button>
          )}
        </div>
      </div>

      {(canEditDetails ||
        dayData.fitness_for_work === true ||
        dayData.dimension_load_checklist === true ||
        dayData.daily_vehicle_checklist === true) && (
        <DayTripChecklist
          className="mb-3"
          variant="card"
          readOnly={!canEditDetails}
          ffwFormCompleted={ffwFormCompleted}
          onOpenFfw={canEditDetails ? openFfwForm : undefined}
          onViewFfw={ffwFormCompleted ? () => openViewChecklist("ffw") : undefined}
          prestartFormCompleted={prestartFormCompleted}
          onOpenPrestart={canEditDetails ? openPrestartForm : undefined}
          onViewPrestart={prestartFormCompleted ? () => openViewChecklist("prestart") : undefined}
          dimensionLoadFormCompleted={dimensionLoadFormCompleted}
          onOpenDimensionLoad={canEditDetails ? openDimensionLoadForm : undefined}
          onViewDimensionLoad={
            dimensionLoadFormCompleted ? () => openViewChecklist("dimension_load") : undefined
          }
          value={{
            fitness_for_work: dayData.fitness_for_work,
            dimension_load_checklist: dayData.dimension_load_checklist,
            daily_vehicle_checklist: dayData.daily_vehicle_checklist,
          }}
          onChange={(next) =>
            onUpdate(dayIndex, {
              ...dayData,
              fitness_for_work: next.fitness_for_work,
              dimension_load_checklist: next.dimension_load_checklist,
              daily_vehicle_checklist: next.daily_vehicle_checklist,
            })
          }
        />
      )}

      {continuedShiftRoute && canEditDetails && (
        <div
          className="mb-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-600 px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
          role="status"
        >
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100 flex-1 min-w-0">
            {formatContinuedShiftRouteBanner(continuedShiftRoute.previousDayName)}
          </p>
          <Button
            type="button"
            size="sm"
            className={cn(driverAmberBtn, "w-auto shrink-0 px-4")}
            onClick={() => setDetailsOpen(true)}
          >
            Confirm route & times
          </Button>
        </div>
      )}

      <div
        className={cn(
          driverPanel,
          isToday && !detailsComplete && canEditDetails
            ? "border-amber-300 dark:border-amber-700"
            : undefined
        )}
      >
        {!hasRouteDetails ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {readOnly ? "No route details recorded." : "Route and vehicle not set — use Set up day before Start shift."}
          </p>
        ) : (
          <>
            {continuedShiftRoute && (
              <p className="text-xs text-amber-800 dark:text-amber-200 mb-2 leading-snug">
                {CONTINUED_SHIFT_ROUTE_CARD_NOTE}
              </p>
            )}
            {showRunPlanInCard ? (
              <div className="mb-3 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Run plan
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{runPlanSummary}</p>
              </div>
            ) : null}
            {showManualFromTo ? (
              <div className="flex items-center gap-2 min-w-0 mb-3">
                <StatBlock label="From" value={(dayData.start_location || "").trim() || "—"} emphasis />
                <ArrowRight className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                <StatBlock label="To" value={(dayData.destination || "").trim() || "—"} emphasis />
              </div>
            ) : null}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-3">
              <StatBlock label="Crew" value={formatDayCrewLabel(dayCrew)} />
              <StatBlock label="Rego" value={(dayData.truck_rego || "").trim() || "—"} mono />
              <StatBlock label="Pattern" value={formatShiftLabel(dayData.shift_label)} />
              <StatBlock label="Start km" value={formatKm(dayData.start_kms)} mono />
              <StatBlock label="End km" value={formatKm(dayData.end_kms)} mono />
              <StatBlock
                label="Trip km"
                value={kmsTotal > 0 ? formatKm(kmsTotal) : dayData.end_kms != null ? formatKm(0) : "—"}
                mono
              />
            </div>
          </>
        )}
        {showInlineStartKm && (
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
            <Label
              htmlFor={`day-${dayIndex}-start-km`}
              className="text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Start km (required before Work)
            </Label>
            <Input
              id={`day-${dayIndex}-start-km`}
              type="number"
              inputMode="numeric"
              className="h-12 text-base font-medium tabular-nums"
              placeholder="Odometer now"
              value={dayData.start_kms ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                const start_kms = raw === "" ? null : Number(raw);
                const merged = {
                  ...dayData,
                  start_kms: start_kms != null && !Number.isNaN(start_kms) ? start_kms : null,
                };
                onUpdate(dayIndex, merged);
                if (driverUserKey) saveDriverRouteDefaults(driverUserKey, merged);
              }}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              {usesRunPlan
                ? "Run plan and rego are filled from your last trip. Check them, enter start km, then tap Work."
                : "Rego and route are filled from your last trip. Check them, enter start km, then tap Work."}
            </p>
          </div>
        )}
      </div>

      {showRunPlanSection && (
        <div className="mb-3 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left bg-slate-100/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
            onClick={() => setRunPlanOpen((o) => !o)}
            aria-expanded={runPlanOpen}
          >
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Run plan</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1 text-right">
              {runPlanSummary || (isFuture ? "Not set" : "—")}
            </span>
            <ChevronDown
              className={cn("w-4 h-4 shrink-0 text-slate-500 transition-transform", runPlanOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {runPlanOpen && (
            <div className="px-3 pb-3 pt-1 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {runPlanSummary || "No run plan — add in Set up day for forward fatigue exposure."}
              </p>
              {canEditDetails && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 mt-1 text-teal-700 dark:text-teal-400"
                  onClick={() => setDetailsOpen(true)}
                >
                  Edit in Set up day
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {showShiftPatternEducation && !detailsOpen && (
        <p className="mb-2 text-xs leading-snug text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
          <span className="font-semibold">Shift pattern:</span> set Day (A) or Night (B) in route details if you swap
          patterns after {formatPatternStreakForDisplay(patternWorkMinutes)}.
        </p>
      )}

      <WorkSafeDaySheet
        dayData={{ ...dayData, date: getISODate() }}
        regulatoryTodayYmd={todayYmd}
        dayLabel={DAY_NAMES[dayIndex]}
        driverName={driverName}
        className="mt-1"
      />

      {dayTools && (
        <DayCardToolsSheet
          open={toolsOpen}
          onOpenChange={setToolsOpen}
          sheetId={dayTools.sheetId}
          weekStarting={dayTools.weekStarting}
          last24hBreak={dayTools.last24hBreak}
          complianceLoading={dayTools.complianceLoading}
          complianceDetail={dayTools.complianceDetail}
          complianceTone={dayTools.complianceTone}
          unsignedPastWeeksCount={dayTools.unsignedPastWeeksCount}
          onOpenGear={dayTools.onOpenGear}
          onOpenDaySetup={() => setDetailsOpen(true)}
          onOpenFfw={canEditDetails ? openFfwForm : undefined}
          onViewFfw={ffwFormCompleted ? () => openViewChecklist("ffw") : undefined}
          ffwFormCompleted={ffwFormCompleted}
          onOpenPrestart={canEditDetails ? openPrestartForm : undefined}
          onViewPrestart={prestartFormCompleted ? () => openViewChecklist("prestart") : undefined}
          prestartFormCompleted={prestartFormCompleted}
          onOpenDimensionLoad={canEditDetails ? openDimensionLoadForm : undefined}
          onViewDimensionLoad={
            dimensionLoadFormCompleted ? () => openViewChecklist("dimension_load") : undefined
          }
          dimensionLoadFormCompleted={dimensionLoadFormCompleted}
          onProduceChecklistPdf={
            dayTools && hasAnyChecklistRecord ? produceDayChecklistPdf : undefined
          }
          onEmailChecklistPdf={
            dayTools && hasAnyChecklistRecord ? emailDayChecklistPdf : undefined
          }
          last24hUnset={!dayTools.last24hBreak?.trim()}
          declared24hRestUnset={dayTools.declared24hRestUnset}
          driverName={dayTools.driverName ?? driverName}
        />
      )}

      <FitnessForWorkForm
        open={ffwOpen}
        onClose={() => setFfwOpen(false)}
        driverName={dayTools?.driverName ?? driverName}
        onCompleted={saveFfwRecord}
      />

      <PrestartForm
        open={prestartOpen}
        onClose={() => setPrestartOpen(false)}
        driverName={dayTools?.driverName ?? driverName}
        sheetDayLabel={`${DAY_NAMES[dayIndex] ?? "Day"} ${getDateStr()}`}
        onCompleted={savePrestartRecord}
      />

      <DimensionLoadForm
        open={dimensionLoadOpen}
        onClose={() => setDimensionLoadOpen(false)}
        driverName={dayTools?.driverName ?? driverName}
        truckRego={dayData.truck_rego}
        onCompleted={saveDimensionLoadRecord}
      />

      {viewChecklistType ? (
        <ChecklistRecordViewer
          open
          type={viewChecklistType}
          records={listCompletedChecklistsOfType(dayData.checklists, viewChecklistType)}
          onClose={() => setViewChecklistType(null)}
          onRedo={
            canEditDetails
              ? () => {
                  const t = viewChecklistType;
                  setViewChecklistType(null);
                  if (t === "ffw") setFfwOpen(true);
                  else if (t === "prestart") setPrestartOpen(true);
                  else setDimensionLoadOpen(true);
                }
              : undefined
          }
          onProducePdf={
            dayTools?.sheetId
              ? () => {
                  window.open(api.sheets.checklistPdfUrl(dayTools.sheetId, dayIndex), "_blank");
                }
              : undefined
          }
          onEmailPdf={
            dayTools?.sheetId
              ? async () => {
                  try {
                    await api.sheets.emailChecklistPdf(dayTools.sheetId, dayIndex);
                    window.alert("Checklist PDF emailed to Circadia holding inbox.");
                  } catch (e) {
                    window.alert(e instanceof Error ? e.message : "Could not email checklist PDF");
                  }
                }
              : undefined
          }
        />
      ) : null}

      {canEditDetails && (
        <DayCardDetailsDialog
          open={detailsOpen}
          onOpenChange={handleDetailsOpenChange}
          dayTitle={DAY_NAMES[dayIndex] ?? "Day"}
          dateLabel={getDateStr()}
          driverName={driverName}
          initial={{
            truck_rego: dayData.truck_rego,
            start_location: dayData.start_location,
            destination: dayData.destination,
            start_kms: dayData.start_kms,
            end_kms: dayData.end_kms,
            shift_label: dayData.shift_label,
            route_label: dayData.route_label,
            planned_distance_km: dayData.planned_distance_km,
            planned_on_duty_hours: dayData.planned_on_duty_hours,
            route_source: dayData.route_source,
            route_preset_id: dayData.route_preset_id,
            // Preserve historical value if present; field is no longer editable in the dialog.
            alertness_level: dayData.alertness_level,
            fitness_for_work: dayData.fitness_for_work,
            dimension_load_checklist: dayData.dimension_load_checklist,
            daily_vehicle_checklist: dayData.daily_vehicle_checklist,
            checklists: dayData.checklists,
            driver_type: dayData.driver_type ?? (driverType === "two_up" ? "two_up" : "solo"),
            second_driver: dayData.second_driver ?? secondDriver ?? "",
          }}
          regos={regos}
          dayIndex={dayIndex}
          sheetDays={allDays}
          sheetDayYmd={sheetDayYmd}
          initialEvents={events}
          eventsEditable={canEditDetails}
          sheetId={sheetId}
          weekStarting={weekStart}
          declared24hRests={declared24hRests}
          declared24hRestFieldCount={declared24hRestFieldCount}
          onDeclared24hRestChange={onDeclared24hRestChange}
          allowHeaderRestAmend={allowHeaderRestAmend}
          readOnly={readOnly}
          showShiftPatternEducation={showShiftPatternEducation}
          patternWorkMinutes={patternWorkMinutes}
          continuedFromPreviousDay={continuedShiftRoute?.previousDayName}
          activityBeforeDay={
            activityBeforeDay ??
            (dayIndex > 0 && allDays[dayIndex - 1]
              ? getEffectiveOpenActivityAtDayEnd(
                  allDays[dayIndex - 1] as {
                    work_time?: boolean[];
                    breaks?: boolean[];
                    non_work?: boolean[];
                    events?: { time: string; type: string }[];
                  },
                  getSheetDayDateString(weekStart, dayIndex - 1),
                  sheetDayYmd
                )
              : null)
          }
          onConfirm={(fields, updatedEvents) => {
            const planFields = hasRunPlanContent(fields)
              ? {
                  ...fields,
                  route_source: fields.route_preset_id
                    ? fields.route_source
                    : ("adhoc" as const),
                  route_preset_id: fields.route_preset_id,
                }
              : {
                  ...fields,
                  route_source: undefined,
                  route_preset_id: undefined,
                };
            const merged = {
              ...dayData,
              ...planFields,
              driver_type: fields.driver_type ?? dayCrew.driver_type,
              second_driver: fields.second_driver ?? "",
              events: updatedEvents,
              route_confirmed: true,
            };
            onUpdate(dayIndex, merged);
            if (isToday && onCrewMetaSync) {
              onCrewMetaSync({
                driver_type: merged.driver_type === "two_up" ? "two_up" : "solo",
                second_driver: (merged.second_driver ?? "").trim(),
              });
            }
            if (driverUserKey) saveDriverRouteDefaults(driverUserKey, merged);
          }}
        />
      )}
    </motion.div>
  );
}
