/**
 * Manager-facing narrative: risk identification and assurance, not enforcement.
 * Paired with driver copy in product-copy.ts — different audience, same record contract.
 *
 * Layout: manager UI is **monitor-first, mobile-second** (wide containers, multi-column
 * defaults, stack below `md` via `max-md:`). Driver sheet UI is **mobile-first** — see
 * `.cursor/rules/responsive-priority.mdc`.
 */

export const MANAGER_EXPERIENCE = {
  PAGE_TITLE: "Driver Overview",
  PAGE_SUBTITLE:
    "Three areas on one page: risk analysis for coaching, compliance records for regulators, and sheet amendments for document control.",

  DOMAIN_RISK_TITLE: "1. Risk analysis",
  DOMAIN_RISK_BLURB:
    "Future timeline modelling, live exposure, and 15-minute glance scores — assurance only, not a signed violation.",
  DOMAIN_COMPLIANCE_TITLE: "2. Compliance records",
  DOMAIN_COMPLIANCE_BLURB:
    "Attested diary, rule outcomes, and regulatory references (the laws) auditors expect.",

  DOMAIN_EDIT_TITLE: "3. Records & amendments",
  DOMAIN_EDIT_BLURB:
    "Select a sheet to correct errors with a reason on file, then ask the driver to sign again — document control, not discipline.",

  SECTION_EDIT_TITLE: "Records & amendments",
  SECTION_EDIT_SUBTITLE:
    "Edit attested weekly sheets when you and the driver agree a correction is needed.",
  SECTION_EDIT_BOUNDARY:
    "Legal boundary: this is operational record maintenance — not risk coaching and not a substitute for compliance rule outcomes above. Every change needs a reason; signed weeks must be unlocked before edit. Only the driver named on the record can legally sign the record; the manager is involved for oversight of the process.",

  SECTION_RISK_TITLE: "Risk analysis",
  SECTION_RISK_SUBTITLE:
    "Prospective fatigue exposure across past, now, and planned time — for early conversations before harm.",
  SECTION_RISK_BOUNDARY:
    "Legal boundary: this section does not decide breaches. It models relative fatigue risk from diary patterns, camera blocks (when connected), and declared plans. Use it to prioritise supportive check-ins.",

  SECTION_COMPLIANCE_TITLE: "Compliance records",
  SECTION_COMPLIANCE_SUBTITLE:
    "Complying with the law: attested work diary, live rule outcomes on signed weeks, the regulations that define those rules, and record amendments.",
  SECTION_COMPLIANCE_BOUNDARY:
    "Legal boundary: this section is the hard compliance view — attested records, rule engine results, and statutory references. Risk analysis above does not replace signed outcomes or legal duties.",
  COMPLIANCE_REGULATORY_INTRO:
    "The rules your fleet must meet — WA Reg 184E hours, record retention, NHVR chain of responsibility, codes of practice, and industry guidance. Open the library to read what each outcome is measured against.",

  SCOPE_TITLE: "Day picker",
  SCOPE_SUBTITLE: "Week, day, driver, and rego apply to both sections below.",
  SCOPE_DRIVER_AUTO: "Highest current risk (auto)",
  SCOPE_DAY_DIALOG_TITLE: "Choose work day",
  SCOPE_DAY_DIALOG_HINT: "Fleet heatmap and driver chart use this day within the work week.",
  SCOPE_TOGGLE_OPEN: "Show day picker",
  SCOPE_TOGGLE_CLOSE: "Hide day picker",

  /** Page title and back-link label for /manager. */
  NAV_RISK_BRIEF: "Driver Overview",
  /** App sign-in page — switch between Driver, Manager, and Owner. */
  NAV_LOBBY: "Log-in Page" as const,
  /** Short subnav label — avoids repeating the page title in the nav bar. */
  NAV_OVERVIEW: "Overview",
  NAV_MAP: "Movement map",
  NAV_MESSAGES: "Conversations",
  NAV_DRIVERS: "Drivers",
  NAV_MANAGERS: "Managers",
  NAV_REGOS: "Rego",
  NAV_ROUTES: "Routes",
  NAV_GUIDE: "User guide",

  HERO_EYEBROW: "This week at a glance",
  /** Shown only in the risk hero — not repeated under the page title. */
  HERO_WEEK_INTRO:
    "Tier counts in this risk section combine near-term exposure signals with record-quality hints — open Compliance records below for attested rule outcomes.",
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

  SNAPSHOT_TITLE: "Compliance rule outcomes",
  SNAPSHOT_SUBTITLE:
    "Violations and material warnings from the attested weekly sheets for the selected work week and the week before — the hard compliance view. Rolling checks may use earlier submitted history.",

  CURRENT_WEEK_LABEL: "Selected week",
  PRIOR_WEEK_LABEL: "Week before",

  EMPTY_ASSURANCE_CURRENT:
    "No rule breaches on sheets for this work week. Keep monitoring exposure and record quality.",
  EMPTY_ASSURANCE_PRIOR: "No rule breaches on sheets for the week before.",

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

  TIMELINE_TITLE: "Individual risk",
  TIMELINE_PICK_DRIVER:
    "Click a fleet row or change Chart driver in Scope.",
  TIMELINE_AUTO_HINT: "Highest current risk",

  FLEET_PULSE_EYEBROW: "Live fleet tracking",
  FLEET_PULSE_TITLE: "Fleet risk pulse",
  FLEET_PULSE_SUBTITLE:
    "TPMA combined risk across every active driver — past, now, and planned 15-minute blocks. Highest exposure at the top.",
  FLEET_PULSE_EMPTY: "Choose a work week with driver activity to see the fleet heatmap.",
  FLEET_ALL_CLEAR:
    "All drivers in scope are below the elevated threshold — no heatmap rows to show. Individual chart still tracks highest current risk.",
  FLEET_ACTIONABLE_SUMMARY: (actionable: number, total: number, threshold: number) =>
    `${actionable} of ${total} driver${total === 1 ? "" : "s"} at or above ${threshold}% (now or next 24h)`,
  FLEET_KPI_IN_SCOPE: "In scope",
  FLEET_KPI_ACTIONABLE: "Need attention",
  FLEET_KPI_WORST_NOW: "Worst now",
  FLEET_KPI_ELEVATED_NOW: "Elevated now",
  FLEET_KPI_TPMA_LIVE: "TPMA live",
  FLEET_KPI_CHECK_INS: "Check-ins",
  FLEET_PRIORITY_TITLE: "Priority queue",
  FLEET_PRIORITY_HINT:
    "Only drivers at or above the elevated threshold — ranked by current TPMA risk.",
  FLEET_PRIORITY_EMPTY: "No drivers above the elevated threshold right now.",
  FLEET_PRIORITY_ALL_CLEAR: "Fleet looks steady for this scope.",

  REFERENCE_TITLE: "Regulatory requirements & references",
  REGULATORY_SECTION_TITLE: "Regulatory requirements & references",
  REFERENCE_TOGGLE: "Open reference library",
  RISK_REFERENCE_TOGGLE: "Open Risk Reference",
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
