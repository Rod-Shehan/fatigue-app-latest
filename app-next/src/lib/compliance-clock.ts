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

/** Empty in-cab track (idle / on break) — visible ring on dark focus overlay. */
export function buildNeutralPieTrackGradient(): string {
  return `conic-gradient(from 0deg, ${IDLE_TRACK_COLOR} 0deg, ${IDLE_TRACK_COLOR} 360deg)`;
}

export type BreakSplitPieInput = {
  leftPct: number;
  rightPct: number;
  complete: boolean;
  priorSlot1: boolean;
  priorSlot2: boolean;
};

/** 20 min qualifying rest arc on the ring — clockwise from 12 o'clock. */
export const BREAK_PIE_ARC_DEG = 180;
/** Each 10 min slot is half of the 20 min arc. */
export const BREAK_PIE_SLOT_DEG = BREAK_PIE_ARC_DEG / 2;

export const EMPTY_BREAK_PIE_RING: BreakSplitPieInput = {
  leftPct: 0,
  rightPct: 0,
  complete: false,
  priorSlot1: false,
  priorSlot2: false,
};

/**
 * 20 min break arc from 12 o'clock: two 10 min sections (amber while filling, green when banked).
 * Remainder of the ring stays neutral until rest is complete (then full emerald ring).
 */
export function buildBreakSplitPieGradient(input: BreakSplitPieInput): string {
  const amber = COMPLIANCE_PIE_PALETTE.warning.from;
  const green = COMPLIANCE_PIE_PALETTE.safe.from;
  const track = IDLE_TRACK_COLOR;
  const slot1End = BREAK_PIE_SLOT_DEG;
  const arcEnd = BREAK_PIE_ARC_DEG;

  if (input.complete) {
    return `conic-gradient(from 0deg, ${green} 0deg, ${green} 360deg)`;
  }

  const stops: Array<[number, string]> = [];

  const push = (deg: number, color: string) => {
    const last = stops[stops.length - 1];
    if (last && last[0] === deg && last[1] === color) return;
    if (last && last[0] === deg) stops[stops.length - 1] = [deg, color];
    else stops.push([deg, color]);
  };

  const slot1Done = input.priorSlot1 || input.leftPct >= 100;
  if (slot1Done) {
    push(0, green);
    push(slot1End, green);
  } else {
    const fill1 = Math.max(0, Math.min(slot1End, (input.leftPct / 100) * slot1End));
    push(0, fill1 > 0 ? amber : track);
    if (fill1 > 0) push(fill1, amber);
    push(slot1End, track);
  }

  const slot2Done = input.priorSlot2 || input.rightPct >= 100;
  if (slot2Done) {
    push(slot1End, green);
    push(arcEnd, green);
  } else {
    const fill2End = slot1End + Math.max(0, Math.min(slot1End, (input.rightPct / 100) * slot1End));
    const colorAtSlot2Start = slot1Done ? green : stops.find(([d]) => d === slot1End)?.[1] ?? track;
    push(slot1End, colorAtSlot2Start);
    if (fill2End > slot1End) {
      push(fill2End, amber);
    }
    push(arcEnd, track);
  }

  push(arcEnd, track);
  push(360, track);

  const parts = stops.map(([deg, color]) => `${color} ${deg}deg`).join(", ");
  return `conic-gradient(from 0deg, ${parts})`;
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
