/**
 * Prospective risk criteria and matrix bands (ADR 0003).
 * Compliance violations remain in compliance.ts — these levels are for future segments only.
 */

export type ProspectiveRiskLevel = "low" | "monitor" | "elevated" | "critical";

export type RiskScenarioKind = "planned" | "high" | "low";

/** Hours added/subtracted for sensitivity branches (ADR 0003). */
export const RISK_HOURS_SENSITIVITY_DELTA = 2;
export const RISK_KM_SENSITIVITY_PCT = 0.15;

export function scoreToRiskLevel(score: number): ProspectiveRiskLevel {
  if (score >= 21) return "critical";
  if (score >= 15) return "elevated";
  if (score >= 7) return "monitor";
  return "low";
}

export function riskLevelRank(level: ProspectiveRiskLevel): number {
  switch (level) {
    case "critical":
      return 4;
    case "elevated":
      return 3;
    case "monitor":
      return 2;
    default:
      return 1;
  }
}

export function maxRiskLevel(a: ProspectiveRiskLevel, b: ProspectiveRiskLevel): ProspectiveRiskLevel {
  return riskLevelRank(a) >= riskLevelRank(b) ? a : b;
}

/** Likelihood 1–5 from 168h headroom after scenario (hours). */
export function likelihoodFrom168hHeadroom(headroomHours: number, wouldExceed: boolean): number {
  if (wouldExceed) return 5;
  if (headroomHours < 0) return 5;
  if (headroomHours < 12) return 4;
  if (headroomHours < 24) return 3;
  if (headroomHours < 48) return 2;
  return 1;
}

/** Consequence 1–5 if scenario materialises. */
export function consequenceFrom168hOutcome(
  wouldExceed: boolean,
  inWarningBand: boolean
): number {
  if (wouldExceed) return 4;
  if (inWarningBand) return 2;
  return 1;
}

/** Residual: assume standard barriers (breaks, end shift) shave one likelihood step. */
export function residualLikelihood(inherentLikelihood: number): number {
  return Math.max(1, inherentLikelihood - 1);
}

export const STANDARD_BARRIERS = [
  "Recorded breaks and End shift (compliance gates)",
  "7h non-work before Start shift",
  "Revise run plan or add rest day before long legs",
] as const;
