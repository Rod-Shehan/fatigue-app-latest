/**
 * Shared compliance colours for driver primary actions (LogBar, DriverActionHero).
 */

export type ComplianceTone = "default" | "violation" | "warning" | "pending" | "ok";
export type BreakDueTone = null | "amber" | "red";

export function getComplianceChrome(
  complianceTone: ComplianceTone,
  breakDueTone: BreakDueTone
): { onColoredSurface: boolean; surfaceClass: string; textClass: string } {
  const onColoredSurface = complianceTone !== "default" || breakDueTone != null;

  const surfaceClass =
    complianceTone === "violation" || complianceTone === "warning"
      ? "bg-amber-500 dark:bg-amber-600 border-4 border-amber-100 dark:border-amber-950 shadow-lg hover:bg-amber-600 dark:hover:bg-amber-500 active:bg-amber-700"
      : breakDueTone === "red"
        ? "bg-red-600 dark:bg-red-700 border-4 border-red-100 dark:border-red-950 shadow-lg hover:bg-red-700 dark:hover:bg-red-600 active:bg-red-800"
        : breakDueTone === "amber"
          ? "bg-amber-500 dark:bg-amber-600 border-4 border-amber-100 dark:border-amber-950 shadow-lg hover:bg-amber-600 dark:hover:bg-amber-500 active:bg-amber-700"
          : complianceTone === "pending"
            ? "bg-gradient-to-r from-amber-500 via-lime-500 to-emerald-500 dark:from-amber-600 dark:via-lime-600 dark:to-emerald-600 border-4 border-emerald-100 dark:border-emerald-950 shadow-lg"
            : complianceTone === "ok"
              ? "bg-emerald-500 dark:bg-emerald-600 border-4 border-emerald-100 dark:border-emerald-950 shadow-lg hover:bg-emerald-600 dark:hover:bg-emerald-500 active:bg-emerald-700"
              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600";

  const textClass =
    complianceTone === "violation" || complianceTone === "warning"
      ? "text-white dark:text-amber-950"
      : breakDueTone === "red"
        ? "text-white"
        : breakDueTone === "amber"
          ? "text-white dark:text-amber-950"
          : complianceTone === "pending"
            ? "text-white dark:text-emerald-950"
            : complianceTone === "ok"
              ? "text-white dark:text-emerald-950"
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
    trimClass:
      "bg-red-100 dark:bg-red-950 shadow-lg shadow-black/25 dark:shadow-black/40",
    surfaceClass:
      "bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600 active:bg-red-800",
    textClass: "text-white",
  };
}

/** Round Resume shift secondary — neutral grey trim matching hero border pattern. */
export function getResumeShiftButtonChrome(): ReturnType<typeof getComplianceChrome> {
  return {
    onColoredSurface: true,
    surfaceClass:
      "bg-slate-500 dark:bg-slate-600 border-4 border-slate-100 dark:border-slate-950 shadow-lg hover:bg-slate-600 dark:hover:bg-slate-500 active:bg-slate-700",
    textClass: "text-white dark:text-slate-100",
  };
}

/** Tint for the decorative hero ring mask — tracks button chrome, not compliance sheet warnings. */
export function getActionRingTintClass(input: {
  complianceTone: ComplianceTone;
  breakDueTone: BreakDueTone;
  idleRestBlocked?: boolean;
}): string {
  const { complianceTone, breakDueTone, idleRestBlocked } = input;
  if (idleRestBlocked) return "bg-red-500 dark:bg-red-600";
  if (breakDueTone === "red") return "bg-red-500 dark:bg-red-600";
  if (breakDueTone === "amber") return "bg-amber-500 dark:bg-amber-600";
  if (complianceTone === "pending") return "bg-lime-500 dark:bg-lime-600";
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
}): ReturnType<typeof getComplianceChrome> {
  const { complianceTone, breakDueTone, isIdleAtTop, idleRestBlocked } = input;
  if (idleRestBlocked) {
    return getComplianceChrome("default", "red");
  }
  if (isIdleAtTop && complianceTone === "default" && breakDueTone == null) {
    return getComplianceChrome("ok", null);
  }
  return getComplianceChrome(complianceTone, breakDueTone);
}
