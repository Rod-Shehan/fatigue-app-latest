/**
 * Driver self-reported alertness at shift / day setup.
 * Not a fitness-for-work (FFW) legal declaration — context for risk engine only.
 */

export type DriverAlertnessLevel = 1 | 2 | 3 | 4 | 5;

export type DriverAlertnessTone = "green" | "yellow" | "orange" | "red" | "stop";

export type DriverAlertnessOption = {
  level: DriverAlertnessLevel;
  emoji: string;
  /** Short label in dropdown trigger. */
  shortLabel: string;
  title: string;
  description: string;
  tone: DriverAlertnessTone;
};

export const DRIVER_ALERTNESS_LEVELS: readonly DriverAlertnessOption[] = [
  {
    level: 1,
    emoji: "🟢",
    shortLabel: "100% Awake",
    title: "100% Awake",
    description: "Feeling great, fully focused, and completely ready to drive.",
    tone: "green",
  },
  {
    level: 2,
    emoji: "🟡",
    shortLabel: "A Little Tired",
    title: "A Little Tired",
    description: "Yawning a bit or feeling a minor drop in energy, but still driving safely.",
    tone: "yellow",
  },
  {
    level: 3,
    emoji: "🟠",
    shortLabel: "Tired (Warning)",
    title: "Tired (Warning)",
    description: "Eyes feel heavy, mind is wandering, or blinking more than usual.",
    tone: "orange",
  },
  {
    level: 4,
    emoji: "🔴",
    shortLabel: "Very Tired (Risk)",
    title: "Very Tired (Risk)",
    description: "Missing exits, slow to react, or yawning constantly. Need to take a break.",
    tone: "red",
  },
  {
    level: 5,
    emoji: "🛑",
    shortLabel: "Danger (Stop)",
    title: "Danger (Stop)",
    description: "Head dropping, drifting out of the lane, or having micro-sleeps. Must stop driving now.",
    tone: "stop",
  },
] as const;

export const DRIVER_ALERTNESS_DISCLAIMER =
  "How you feel right now — not a fitness-for-work sign-off. Your formal FFW is completed outside this app.";

export function isDriverAlertnessLevel(value: unknown): value is DriverAlertnessLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function getDriverAlertnessOption(level: DriverAlertnessLevel | null | undefined): DriverAlertnessOption | null {
  if (!isDriverAlertnessLevel(level)) return null;
  return DRIVER_ALERTNESS_LEVELS.find((o) => o.level === level) ?? null;
}

export function formatDriverAlertnessCompact(level: DriverAlertnessLevel | null | undefined): string {
  const opt = getDriverAlertnessOption(level);
  if (!opt) return "—";
  return `${opt.emoji} ${opt.shortLabel}`;
}

/** 0–1 self-report factor for risk engine fusion (higher = more impaired). */
export function driverAlertnessRiskFactor(level: DriverAlertnessLevel | null | undefined): number {
  if (!isDriverAlertnessLevel(level)) return 0;
  const map: Record<DriverAlertnessLevel, number> = {
    1: 0.05,
    2: 0.25,
    3: 0.5,
    4: 0.75,
    5: 1,
  };
  return map[level];
}

export function driverAlertnessNeedsBreakWarning(level: DriverAlertnessLevel | null | undefined): boolean {
  return level === 4 || level === 5;
}

export function driverAlertnessMustStop(level: DriverAlertnessLevel | null | undefined): boolean {
  return level === 5;
}

const TONE_TRIGGER_CLASS: Record<DriverAlertnessTone, string> = {
  green:
    "border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100",
  yellow:
    "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100",
  orange:
    "border-orange-500 bg-orange-50 text-orange-950 dark:border-orange-500 dark:bg-orange-950/40 dark:text-orange-100",
  red: "border-red-500 bg-red-50 text-red-950 dark:border-red-500 dark:bg-red-950/40 dark:text-red-100",
  stop: "border-red-800 bg-red-950 text-red-50 dark:border-red-600 dark:bg-red-950 dark:text-red-50",
};

const TONE_ITEM_CLASS: Record<DriverAlertnessTone, string> = {
  green: "focus:bg-emerald-50 dark:focus:bg-emerald-950/50",
  yellow: "focus:bg-amber-50 dark:focus:bg-amber-950/50",
  orange: "focus:bg-orange-50 dark:focus:bg-orange-950/50",
  red: "focus:bg-red-50 dark:focus:bg-red-950/50",
  stop: "focus:bg-red-950/80 dark:focus:bg-red-950",
};

export function alertnessTriggerClass(tone: DriverAlertnessTone | null): string {
  if (!tone) return "";
  return TONE_TRIGGER_CLASS[tone];
}

export function alertnessItemClass(tone: DriverAlertnessTone): string {
  return TONE_ITEM_CLASS[tone];
}
