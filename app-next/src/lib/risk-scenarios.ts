/**
 * Scenario analysis: apply declared run plans on future segments only (ADR 0003).
 */

import type { ComplianceDayData } from "@/lib/compliance";
import { buildRetrospectiveTimelineDays, type ComplianceStateInput } from "@/lib/compliance-state";
import {
  computeRolling168hMetricsFromDays,
  dayWithInjectedWorkHours,
} from "@/lib/rolling-168h-metrics";
import { RISK_HOURS_SENSITIVITY_DELTA, type RiskScenarioKind } from "@/lib/risk-criteria";
import {
  hasRunPlanContent,
  isFutureSheetDay,
  sheetDayYmdFromIndex,
  type DayDataWithPlan,
} from "@/lib/route-plan";

export type FutureRunPlan = {
  dayIndex: number;
  segmentId: string;
  routeLabel: string;
  plannedHours: number;
  plannedKm: number | null;
};

export function collectFutureRunPlans(
  days: DayDataWithPlan[],
  weekStarting: string,
  todayYmd: string
): FutureRunPlan[] {
  const plans: FutureRunPlan[] = [];
  days.forEach((day, dayIndex) => {
    if (!isFutureSheetDay(weekStarting, dayIndex, todayYmd)) return;
    if (!hasRunPlanContent(day)) return;
    const label = (day.route_label ?? "").trim();
    if (!label) return;
    const hrs = Number(day.planned_on_duty_hours);
    const kmRaw = day.planned_distance_km;
    const plannedHours =
      hrs != null && !Number.isNaN(hrs) && hrs > 0
        ? hrs
        : kmRaw != null && !Number.isNaN(Number(kmRaw))
          ? Math.max(4, Number(kmRaw) / 50)
          : 0;
    if (plannedHours <= 0) return;
    plans.push({
      dayIndex,
      segmentId: sheetDayYmdFromIndex(weekStarting, dayIndex),
      routeLabel: label,
      plannedHours,
      plannedKm:
        kmRaw != null && !Number.isNaN(Number(kmRaw)) ? Number(kmRaw) : null,
    });
  });
  return plans;
}

function scenarioHours(base: number, kind: RiskScenarioKind): number {
  if (kind === "high") return base + RISK_HOURS_SENSITIVITY_DELTA;
  if (kind === "low") return Math.max(0.5, base - RISK_HOURS_SENSITIVITY_DELTA);
  return base;
}

/**
 * Timeline = retrospective record + hypothetical work on listed future day indices (cumulative order).
 */
export function buildProjectedTimeline(
  stateInput: ComplianceStateInput,
  plansThroughDayIndex: number[],
  scenario: RiskScenarioKind,
  plansByDay: Map<number, FutureRunPlan>
): ComplianceDayData[] {
  const days = buildRetrospectiveTimelineDays(stateInput);
  const weekLen = stateInput.currentWeekDays.length;
  const startCurrent = Math.max(0, days.length - weekLen);

  return days.map((day, idx) => {
    const dayIndex = idx - startCurrent;
    if (dayIndex < 0 || !plansThroughDayIndex.includes(dayIndex)) return day;
    const plan = plansByDay.get(dayIndex);
    if (!plan) return day;
    return dayWithInjectedWorkHours(day, scenarioHours(plan.plannedHours, scenario));
  });
}

export function metricsAfterCumulativePlans(
  stateInput: ComplianceStateInput,
  orderedPlans: FutureRunPlan[],
  scenario: RiskScenarioKind
): ReturnType<typeof computeRolling168hMetricsFromDays> {
  const byDay = new Map(orderedPlans.map((p) => [p.dayIndex, p]));
  const through = orderedPlans.map((p) => p.dayIndex);
  const timeline = buildProjectedTimeline(stateInput, through, scenario, byDay);
  return computeRolling168hMetricsFromDays(timeline);
}
