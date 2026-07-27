"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Clock, Coffee, Loader2, MapPin, Moon, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ComplianceCheckResult } from "@/lib/api";
import { getHours } from "@/lib/compliance";
import { computeEvidenceSummary } from "@/lib/evidence";
import { formatHoursStatistic } from "@/lib/hours";
import { getSheetDayDateString } from "@/lib/weeks";
import { ACTIVITY_THEME } from "@/lib/theme";
import {
  SHIFT_CHANGE_MIN_GAP_HOURS,
  SHIFT_PATTERN_STREAK_HOURS,
  formatShiftChangeGapHours,
  shiftLabelDisplay,
} from "@/lib/shift-change";
import { Button } from "@/components/ui/button";
import { CompliancePolicyFootnote } from "@/components/fatigue/CompliancePolicyFootnote";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Turn compliance day label into a date the driver understands (e.g. "Tue 18 Feb"), not "prev+2". */
function whenLabel(
  day: string,
  weekStarting?: string,
  prevWeekStarting?: string
): string {
  if (day === "14-day") return "in the last 14 days";
  const prevMatch = prevWeekStarting && day.match(/^prev\+(\d+)$/);
  if (prevMatch) {
    const n = parseInt(prevMatch[1], 10);
    const dateStr = getSheetDayDateString(prevWeekStarting, 4 + n);
    return formatDateForDriver(dateStr);
  }
  const ci = DAY_LABELS.indexOf(day);
  if (ci >= 0 && weekStarting) {
    const dateStr = getSheetDayDateString(weekStarting, ci);
    return formatDateForDriver(dateStr);
  }
  return day;
}

