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
