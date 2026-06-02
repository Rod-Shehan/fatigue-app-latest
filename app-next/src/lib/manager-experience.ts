/**
 * Manager-facing narrative: risk identification and assurance, not enforcement.
 * Paired with driver copy in product-copy.ts — different audience, same record contract.
 */

export const MANAGER_EXPERIENCE = {
  PAGE_TITLE: "Fleet risk brief",
  PAGE_SUBTITLE:
    "Identify fatigue exposure early, strengthen record assurance, and support drivers before small gaps become harm.",

  NAV_RISK_BRIEF: "Risk brief",
  NAV_TEAM: "Team & fleet",
  NAV_MAP: "Movement map",
  NAV_MESSAGES: "Conversations",

  HERO_EYEBROW: "This week at a glance",
  /** Shown only in the risk hero — not repeated under the page title. */
  HERO_WEEK_INTRO:
    "Tier counts combine rule outcomes, record gaps, and near-term exposure for drivers visible this work week.",
  HERO_DISCLAIMER:
    "Guidance for operational decisions — not legal advice. Your policies and regulators (NHVR, state OSH) remain authoritative.",

  TIER_ATTENTION: "Needs attention",
  TIER_ELEVATED: "Elevated exposure",
  TIER_MONITOR: "Monitor",
  TIER_CLEAR: "Assurance looks steady",

  TIER_ATTENTION_HINT: "Rule breach, corroboration concern, or imminent fatigue risk — prioritise a human check-in.",
  TIER_ELEVATED_HINT: "Warnings or near-term break/recovery pressure — plan a supportive conversation.",
  TIER_MONITOR_HINT: "Unsigned week, thin GPS, or minor gaps — verify before relying on the record.",
  TIER_CLEAR_HINT: "No elevated signals for this week in the data we can see.",

  SNAPSHOT_TITLE: "Assurance signals",
  SNAPSHOT_SUBTITLE:
    "What the record shows for the selected work week and the week before — framed for learning, not blame.",

  CURRENT_WEEK_LABEL: "Selected week",
  PRIOR_WEEK_LABEL: "Week before",

  EMPTY_ASSURANCE:
    "No rule breaches flagged for visible drivers this week. Keep monitoring exposure and record quality.",

  WORKBENCH_TITLE: "Weekly review",
  WORKBENCH_SUBTITLE: "Choose a work week and day, then focus the fleet or open a driver record.",

  TAB_IDENTIFY: "Identify risk",
  TAB_RECORDS: "Records & amendments",

  TAB_IDENTIFY_HELP:
    "Filter by exposure, record gaps, or the next 24 hours. Open a sheet when you need detail or a conversation.",

  TAB_RECORDS_HELP:
    "Correct genuine errors with a reason on file, then ask the driver to sign again — document control, not discipline.",

  FILTER_ATTENTION: "Needs attention",
  FILTER_GAPS: "Record gaps",
  FILTER_UNSIGNED: "Unsigned weeks",
  FILTER_NEXT24: "Next 24 hours",

  ATTENTION_PANEL_TITLE: "Drivers to check in with",
  ATTENTION_PANEL_SUBTITLE:
    "Leading indicators from live events — break timing, long running work, recovery windows. Reach out to understand, not to accuse.",

  ATTENTION_EMPTY:
    "No elevated near-term exposure for your current week and day filters.",

  REGISTER_TITLE: "Driver exposure register",
  REGISTER_SUBTITLE: "One row per driver for the selected work week — tier is a composite, not a single rule.",

  REFERENCE_TITLE: "Fatigue & assurance reference",
  REFERENCE_TOGGLE: "Open reference library",
  REFERENCE_CLOSE: "Close",

  CIRCADIAN_TITLE: "Circadian context (industry guidance)",
  CIRCADIAN_FOOTNOTE:
    "Typical human performance curves — not a prediction for any individual driver.",

  MESSAGE_STARTER_LABEL: "Optional conversation starter",
  ACTION_OPEN_SHEET: "Open record",
  ACTION_OPEN_INBOX: "Start conversation",

  MAP_PAGE_SUBTITLE: "See where work, breaks, and stops were logged — context for assurance, not surveillance.",
  MESSAGES_PAGE_SUBTITLE: "Check in with drivers when exposure rises — coaching tone, not compliance orders.",
} as const;

export type ManagerRiskTier = "attention" | "elevated" | "monitor" | "clear";

export const MANAGER_TIER_STYLES: Record<
  ManagerRiskTier,
  { label: string; chip: string; dot: string }
> = {
  attention: {
    label: MANAGER_EXPERIENCE.TIER_ATTENTION,
    chip: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-100",
    dot: "bg-rose-500",
  },
  elevated: {
    label: MANAGER_EXPERIENCE.TIER_ELEVATED,
    chip: "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100",
    dot: "bg-amber-500",
  },
  monitor: {
    label: MANAGER_EXPERIENCE.TIER_MONITOR,
    chip: "bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-100",
    dot: "bg-sky-500",
  },
  clear: {
    label: MANAGER_EXPERIENCE.TIER_CLEAR,
    chip: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
};

export type CircadianLevel = "high" | "moderate" | "lower";

export function getCircadianContext(now = new Date()): {
  level: CircadianLevel;
  headline: string;
  detail: string;
} {
  const h = now.getHours();
  if (h >= 2 && h < 6) {
    return {
      level: "high",
      headline: "Early-morning circadian low",
      detail:
        "Industry data consistently shows elevated crash risk between roughly 02:00 and 06:00. If drivers are on the road now, plan extra fatigue controls and verify rest was real.",
    };
  }
  if (h >= 22 || h < 2) {
    return {
      level: "moderate",
      headline: "Late-night driving window",
      detail:
        "Night work stacks sleep debt quickly. Pair roster conversations with what the record shows for breaks and non-work between shifts.",
    };
  }
  if (h >= 13 && h < 15) {
    return {
      level: "moderate",
      headline: "Afternoon performance dip",
      detail:
        "Many workers experience a post-lunch alertness dip. Useful context when reviewing long afternoon work blocks — not a violation by itself.",
    };
  }
  return {
    level: "lower",
    headline: "Standard daytime window",
    detail:
      "Circadian risk is comparatively lower, but cumulative hours awake, short recovery, and record gaps still matter.",
  };
}
