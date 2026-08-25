/**
 * Activity theme – colours and button styles for logged types.
 * Locked words: docs/product/activity-glossary.md (Work, Rest, Other work, Non-work).
 * Used by LogBar, EventLogger, CompliancePanel, and related UI.
 *
 * Terminology: locked in docs/product/activity-glossary.md.
 * Rest = not driving and not doing a job task. Other work = not driving but still a job task.
 * Non-work = off the job (7h / 24h / 72h). Do not call non-work "rest".
 */

export type ActivityKey = "work" | "break" | "other_work" | "non_work" | "stop";

export const ACTIVITY_THEME: Record<
  ActivityKey,
  {
    hex: string;
    rgb: [number, number, number];
    button: string;
    /** Outline “Add …” controls (Set up day event editor) — border + label colour. */
    outlineButton: string;
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
    outlineButton:
      "border-blue-400 dark:border-blue-500 text-blue-900 dark:text-blue-100 hover:bg-blue-50 dark:hover:bg-blue-950/40",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200",
    statsCard: "bg-blue-50 dark:bg-blue-900/30 dark:border-blue-800/50",
    statsLabel: "text-blue-500 dark:text-blue-400",
    statsValue: "text-blue-700 dark:text-blue-200",
  },
  break: {
    hex: "#f59e0b",
    rgb: [251, 191, 36],
    button: "bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300",
    outlineButton:
      "border-amber-400 dark:border-amber-500 text-amber-900 dark:text-amber-100 hover:bg-amber-50 dark:hover:bg-amber-950/40",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
    statsCard: "bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800/50",
    statsLabel: "text-amber-500 dark:text-amber-400",
    statsValue: "text-amber-700 dark:text-amber-200",
  },
  other_work: {
    hex: "#6366f1",
    rgb: [99, 102, 241],
    button: "bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300",
    outlineButton:
      "border-indigo-400 dark:border-indigo-500 text-indigo-900 dark:text-indigo-100 hover:bg-indigo-50 dark:hover:bg-indigo-950/40",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200",
    statsCard: "bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-800/50",
    statsLabel: "text-indigo-500 dark:text-indigo-400",
    statsValue: "text-indigo-700 dark:text-indigo-200",
  },
  non_work: {
    hex: "#10b981",
    rgb: [52, 211, 153],
    button: "bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300",
    outlineButton:
      "border-emerald-400 dark:border-emerald-500 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/40",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
    statsCard: "bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-800/50",
    statsLabel: "text-emerald-500 dark:text-emerald-400",
    statsValue: "text-emerald-700 dark:text-emerald-200",
  },
  stop: {
    hex: "#ef4444",
    rgb: [239, 68, 68],
    button: "bg-red-500 hover:bg-red-600 disabled:bg-red-300",
    outlineButton:
      "border-red-400 dark:border-red-500 text-red-900 dark:text-red-100 hover:bg-red-50 dark:hover:bg-red-950/40",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200",
    statsCard: "bg-red-50 dark:bg-red-900/30 dark:border-red-800/50",
    statsLabel: "text-red-500 dark:text-red-400",
    statsValue: "text-red-700 dark:text-red-200",
  },
};

/**
 * Hero split chooser — related to time-record hues, not the same solid bars.
 * Work / Rest / Non-work on the day sheet are blue-500 / amber-500 / emerald-500.
 * The split is a lighter disk with a colour pip: driving = work blue, rest = rest amber,
 * other work = quieter slate + blue pip (still on the job — not non-work green).
 */
export const HERO_SPLIT_CHROME = {
  work: {
    half: "driver-puck-face driver-puck-blue",
    text: "text-white",
    pip: "bg-blue-200",
  },
  break: {
    half: "driver-puck-face driver-puck-amber",
    text: "text-white",
    pip: "bg-amber-100",
  },
  other_work: {
    half: "driver-puck-face driver-puck-slate",
    text: "text-slate-50",
    pip: "bg-blue-200",
  },
  passenger: {
    half: "driver-puck-face driver-puck-slate",
    text: "text-slate-50",
    pip: "bg-indigo-200",
  },
  sleeper_berth: {
    half: "driver-puck-face driver-puck-emerald",
    text: "text-white",
    pip: "bg-emerald-100",
  },
  load_check: {
    half: "driver-puck-face driver-puck-slate",
    text: "text-slate-50",
    pip: "bg-blue-200",
  },
} as const;