function formatDateForDriver(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function formatEventTimeForDriver(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const ICON_MAP = {
  Coffee,
  AlertTriangle,
  Moon,
  Clock,
  TrendingUp,
  CheckCircle2,
  MapPin,
} as const;

function ComplianceResultRow({
  result,
  when,
  tone,
  onScrollToDay,
}: {
  result: ComplianceCheckResult;
  when: string;
  tone: "violation" | "warning" | "info";
  onScrollToDay?: (dayIndex: number) => void;
}) {
  const Icon = ICON_MAP[result.iconKey as keyof typeof ICON_MAP];
  const shell =
    tone === "violation"
      ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800"
      : tone === "warning"
        ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800"
        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700";
  const text =
    tone === "violation"
      ? "text-red-700 dark:text-red-200"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-200"
        : "text-slate-600 dark:text-slate-300";
  const iconCls =
    tone === "violation"
      ? "text-red-500 dark:text-red-400"
      : tone === "warning"
        ? "text-amber-500 dark:text-amber-400"
        : "text-slate-500 dark:text-slate-400";
  const sc = result.shiftChange;
  const appendWhen = result.message.includes("72h window ending") ? "" : ` — ${when}`;

  return (
    <div className={`flex flex-col gap-2 border rounded-lg p-2.5 ${shell}`}>
      <div className="flex items-start gap-2">
        {Icon && <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconCls}`} />}
        <p className={`text-xs ${text}`}>
          {result.message}
          {appendWhen}
        </p>
      </div>
      {sc && (
        <ul className={`text-[11px] space-y-0.5 pl-6 list-disc ${text}`}>
          <li>
            Pattern: {shiftLabelDisplay(sc.fromLabel)} → {shiftLabelDisplay(sc.toLabel)}
          </li>
          {formatEventTimeForDriver(sc.stopTimeIso) && (
            <li>End shift logged: {formatEventTimeForDriver(sc.stopTimeIso)}</li>
          )}
          {formatEventTimeForDriver(sc.workTimeIso) && (
            <li>Next Work logged: {formatEventTimeForDriver(sc.workTimeIso)}</li>
          )}
          {sc.gapHours > 0 && (
            <li>
              Time off between: {formatShiftChangeGapHours(sc.gapHours)} (need ≥{SHIFT_CHANGE_MIN_GAP_HOURS}h)
            </li>
          )}
        </ul>
      )}
      {result.scrollDayIndex != null && onScrollToDay && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs self-start ml-6"
          onClick={() => onScrollToDay(result.scrollDayIndex!)}
        >
          View day card
        </Button>
      )}
    </div>
  );
}

type DayLike = {
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  events?: { time: string; type: string; lat?: number; lng?: number; accuracy?: number }[];
  start_kms?: number | null;
  end_kms?: number | null;
};

export default function CompliancePanel({
  days,
  driverType,
  prevWeekDays,
  weekStarting,
  prevWeekStarting,
  complianceResults,
  complianceLoading,
  onScrollToDay,
}: {
  days: DayLike[];
  driverType?: string;
  prevWeekDays?: DayLike[] | null;
  last24hBreak?: string;
  weekStarting?: string;
  prevWeekStarting?: string;
  complianceResults?: ComplianceCheckResult[] | null;
  complianceLoading?: boolean;
  onScrollToDay?: (dayIndex: number) => void;
}) {
  const checks = complianceResults ?? [];
  const violations = checks.filter((c) => c.type === "violation");
  const warnings = checks.filter((c) => c.type === "warning");
  const infoNotes = checks.filter((c) => c.type === "info");
  const totalWork = days.reduce((s, d) => s + getHours(d.work_time), 0);
  const totalBreaks = days.reduce((s, d) => s + getHours(d.breaks), 0);
  const totalNonWork = days.reduce((s, d) => s + getHours(d.non_work), 0);
  const prevWeekWork = (prevWeekDays || []).reduce((s, d) => s + getHours(d.work_time), 0);
  const isTwoUp = driverType === "two_up";
  const evidence = React.useMemo(() => computeEvidenceSummary(days), [days]);

  return (
    <div className="space-y-4">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${isTwoUp ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-200" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
        {isTwoUp ? "👥 Two-Up Rules" : "👤 Solo Rules"}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className={`rounded-lg p-3 text-center ${ACTIVITY_THEME.work.statsCard}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${ACTIVITY_THEME.work.statsLabel}`}>Work</p>
          <p className={`text-xl font-bold font-mono ${ACTIVITY_THEME.work.statsValue}`}>{formatHoursStatistic(totalWork)}h</p>
          {prevWeekDays && prevWeekDays.length > 0 && (
            <p className="text-[10px] text-blue-400 font-mono">14d: {formatHoursStatistic(totalWork + prevWeekWork)}h</p>
          )}
        </div>
        <div className={`rounded-lg p-3 text-center ${ACTIVITY_THEME.break.statsCard}`} title="Time you logged as Break (≤30 min). Longer logged breaks count as non-work. End shift is non-work, not break.">
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${ACTIVITY_THEME.break.statsLabel}`}>Break</p>
          <p className="text-[9px] text-slate-400 mt-0.5">logged break ≤30 min</p>
          <p className={`text-xl font-bold font-mono ${ACTIVITY_THEME.break.statsValue}`}>{formatHoursStatistic(totalBreaks)}h</p>
        </div>
        <div className={`rounded-lg p-3 text-center ${ACTIVITY_THEME.non_work.statsCard}`} title="Recovery time: End shift, logged non-work, and logged breaks &gt;30 min.">
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${ACTIVITY_THEME.non_work.statsLabel}`}>Non-Work Time</p>
          <p className="text-[9px] text-slate-400 mt-0.5">incl. End shift; breaks &gt;30 min</p>
          <p className={`text-xl font-bold font-mono ${ACTIVITY_THEME.non_work.statsValue}`}>{formatHoursStatistic(totalNonWork)}h</p>
        </div>
      </div>
      {prevWeekDays && prevWeekDays.length > 0 && (
        <p className="text-[10px] text-slate-400 italic">↑ Previous week's sheet linked for 14-day checks</p>
      )}
      {(!prevWeekDays || prevWeekDays.length === 0) && (
        <p className="text-[10px] text-slate-300 italic">No previous week sheet found — 14-day check is partial</p>
      )}
      {complianceLoading && (
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
          <Loader2 className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 animate-spin" />
          <span className="text-sm text-slate-600 dark:text-slate-300">Checking compliance…</span>
        </div>
      )}
      {!complianceLoading && complianceResults && violations.length === 0 && warnings.length === 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-200">All compliant — no issues detected</span>
        </div>
      )}
      <AnimatePresence>
        {violations.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-red-500 dark:text-red-400 font-bold">Violations ({violations.length})</p>
            {violations.map((v, i) => (
              <ComplianceResultRow
                key={i}
                result={v}
                tone="violation"
                when={whenLabel(v.day, weekStarting, prevWeekStarting)}
                onScrollToDay={onScrollToDay}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {warnings.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-amber-500 dark:text-amber-400 font-bold">Warnings ({warnings.length})</p>
            {warnings.map((w, i) => (
              <ComplianceResultRow
                key={i}
                result={w}
                tone="warning"
                when={whenLabel(w.day, weekStarting, prevWeekStarting)}
                onScrollToDay={onScrollToDay}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {infoNotes.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              Optional notes ({infoNotes.length})
            </p>
            {infoNotes.map((n, i) => (
              <ComplianceResultRow
                key={i}
                result={n}
                tone="info"
                when={whenLabel(n.day, weekStarting, prevWeekStarting)}
                onScrollToDay={onScrollToDay}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-2">
          Plausibility & evidence
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-white/70 dark:bg-slate-900/30 border border-slate-200/70 dark:border-slate-700/70 p-2">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">GPS coverage</p>
            <p className="text-sm font-mono text-slate-700 dark:text-slate-200">
              {evidence.gpsCoveragePct}% <span className="text-[10px] text-slate-400">({evidence.gpsEvents}/{evidence.totalEvents})</span>
            </p>
          </div>
          <div className="rounded-md bg-white/70 dark:bg-slate-900/30 border border-slate-200/70 dark:border-slate-700/70 p-2">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">GPS km</p>
            <p className="text-sm font-mono text-slate-700 dark:text-slate-200">
              {evidence.gpsKm == null ? "—" : `${evidence.gpsKm} km`}
            </p>
          </div>
          <div className="rounded-md bg-white/70 dark:bg-slate-900/30 border border-slate-200/70 dark:border-slate-700/70 p-2">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Odometer km</p>
            <p className="text-sm font-mono text-slate-700 dark:text-slate-200">
              {evidence.odometerKm == null ? "—" : `${evidence.odometerKm} km`}
            </p>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
          <p>
            Interval classification (min):{" "}
            <span className="font-mono">
              stationary {evidence.intervalMinutesClassified.stationary}, moving {evidence.intervalMinutesClassified.moving}, unknown {evidence.intervalMinutesClassified.unknown}
            </span>
          </p>
          {evidence.movingDuringRestCount > 0 && (
            <p className="text-amber-700 dark:text-amber-200">
              Possible movement during rest: {evidence.movingDuringRestCount} interval(s)
            </p>
          )}
          {evidence.flags.length > 0 && (
            <ul className="space-y-1">
              {evidence.flags.map((f) => (
                <li
                  key={f.code}
                  className={
                    f.severity === "warning"
                      ? "text-amber-700 dark:text-amber-200"
                      : "text-slate-600 dark:text-slate-400"
                  }
                >
                  • {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
          <strong className="text-slate-600 dark:text-slate-300">Break</strong> = time you logged as Break (≤30 min); counts toward the 20 min / 5h rule.{" "}
          <strong className="text-slate-600 dark:text-slate-300">Non-work time</strong> = End shift, logged non-work, and any logged break longer than 30 min.
        </p>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
          WA OSH Reg 3.132 — {isTwoUp ? "Two-Up" : "Solo"} Rules
        </p>
        {isTwoUp ? (
          <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <li>• 20 min rest per 5h work (2×10 min or 1×20 min; breaks under 10 min count as work)</li>
            <li>• ≥7 hrs non-work in any rolling 24 hrs (can be in moving vehicle)</li>
            <li>• ≥1 block of ≥7 continuous hrs non-work in any rolling 48 hrs (not in moving vehicle)</li>
            <li>• ≥48 hrs non-work per 7 days (incl. ≥24 continuous hrs)</li>
            <li>• Max 168 hrs work in any 14-day period (rolling; resets after ≥48h continuous non-work)</li>
          </ul>
        ) : (
          <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <li>• 20 min rest per 5h work (2×10 min or 1×20 min; breaks under 10 min count as work)</li>
            <li>• ≥7 continuous hrs non-work time required</li>
            <li>• Two periods of non-work time (each longer than 7h) cannot be separated by more than 17h of work and break combined (24h non-work resets)</li>
            <li>• ≥27 hrs non-work in any rolling 72 hrs (incl. 3× ≥7hr blocks; 24h non-work resets)</li>
            <li>
              • After {SHIFT_PATTERN_STREAK_HOURS}h+ on the same shift pattern (5×24h rolling), changing pattern (Day A ↔ Night B) needs ≥
              {SHIFT_CHANGE_MIN_GAP_HOURS}h off between End shift and next Work on the timeline (not at midnight)
            </li>
            <li>• Max 168 hrs work in any 14-day period (rolling; resets after ≥48h continuous non-work)</li>
          </ul>
        )}
      </div>
      <CompliancePolicyFootnote className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed" />
    </div>
  );
}
