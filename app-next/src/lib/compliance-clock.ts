/** WA Reg 184E-style continuous work window display — pie wedge math for CompliancePieHero. */

import { COMPLIANCE_PIE_PALETTE } from "@/lib/driver-compliance-chrome";

export type ComplianceClockTier = "safe" | "warning" | "breach";

export const COMPLIANCE_CLOCK_TIER_THRESHOLDS = {
  warningMaxMinutes: 45,
  breachMaxMinutes: 15,
} as const;

/** Default 5 h continuous work block (minutes) — matches five-hour-break-rule WORK_WINDOW_MIN. */
export const WA_CONTINUOUS_WORK_WINDOW_MIN = 5 * 60;

const TIER_GRADIENT: Record<ComplianceClockTier, { from: string; to: string }> = {
  safe: COMPLIANCE_PIE_PALETTE.safe,
  warning: COMPLIANCE_PIE_PALETTE.warning,
  breach: COMPLIANCE_PIE_PALETTE.breach,
};

const TRACK_COLOR = COMPLIANCE_PIE_PALETTE.track;
const IDLE_TRACK_COLOR = COMPLIANCE_PIE_PALETTE.idleTrack;

export function clampWorkMinutesUsed(workMinutesUsed: number, totalWindowMinutes: number): number {
  if (!Number.isFinite(workMinutesUsed) || workMinutesUsed < 0) return 0;
  if (!Number.isFinite(totalWindowMinutes) || totalWindowMinutes <= 0) return 0;
  return Math.min(workMinutesUsed, totalWindowMinutes);
}

export function getRemainingWindowMinutes(workMinutesUsed: number, totalWindowMinutes: number): number {
  if (!Number.isFinite(totalWindowMinutes) || totalWindowMinutes <= 0) return 0;
  const used = clampWorkMinutesUsed(workMinutesUsed, totalWindowMinutes);
  return Math.max(0, totalWindowMinutes - used);
}

export function getComplianceClockTier(remainingMinutes: number): ComplianceClockTier {
  if (!Number.isFinite(remainingMinutes) || remainingMinutes <= COMPLIANCE_CLOCK_TIER_THRESHOLDS.breachMaxMinutes) {
    return "breach";
  }
  if (remainingMinutes <= COMPLIANCE_CLOCK_TIER_THRESHOLDS.warningMaxMinutes) {
    return "warning";
  }
  return "safe";
}

/** Maps work-window minutes left to break-due tier (same thresholds as driver-compliance-chrome). */
export function getBreakDueTierFromRemaining(remainingMinutes: number): ComplianceClockTier | null {
  if (!Number.isFinite(remainingMinutes)) return null;
  if (remainingMinutes <= COMPLIANCE_CLOCK_TIER_THRESHOLDS.breachMaxMinutes) return "breach";
  if (remainingMinutes <= COMPLIANCE_CLOCK_TIER_THRESHOLDS.warningMaxMinutes) return "warning";
  return null;
}

export function getUsedWedgePercent(workMinutesUsed: number, totalWindowMinutes: number): number {
  if (!Number.isFinite(totalWindowMinutes) || totalWindowMinutes <= 0) return 0;
  const used = clampWorkMinutesUsed(workMinutesUsed, totalWindowMinutes);
  return Math.min(100, Math.max(0, (used / totalWindowMinutes) * 100));
}

/** Empty in-cab track (idle) — visible ring on dark focus overlay. */
export function buildNeutralPieTrackGradient(): string {
  return `conic-gradient(from 0deg, ${IDLE_TRACK_COLOR} 0deg, ${IDLE_TRACK_COLOR} 360deg)`;
}

/** On break — amber ring matches break activity theme. */
export function buildBreakPieTrackGradient(): string {
  const { from, to } = TIER_GRADIENT.warning;
  return `conic-gradient(from 0deg, ${from} 0deg, ${to} 360deg)`;
}

/** Work segment with no logged minutes yet — faint full-ring hint in tier colour. */
export function buildWorkWindowEmptyRingGradient(tier: ComplianceClockTier): string {
  const { from } = TIER_GRADIENT[tier];
  return `conic-gradient(from 0deg, ${from} 0deg, ${from} 360deg)`;
}

/** Conic gradient for a solid clockwise “used time” wedge from 12 o'clock. */
export function buildComplianceClockConicGradient(
  workMinutesUsed: number,
  totalWindowMinutes: number,
  tier: ComplianceClockTier
): string {
  const pct = getUsedWedgePercent(workMinutesUsed, totalWindowMinutes);
  const sweepDeg = (pct / 100) * 360;
  const { from, to } = TIER_GRADIENT[tier];
  const midDeg = sweepDeg * 0.55;
  if (sweepDeg <= 0) {
    return buildWorkWindowEmptyRingGradient(tier);
  }
  if (sweepDeg >= 360) {
    return `conic-gradient(from 0deg, ${from} 0deg, ${to} 360deg)`;
  }
  return `conic-gradient(from 0deg, ${from} 0deg, ${to} ${midDeg}deg, ${to} ${sweepDeg}deg, ${TRACK_COLOR} ${sweepDeg}deg, ${TRACK_COLOR} 360deg)`;
}

export function formatComplianceCountdown(remainingMinutes: number): string {
  const mins = Math.max(0, Math.ceil(remainingMinutes));
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${mins}m`;
}

export function getComplianceClockLabel(tier: ComplianceClockTier, remainingMinutes: number): string {
  if (tier === "breach" || remainingMinutes <= 0) return "BREAK REQUIRED NOW";
  if (tier === "warning") return "BREAK DUE SOON";
  return "WORK WINDOW LEFT";
}
