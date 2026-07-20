import {
  formatComplianceCountdown,
  getRemainingWindowMinutes,
  getWorkWindowStatusLabel,
} from "@/lib/driver-action-format";
import {
  resolveActionChrome,
  resolveBreakDueTone,
  resolveOperationalTone,
  type BreakDueTone,
  type ComplianceTone,
} from "@/lib/driver-compliance-chrome";

export type DriverActionStateInput = {
  workMinutesUsed: number;
  totalWindowMinutes: number;
  currentSegment: "work" | "break" | null;
  complianceLoading?: boolean;
  breakRestIncomplete?: boolean;
  /** Minutes already banked toward 20 while on break (drives amber → lime/emerald). */
  breakRestBankedMinutes?: number | null;
  shiftSegmentOpen?: boolean;
  isIdleAtTop?: boolean;
  idleRestBlocked?: boolean;
};

export type DriverActionState = {
  operationalTone: ComplianceTone;
  breakDueTone: BreakDueTone;
  remainingMinutes: number;
  countdown: string;
  statusLabel: string;
  chrome: ReturnType<typeof resolveActionChrome>;
};

export function resolveDriverActionState(input: DriverActionStateInput): DriverActionState {
  const remainingMinutes = getRemainingWindowMinutes(
    input.workMinutesUsed,
    input.totalWindowMinutes
  );
  const breakDueTone = resolveBreakDueTone(remainingMinutes, input.currentSegment);

  const operationalTone = resolveOperationalTone({
    loading: input.complianceLoading,
    currentSegment: input.currentSegment,
    breakRestIncomplete: input.breakRestIncomplete,
    shiftSegmentOpen: input.shiftSegmentOpen,
  });

  const chrome = resolveActionChrome({
    complianceTone: operationalTone,
    breakDueTone,
    isIdleAtTop: input.isIdleAtTop,
    idleRestBlocked: input.idleRestBlocked,
    breakRestBankedMinutes: input.breakRestIncomplete
      ? input.breakRestBankedMinutes ?? 0
      : null,
  });

  return {
    operationalTone,
    breakDueTone,
    remainingMinutes,
    countdown: formatComplianceCountdown(remainingMinutes),
    statusLabel:
      input.currentSegment === "work" ? getWorkWindowStatusLabel(remainingMinutes) : "",
    chrome,
  };
}
