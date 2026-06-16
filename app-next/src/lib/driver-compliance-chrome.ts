/**
 * Shared compliance colours for driver primary actions (LogBar hero, CompliancePieHero).
 * Pie wedge tiers use the same saturated palette as button chrome.
 */

export type ComplianceTone = "default" | "violation" | "warning" | "pending" | "ok";
export type BreakDueTone = null | "amber" | "red";

/** Pie wedge / conic-gradient palette — aligned with getComplianceChrome surfaces. */
export const COMPLIANCE_PIE_PALETTE = {
  safe: { from: "#10b981", to: "#059669" }, // emerald-500 → emerald-600
  warning: { from: "#f59e0b", to: "#d97706" }, // amber-500 → amber-600
  breach: { from: "#dc2626", to: "#b91c1c" }, // red-600 → red-700
  track: "#020617", // slate-950 — unused wedge portion
  idleTrack: "#475569", // slate-600 — visible on dark focus overlay
} as const;

export type CompliancePieWedgeTier = "safe" | "warning" | "breach" | "neutral";

export function getComplianceChrome(
  complianceTone: ComplianceTone,
  breakDueTone: BreakDueTone
): { onColoredSurface: boolean; surfaceClass: string; textClass: string } {
  const onColoredSurface = complianceTone !== "default" || breakDueTone != null;

  const surfaceClass =
    complianceTone === "violation" || complianceTone === "warning"
      ? "bg-amber-500 dark:bg-amber-600 border-4 border-amber-950 dark:border-amber-100 shadow-lg hover:bg-amber-600 dark:hover:bg-amber-500 active:bg-amber-700"
      : breakDueTone === "red"
        ? "bg-red-600 dark:bg-red-700 border-4 border-red-950 dark:border-red-100 shadow-lg hover:bg-red-700 dark:hover:bg-red-600 active:bg-red-800"
        : breakDueTone === "amber"
          ? "bg-amber-500 dark:bg-amber-600 border-4 border-amber-950 dark:border-amber-100 shadow-lg hover:bg-amber-600 dark:hover:bg-amber-500 active:bg-amber-700"
          : complianceTone === "pending"
            ? "bg-gradient-to-r from-amber-500 via-lime-500 to-emerald-500 dark:from-amber-600 dark:via-lime-600 dark:to-emerald-600 border-4 border-emerald-950 dark:border-emerald-100 shadow-lg"
            : complianceTone === "ok"
              ? "bg-emerald-500 dark:bg-emerald-600 border-4 border-emerald-950 dark:border-emerald-100 shadow-lg hover:bg-emerald-600 dark:hover:bg-emerald-500 active:bg-emerald-700"
              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600";

  const textClass =
    complianceTone === "violation" || complianceTone === "warning"
      ? "text-amber-950 dark:text-white"
      : breakDueTone === "red"
        ? "text-white"
        : breakDueTone === "amber"
          ? "text-amber-950 dark:text-white"
          : complianceTone === "pending"
            ? "text-emerald-950 dark:text-white"
            : complianceTone === "ok"
              ? "text-emerald-950 dark:text-white"
              : "text-slate-900 dark:text-slate-100";

  return { onColoredSurface, surfaceClass, textClass };
}

export function resolveComplianceTone(input: {
  loading?: boolean;
  hasViolations?: boolean;
  hasWarnings?: boolean;
  shiftSegmentOpen?: boolean;
}): ComplianceTone {
  if (input.loading) return "default";
  if (input.hasViolations) return "violation";
  if (input.hasWarnings) return "warning";
  if (input.shiftSegmentOpen) return "ok";
  return "default";
}

/** Same thresholds as compliance-clock — maps work-window minutes left to break-due chrome. */
export function resolveBreakDueTone(
  remainingWindowMinutes: number | null,
  currentSegment: "work" | "break" | null
): BreakDueTone {
  if (currentSegment !== "work" || remainingWindowMinutes == null) return null;
  if (remainingWindowMinutes <= 15) return "red";
  if (remainingWindowMinutes <= 45) return "amber";
  return null;
}

/** Wedge colour tier — mirrors getComplianceChrome priority (sheet issues → break due → ok). */
export function resolvePieWedgeTier(
  complianceTone: ComplianceTone,
  breakDueTone: BreakDueTone
): CompliancePieWedgeTier {
  if (complianceTone === "violation" || complianceTone === "warning") return "warning";
  if (breakDueTone === "red") return "breach";
  if (breakDueTone === "amber") return "warning";
  if (complianceTone === "ok" || complianceTone === "pending") return "safe";
  return "neutral";
}

export function resolveActionChrome(input: {
  complianceTone: ComplianceTone;
  breakDueTone: BreakDueTone;
  isIdleAtTop?: boolean;
}): ReturnType<typeof getComplianceChrome> {
  const { complianceTone, breakDueTone, isIdleAtTop } = input;
  if (isIdleAtTop && complianceTone === "default" && breakDueTone == null) {
    return getComplianceChrome("ok", null);
  }
  return getComplianceChrome(complianceTone, breakDueTone);
}
