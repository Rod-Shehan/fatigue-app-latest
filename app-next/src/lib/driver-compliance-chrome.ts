import {
  driverPuckAmber,
  driverPuckEmerald,
  driverPuckLimeEmerald,
  driverPuckNeutral,
  driverPuckRed,
  driverPuckSlate,
} from "@/lib/driver-puck";

export type ComplianceTone = "default" | "violation" | "warning" | "pending" | "ok";
export type BreakDueTone = null | "amber" | "red";

/** First 10 min of 2×10 / 20 rest vs second half toward 20. */
export type BreakRestPendingPhase = "first_10" | "second_10";

export function resolveBreakRestPendingPhase(
  breakRestBankedMinutes?: number | null
): BreakRestPendingPhase {
  if (breakRestBankedMinutes != null && breakRestBankedMinutes >= 10) return "second_10";
  return "first_10";
}

function pendingBreakRestChrome(phase: BreakRestPendingPhase): {
  surfaceClass: string;
  textClass: string;
} {
  if (phase === "first_10") {
    return {
      // Strong amber until the first 10 minutes are banked.
      surfaceClass: driverPuckAmber,
      textClass: "text-white",
    };
  }
  return {
    // Second 10 toward 20 — lime into emerald.
      surfaceClass: driverPuckLimeEmerald,
    textClass: "text-white",
  };
}

export function getComplianceChrome(
  complianceTone: ComplianceTone,
  breakDueTone: BreakDueTone,
  breakRestBankedMinutes?: number | null
): { onColoredSurface: boolean; surfaceClass: string; textClass: string } {
  const onColoredSurface = complianceTone !== "default" || breakDueTone != null;
  const pendingChrome =
    complianceTone === "pending"
      ? pendingBreakRestChrome(resolveBreakRestPendingPhase(breakRestBankedMinutes))
      : null;

  const surfaceClass =
    complianceTone === "violation" || complianceTone === "warning"
      ? driverPuckAmber
      : breakDueTone === "red"
        ? driverPuckRed
        : breakDueTone === "amber"
          ? driverPuckAmber
          : pendingChrome
            ? pendingChrome.surfaceClass
            : complianceTone === "ok"
              ? driverPuckEmerald
              : driverPuckNeutral;

  const textClass =
    complianceTone === "violation" ||
    complianceTone === "warning" ||
    breakDueTone === "red" ||
    breakDueTone === "amber" ||
    pendingChrome != null ||
    complianceTone === "ok"
      ? "text-white"
      : "text-slate-900 dark:text-slate-100";

  return { onColoredSurface, surfaceClass, textClass };
}

/** End shift FAB — inner red surface + outer trim ring (trim is a wrapper, not border-4 on a 3rem circle). */
export function getEndShiftButtonChrome(): {
  trimClass: string;
  surfaceClass: string;
  textClass: string;
} {
  return {
    trimClass: "bg-red-200/80 dark:bg-red-950/90",
    surfaceClass: driverPuckRed,
    textClass: "text-white",
  };
}

/** Rest-only nap question — slate trim, not Rest amber and not End shift red. */
export function getNapQuestionChrome(): {
  trimClass: string;
  surfaceClass: string;
  textClass: string;
} {
  return {
    trimClass: "bg-slate-300/80 dark:bg-slate-700/90",
    surfaceClass: driverPuckNeutral,
    textClass: "text-slate-900 dark:text-slate-100",
  };
}

/** Tagged Rest nap — same family, slow pulse applied by the puck. */
export function getOnNapChrome(): {
  trimClass: string;
  surfaceClass: string;
  textClass: string;
} {
  return {
    trimClass: "bg-slate-400/80 dark:bg-slate-600/90",
    surfaceClass: driverPuckSlate,
    textClass: "text-white",
  };
}

/** Round Resume shift secondary — neutral grey trim matching hero border pattern. */
export function getResumeShiftButtonChrome(): ReturnType<typeof getComplianceChrome> {
  return {
    onColoredSurface: true,
    surfaceClass: driverPuckSlate,
    textClass: "text-white dark:text-slate-100",
  };
}

/** Tint for the decorative hero ring mask — tracks button chrome, not compliance sheet warnings. */
export function getActionRingTintClass(input: {
  complianceTone: ComplianceTone;
  breakDueTone: BreakDueTone;
  idleRestBlocked?: boolean;
  breakRestBankedMinutes?: number | null;
}): string {
  const { complianceTone, breakDueTone, idleRestBlocked, breakRestBankedMinutes } = input;
  if (idleRestBlocked) return "bg-red-500 dark:bg-red-600";
  if (breakDueTone === "red") return "bg-red-500 dark:bg-red-600";
  if (breakDueTone === "amber") return "bg-amber-500 dark:bg-amber-600";
  if (complianceTone === "pending") {
    return resolveBreakRestPendingPhase(breakRestBankedMinutes) === "first_10"
      ? "bg-amber-500 dark:bg-amber-600"
      : "bg-lime-500 dark:bg-lime-600";
  }
  if (complianceTone === "ok") return "bg-emerald-500 dark:bg-emerald-600";
  if (complianceTone === "warning" || complianceTone === "violation") {
    return "bg-amber-500 dark:bg-amber-600";
  }
  return "bg-slate-400 dark:bg-slate-500";
}

export function resolveComplianceTone(input: {
  loading?: boolean;
  hasViolations?: boolean;
  hasWarnings?: boolean;
  shiftSegmentOpen?: boolean;
  breakRestIncomplete?: boolean;
}): ComplianceTone {
  if (input.loading) return "default";
  if (input.hasViolations) return "violation";
  if (input.hasWarnings) return "warning";
  if (input.breakRestIncomplete) return "pending";
  if (input.shiftSegmentOpen) return "ok";
  return "default";
}

/** Maps work-window minutes left to break-due button chrome. */
export function resolveBreakDueTone(
  remainingWindowMinutes: number | null,
  currentSegment: "work" | "break" | null
): BreakDueTone {
  if (currentSegment !== "work" || remainingWindowMinutes == null) return null;
  if (remainingWindowMinutes <= 15) return "red";
  if (remainingWindowMinutes <= 45) return "amber";
  return null;
}

/** In-cab button tone — live work/break/idle state only (not sheet retrospective warnings). */
export function resolveOperationalTone(input: {
  loading?: boolean;
  currentSegment?: "work" | "break" | null;
  breakRestIncomplete?: boolean;
  shiftSegmentOpen?: boolean;
}): ComplianceTone {
  if (input.loading) return "default";
  if (input.breakRestIncomplete) return "pending";
  if (input.currentSegment === "work" || input.currentSegment === "break") return "ok";
  if (input.shiftSegmentOpen) return "ok";
  return "default";
}

export function resolveActionChrome(input: {
  complianceTone: ComplianceTone;
  breakDueTone: BreakDueTone;
  isIdleAtTop?: boolean;
  idleRestBlocked?: boolean;
  breakRestBankedMinutes?: number | null;
}): ReturnType<typeof getComplianceChrome> {
  const {
    complianceTone,
    breakDueTone,
    isIdleAtTop,
    idleRestBlocked,
    breakRestBankedMinutes,
  } = input;
  if (idleRestBlocked) {
    return getComplianceChrome("default", "red");
  }
  if (isIdleAtTop && complianceTone === "default" && breakDueTone == null) {
    return getComplianceChrome("ok", null);
  }
  return getComplianceChrome(complianceTone, breakDueTone, breakRestBankedMinutes);
}
