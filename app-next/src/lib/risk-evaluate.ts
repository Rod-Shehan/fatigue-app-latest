/**
 * Semi-quantitative risk evaluation (IEC 31010 matrix) for prospective segments.
 */

import type { Rolling168hMetrics } from "@/lib/rolling-168h-metrics";
import {
  consequenceFrom168hOutcome,
  likelihoodFrom168hHeadroom,
  residualLikelihood,
  scoreToRiskLevel,
  STANDARD_BARRIERS,
  type ProspectiveRiskLevel,
  type RiskScenarioKind,
} from "@/lib/risk-criteria";

export type EvaluatedSegmentRisk = {
  scenario: RiskScenarioKind;
  likelihood: number;
  consequence: number;
  riskScore: number;
  riskLevel: ProspectiveRiskLevel;
  residualLikelihood: number;
  residualScore: number;
  residualRiskLevel: ProspectiveRiskLevel;
  outcomes: string[];
  barriers: string[];
  summary: string;
};

export function evaluateSegment168hRisk(
  baseline: Rolling168hMetrics,
  afterPlan: Rolling168hMetrics,
  scenario: RiskScenarioKind,
  routeLabel: string
): EvaluatedSegmentRisk {
  const likelihood = likelihoodFrom168hHeadroom(afterPlan.headroomHours, afterPlan.wouldExceed168);
  const consequence = consequenceFrom168hOutcome(afterPlan.wouldExceed168, afterPlan.inWarningBand);
  const riskScore = likelihood * consequence;
  const riskLevel = scoreToRiskLevel(riskScore);
  const resLik = residualLikelihood(likelihood);
  const residualScore = resLik * consequence;
  const residualRiskLevel = scoreToRiskLevel(residualScore);

  const outcomes: string[] = [];
  if (afterPlan.wouldExceed168) {
    outcomes.push("168h_breach_if_plan_holds");
  } else if (afterPlan.inWarningBand) {
    outcomes.push("168h_warning_if_plan_holds");
  }
  const deltaH = Math.round((afterPlan.maxRollingWorkHours - baseline.maxRollingWorkHours) * 10) / 10;
  if (deltaH > 0) {
    outcomes.push(`adds_${deltaH}h_to_14d_window`);
  }

  let summary: string;
  if (afterPlan.wouldExceed168) {
    summary = `Run "${routeLabel}" (${scenario}): rolling 14-day work would likely exceed 168h if the plan proceeds.`;
  } else if (afterPlan.inWarningBand) {
    summary = `Run "${routeLabel}" (${scenario}): approaches 168h limit (~${afterPlan.maxRollingWorkHours}h in 14-day window).`;
  } else if (afterPlan.headroomHours < 24) {
    summary = `Run "${routeLabel}" (${scenario}): ~${afterPlan.headroomHours}h headroom under 168h after this leg.`;
  } else {
    summary = `Run "${routeLabel}" (${scenario}): within comfortable 168h headroom (~${afterPlan.headroomHours}h remaining).`;
  }

  return {
    scenario,
    likelihood,
    consequence,
    riskScore,
    riskLevel,
    residualLikelihood: resLik,
    residualScore,
    residualRiskLevel,
    outcomes,
    barriers: [...STANDARD_BARRIERS],
    summary,
  };
}
