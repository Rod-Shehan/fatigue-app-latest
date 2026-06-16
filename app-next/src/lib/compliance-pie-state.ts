import {
  buildBreakPieTrackGradient,
  buildComplianceClockConicGradient,
  buildNeutralPieTrackGradient,
  formatComplianceCountdown,
  getComplianceClockLabel,
  getRemainingWindowMinutes,
  getUsedWedgePercent,
  type ComplianceClockTier,
} from "@/lib/compliance-clock";
import {
  resolveActionChrome,
  resolveBreakDueTone,
  resolveComplianceTone,
  resolvePieWedgeTier,
  type BreakDueTone,
  type CompliancePieWedgeTier,
  type ComplianceTone,
} from "@/lib/driver-compliance-chrome";

export type CompliancePieStateInput = {
  workMinutesUsed: number;
  totalWindowMinutes: number;
  currentSegment: "work" | "break" | null;
  complianceLoading?: boolean;
  hasViolations?: boolean;
  hasWarnings?: boolean;
  shiftSegmentOpen?: boolean;
  isIdleAtTop?: boolean;
  /** When false, wedge reflects work window; when on break, ring stays neutral unless sheet warns. */
  showWorkWindowWedge?: boolean;
};

export type CompliancePieState = {
  complianceTone: ComplianceTone;
  breakDueTone: BreakDueTone;
  wedgeTier: CompliancePieWedgeTier;
  wedgeGradient: string;
  remainingMinutes: number;
  usedWedgePercent: number;
  countdown: string;
  statusLabel: string;
  chrome: ReturnType<typeof resolveActionChrome>;
};

function wedgeTierToClockTier(tier: CompliancePieWedgeTier): ComplianceClockTier {
  if (tier === "breach") return "breach";
  if (tier === "warning") return "warning";
  return "safe";
}

export function resolveCompliancePieState(input: CompliancePieStateInput): CompliancePieState {
  const remainingMinutes = getRemainingWindowMinutes(input.workMinutesUsed, input.totalWindowMinutes);
  const complianceTone = resolveComplianceTone({
    loading: input.complianceLoading,
    hasViolations: input.hasViolations,
    hasWarnings: input.hasWarnings,
    shiftSegmentOpen: input.shiftSegmentOpen,
  });
  const breakDueTone = resolveBreakDueTone(remainingMinutes, input.currentSegment);
  const wedgeTier = resolvePieWedgeTier(complianceTone, breakDueTone);
  const clockTier = wedgeTierToClockTier(wedgeTier);

  const showWedge = input.showWorkWindowWedge !== false && input.currentSegment === "work";

  const usedForGradient = showWedge ? input.workMinutesUsed : 0;
  const wedgeGradient = showWedge
    ? buildComplianceClockConicGradient(usedForGradient, input.totalWindowMinutes, clockTier)
    : input.currentSegment === "break"
      ? buildBreakPieTrackGradient()
      : buildNeutralPieTrackGradient();

  const chrome = resolveActionChrome({
    complianceTone,
    breakDueTone,
    isIdleAtTop: input.isIdleAtTop,
    currentSegment: input.currentSegment,
  });

  return {
    complianceTone,
    breakDueTone,
    wedgeTier,
    wedgeGradient,
    remainingMinutes,
    usedWedgePercent: showWedge ? getUsedWedgePercent(input.workMinutesUsed, input.totalWindowMinutes) : 0,
    countdown: formatComplianceCountdown(remainingMinutes),
    statusLabel: getComplianceClockLabel(clockTier, remainingMinutes),
    chrome,
  };
}
