/**
 * Activity theme – single source of truth for Work / Break / Non-Work Time / End shift.
 * Used by LogBar, EventLogger, CompliancePanel, and related UI.
 *
 * Terminology: We use "non-work time" (not "rest") for recovery time away from work.
 * Break = short break during work (e.g. 20 min per 5 hours). Non-work time = any time
 * not logged as work or break; rules refer to "7-hr non-work" and "24h non-work time".
 */

export type ActivityKey = "work" | "break" | "non_work" | "stop";

export const ACTIVITY_THEME: Record<
  ActivityKey,
  {
    hex: string;
    rgb: [number, number, number];
    button: string;
    badge: string;
    statsCard: string;
    statsLabel: string;
    statsValue: string;
  }
> = {
  work: {
    hex: "#3b82f6",
    rgb: [59, 130, 246],
    button: "bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200",
    statsCard: "bg-blue-50 dark:bg-blue-900/30 dark:border-blue-800/50",
    statsLabel: "text-blue-500 dark:text-blue-400",
    statsValue: "text-blue-700 dark:text-blue-200",
  },
  break: {
    hex: "#f59e0b",
    rgb: [251, 191, 36],
    button: "bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
    statsCard: "bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800/50",
    statsLabel: "text-amber-500 dark:text-amber-400",
    statsValue: "text-amber-700 dark:text-amber-200",
  },
  non_work: {
    hex: "#10b981",
    rgb: [52, 211, 153],
    button: "bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
    statsCard: "bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-800/50",
    statsLabel: "text-emerald-500 dark:text-emerald-400",
    statsValue: "text-emerald-700 dark:text-emerald-200",
  },
  stop: {
    hex: "#ef4444",
    rgb: [239, 68, 68],
    button: "bg-red-500 hover:bg-red-600 disabled:bg-red-300",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200",
    statsCard: "bg-red-50 dark:bg-red-900/30 dark:border-red-800/50",
    statsLabel: "text-red-500 dark:text-red-400",
    statsValue: "text-red-700 dark:text-red-200",
  },
};
