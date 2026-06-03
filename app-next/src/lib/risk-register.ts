/**
 * Prospective risk register — outputs attach to future segments only (ADR 0003).
 */

import type { ComplianceDayData } from "@/lib/compliance";
import { complianceStateAt, type ComplianceStateInput } from "@/lib/compliance-state";
import { evaluateSegment168hRisk, type EvaluatedSegmentRisk } from "@/lib/risk-evaluate";
import { maxRiskLevel, type ProspectiveRiskLevel, type RiskScenarioKind } from "@/lib/risk-criteria";
import { collectFutureRunPlans, metricsAfterCumulativePlans } from "@/lib/risk-scenarios";
import type { DayDataWithPlan } from "@/lib/route-plan";

export type RiskRegisterEntry = {
  segmentId: string;
  dayIndex: number;
  routeLabel: string;
  scenario: RiskScenarioKind;
  likelihood: number;
  consequence: number;
  riskLevel: ProspectiveRiskLevel;
  residualRiskLevel: ProspectiveRiskLevel;
  outcomes: string[];
  barriers: string[];
  summary: string;
  plannedHours: number;
  plannedKm: number | null;
};

export type RiskRegisterResult = {
  baselineHeadroomHours: number;
  entries: RiskRegisterEntry[];
  worstLevel: ProspectiveRiskLevel;
  driverHint: string | null;
};

const SCENARIOS: RiskScenarioKind[] = ["planned", "high"];

export function buildRiskRegister(input: {
  stateInput: ComplianceStateInput;
  days: DayDataWithPlan[];
}): RiskRegisterResult {
  const { stateInput, days } = input;
  const baseline = complianceStateAt(stateInput);
  const plans = collectFutureRunPlans(days, stateInput.weekStarting, stateInput.todayYmd);

  if (plans.length === 0) {
    return {
      baselineHeadroomHours: baseline.rolling168h.headroomHours,
      entries: [],
      worstLevel: "low",
      driverHint: null,
    };
  }

  const entries: RiskRegisterEntry[] = [];
  const sorted = [...plans].sort((a, b) => a.dayIndex - b.dayIndex);

  for (let i = 0; i < sorted.length; i++) {
    const plan = sorted[i]!;
    const cumulative = sorted.slice(0, i + 1);
    for (const scenario of SCENARIOS) {
      const after = metricsAfterCumulativePlans(stateInput, cumulative, scenario);
      const evaluated: EvaluatedSegmentRisk = evaluateSegment168hRisk(
        baseline.rolling168h,
        after,
        scenario,
        plan.routeLabel
      );
      entries.push({
        segmentId: plan.segmentId,
        dayIndex: plan.dayIndex,
        routeLabel: plan.routeLabel,
        scenario: evaluated.scenario,
        likelihood: evaluated.likelihood,
        consequence: evaluated.consequence,
        riskLevel: evaluated.riskLevel,
        residualRiskLevel: evaluated.residualRiskLevel,
        outcomes: evaluated.outcomes,
        barriers: evaluated.barriers,
        summary: evaluated.summary,
        plannedHours: plan.plannedHours,
        plannedKm: plan.plannedKm,
      });
    }
  }

  let worstLevel: ProspectiveRiskLevel = "low";
  for (const e of entries) {
    worstLevel = maxRiskLevel(worstLevel, e.riskLevel);
  }

  const plannedEntries = entries.filter((e) => e.scenario === "planned");
  const worstPlanned = plannedEntries.reduce<ProspectiveRiskLevel>(
    (acc, e) => maxRiskLevel(acc, e.riskLevel),
    "low"
  );
  const top = plannedEntries.find(
    (e) => e.riskLevel === worstPlanned && e.riskLevel !== "low"
  );

  const driverHint =
    top && (top.riskLevel === "elevated" || top.riskLevel === "critical" || top.riskLevel === "monitor")
      ? top.summary
      : null;

  return {
    baselineHeadroomHours: baseline.rolling168h.headroomHours,
    entries,
    worstLevel,
    driverHint,
  };
}

/** Client/server helper for driver sheet. */
export function buildRiskRegisterFromWeek(
  days: DayDataWithPlan[],
  options: {
    weekStarting: string;
    todayYmd: string;
    historyDays?: ComplianceDayData[] | null;
    prevWeekDays?: ComplianceDayData[] | null;
    slotOffsetWithinToday?: number;
    currentDayIndex?: number;
  }
): RiskRegisterResult {
  return buildRiskRegister({
    days,
    stateInput: {
      currentWeekDays: days,
      weekStarting: options.weekStarting,
      todayYmd: options.todayYmd,
      historyDays: options.historyDays,
      prevWeekDays: options.prevWeekDays,
      slotOffsetWithinToday: options.slotOffsetWithinToday,
      currentDayIndex: options.currentDayIndex,
    },
  });
}

export function hasElevatedProspectiveRisk(register: RiskRegisterResult | undefined): boolean {
  if (!register?.entries.length) return false;
  return register.worstLevel === "elevated" || register.worstLevel === "critical";
}
