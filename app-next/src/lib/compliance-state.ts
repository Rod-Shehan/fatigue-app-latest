/**
 * RULE IP — Do not change fatigue time/compliance rule logic without explicit owner approval.
 * See .cursor/rules/time-rules-ip.mdc
 *
 * Retrospective compliance state at a point in time (ADR 0003).
 * Input-only for prospective risk — does not score past segments as "risk".
 */

import { MINUTES_PER_DAY, normalizeDayCoverageArrays } from "@/lib/coverage/derive-minute-coverage";
import type { ComplianceDayData } from "@/lib/compliance";
import {
  computeRolling168hMetricsFromDays,
  type Rolling168hMetrics,
} from "@/lib/rolling-168h-metrics";

export type ComplianceStateSnapshot = {
  asOfMs: number;
  todayYmd: string;
  rolling168h: Rolling168hMetrics;
};

export type ComplianceStateInput = {
  historyDays?: ComplianceDayData[] | null;
  prevWeekDays?: ComplianceDayData[] | null;
  currentWeekDays: ComplianceDayData[];
  weekStarting: string;
  todayYmd: string;
  /** Minutes elapsed on today's grid (0–1439); only record through this index on today. */
  slotOffsetWithinToday?: number;
  currentDayIndex?: number;
  asOfMs?: number;
};

function truncateDayAtMinute(day: ComplianceDayData, maxMinuteExclusive: number): ComplianceDayData {
  const cap = Math.min(MINUTES_PER_DAY, Math.max(0, maxMinuteExclusive));
  const trim = (slots: boolean[] | undefined) => {
    const base = slots ?? Array(MINUTES_PER_DAY).fill(false);
    const next = base.slice(0, MINUTES_PER_DAY);
    for (let i = cap; i < MINUTES_PER_DAY; i++) next[i] = false;
    return next;
  };
  return {
    ...day,
    work_time: trim(day.work_time),
    breaks: trim(day.breaks),
    non_work: trim(day.non_work),
  };
}

/**
 * Build timeline from history + prev + current week, keeping only **recorded** time through `now`.
 * Days after today in the focus week are empty (future — not compliance, not yet in record).
 */
export function buildRetrospectiveTimelineDays(input: ComplianceStateInput): ComplianceDayData[] {
  const history = (input.historyDays ?? []).map((d) => normalizeDayCoverageArrays(d));
  const prev = (input.prevWeekDays ?? []).map((d) => normalizeDayCoverageArrays(d));
  const current = input.currentWeekDays.map((d) => normalizeDayCoverageArrays(d));
  const slot =
    input.slotOffsetWithinToday != null
      ? Math.min(MINUTES_PER_DAY - 1, Math.max(0, input.slotOffsetWithinToday))
      : MINUTES_PER_DAY;

  const [yw, mw, dw] = input.weekStarting.split("-").map(Number);
  const truncatedCurrent = current.map((day, i) => {
    const dayDate = new Date(yw, mw - 1, dw + i);
    const ds = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(dayDate.getDate()).padStart(2, "0")}`;
    if (ds > input.todayYmd) {
      return {
        ...day,
        work_time: Array(MINUTES_PER_DAY).fill(false),
        breaks: Array(MINUTES_PER_DAY).fill(false),
        non_work: Array(MINUTES_PER_DAY).fill(true),
      };
    }
    if (ds === input.todayYmd) {
      return truncateDayAtMinute(day, slot + 1);
    }
    return day;
  });

  return [...history, ...prev, ...truncatedCurrent];
}

export function complianceStateAt(input: ComplianceStateInput): ComplianceStateSnapshot {
  const days = buildRetrospectiveTimelineDays(input);
  const rolling168h = computeRolling168hMetricsFromDays(days);
  return {
    asOfMs: input.asOfMs ?? Date.now(),
    todayYmd: input.todayYmd,
    rolling168h,
  };
}
