/**
 * Manager-facing narrative: risk identification and assurance, not enforcement.
 * Paired with driver copy in product-copy.ts — different audience, same record contract.
 *
 * Layout: manager UI is **monitor-first, mobile-second** (wide containers, multi-column
 * defaults, stack below `md` via `max-md:`). Driver sheet UI is **mobile-first** — see
 * `.cursor/rules/responsive-priority.mdc`.
 */

/** Shared content width for manager desk pages (matches Driver Overview /manager). */
export const MANAGER_PAGE_SHELL = "mx-auto max-w-6xl px-4 py-8 md:py-12" as const;

/** Live alerts — mobile-first triage queue; intentionally narrower than the desk shell. */
export const MANAGER_ALERTS_SHELL = "mx-auto max-w-lg px-4 py-3 md:max-w-2xl md:px-6" as const;

export const MANAGER_EXPERIENCE = {
  PAGE_TITLE: "Driver Overview",
  PAGE_SUBTITLE:
    "Three areas on one page: risk analysis for coaching, compliance analysis for regulators, and sheet amendments for document control.",

  DOMAIN_RISK_TITLE: "1. Risk analysis",
  DOMAIN_RISK_BLURB:
    "Future timeline modelling, live exposure, and 15-minute glance scores — assurance only, not a signed violation.",
  DOMAIN_COMPLIANCE_TITLE: "2. Compliance Analysis",
  DOMAIN_COMPLIANCE_BLURB:
    "Attested diary, rule outcomes, and regulatory references (the laws) auditors expect.",

  DOMAIN_EDIT_TITLE: "3. Records & amendments",
  DOMAIN_EDIT_BLURB:
    "Select a sheet to correct errors with a reason on file, then ask the driver to sign again — document control, not discipline.",

  /** Muted chip on domain overview cards when a section has nothing actionable. */
  DOMAIN_KPI_ALL_CLEAR: "All clear",

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

  SECTION_COMPLIANCE_TITLE: "Compliance Analysis",
  SECTION_COMPLIANCE_SUBTITLE:
    "Complying with the law: attested work diary, live rule outcomes on signed weeks, the regulations that define those rules, and record amendments.",
  SECTION_COMPLIANCE_BOUNDARY:
    "Legal boundary: this section is the hard compliance view — attested records, rule engine results, and statutory references. Risk analysis above does not replace signed outcomes or legal duties.",

  SECTION_BOUNDARY_TOOLTIP_LABEL: "Legal boundary",
  COMPLIANCE_REGULATORY_INTRO:
    "The rules your fleet must meet — WA Reg 184E hours, record retention, NHVR chain of responsibility, codes of practice, and industry guidance. Open the library to read what each outcome is measured against.",

  SCOPE_TITLE: "Day picker",
  SCOPE_SUBTITLE: "Week, day, driver, and rego apply to both sections below.",
  SCOPE_DRIVER_AUTO: "Highest current risk (auto)",
  SCOPE_DAY_DIALOG_TITLE: "Choose work day",
  SCOPE_DAY_DIALOG_HINT: "Fleet heatmap and driver chart use this day within the work week.",
  SCOPE_TOGGLE_OPEN: "Show day picker",
  SCOPE_TOGGLE_CLOSE: "Hide day picker",

  /** Hot vs cold electronic records (P3) — not the same as “past week” driver archive. */
  ARCHIVE_ACCESS_CHIP: "Older records",
  ARCHIVE_ACCESS_TITLE: "Request records from long-term storage",
  ARCHIVE_ACCESS_HINT:
    "Recent weeks open instantly here. Older retained records (data + signature) may sit in long-term storage — we reassemble them on request. This is not an instant date range.",
  ARCHIVE_ACCESS_SLA: (days: number) =>
    `Standard retrieval: about ${days} business day${days === 1 ? "" : "s"} (Perth). Urgent legal hold or regulator produce: escalate same day when practicable.`,
  ARCHIVE_ACCESS_SOR_NOTE:
    "We deliver the electronic source of truth (logged data + signature + attestation details). A PDF can be regenerated from that record if you need a printable copy.",
  ARCHIVE_ACCESS_RANGE_FROM: "From week (Sunday)",
  ARCHIVE_ACCESS_RANGE_TO: "To week (Sunday)",
  ARCHIVE_ACCESS_REASON: "Why you need these records",
  ARCHIVE_ACCESS_REASON_PLACEHOLDER: "e.g. audit, legal hold, regulator request…",
  ARCHIVE_ACCESS_SUBMIT: "Submit request",
  ARCHIVE_ACCESS_CANCEL: "Cancel",
  ARCHIVE_ACCESS_OUTSIDE_LIVE:
    "That week is outside the live (instant) window. Use Request older records — do not expect the overview filters to load it like last week.",
  ARCHIVE_ACCESS_SUCCESS:
    "Request received. Circadia will retrieve and reassemble the electronic record and contact you.",
  ARCHIVE_ACCESS_ERROR: "Could not submit the request. Try again or contact Circadia support.",
  ARCHIVE_ACCESS_LIVE_BANNER_ALL_HOT:
    "All signed weeks are currently on the live system (pilot). Use Request older records for a formal pack or legal hold — not for everyday browsing.",

  /** Page title and back-link label for /manager. */
  NAV_RISK_BRIEF: "Driver Overview",
  /** App sign-in page — switch between Driver, Manager, and Owner. */
  NAV_LOBBY: "Log-in Page" as const,
  /** Short subnav label — avoids repeating the page title in the nav bar. */
  NAV_OVERVIEW: "Overview",
  NAV_MAP: "Event Tracker",
  NAV_MESSAGES: "Conversations",
  NAV_ALERTS: "Live alerts",
  NAV_DRIVERS: "Drivers",
  NAV_MANAGERS: "Managers",
  NAV_RECORDS: "Records",
  RECORDS_PAGE_SUBTITLE:
    "Pick a driver, then a week. Fatigue, fitness for work, prestart, and load checks stay separate under that week.",
  RECORDS_WEEK_LABEL: "Week",
  RECORDS_VIEW_WEEK: "View week record",
  RECORDS_EXPORT_PDF: "Export PDF",
  RECORDS_SUBJECTS_HINT:
    "Previous weeks first. Each subject is its own file — they may be called up or audited separately.",
  RECORDS_SUBJECT_FATIGUE: "Fatigue sheet",
  RECORDS_SUBJECT_FFW: "Fitness for work record",
  RECORDS_SUBJECT_PRESTART: "Prestart record",
  RECORDS_SUBJECT_LOAD: "Load checks",
  RECORDS_FATIGUE_DETAIL: "Weekly Trip Sheet — work and rest diary",
  RECORDS_NO_DRIVERS: "No drivers on the roster yet.",
  RECORDS_NO_WEEKS: "No week records for this driver.",
  RECORDS_PICK_DRIVER: "Select a driver on the left.",
  NAV_REGOS: "Rego",
  NAV_ROUTES: "Routes",
  NAV_GUIDE: "User guide",

  HERO_EYEBROW: "This week at a glance",
  /** Shown only in the risk hero — not repeated under the page title. */
  HERO_WEEK_INTRO:
    "Tier counts in this risk section combine near-term exposure signals with record-quality hints — open Compliance Analysis below for attested rule outcomes.",
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

  RECORDS_SHEET_LABEL: "Driver sheet",
  RECORDS_SHEET_PLACEHOLDER: "Search or select a driver's sheet…",
  RECORDS_SHEET_HINT:
    "Pick a driver sheet above to edit details, declared 24h rests, and record fields.",
  RECORDS_SHEET_EMPTY_DAY: "No matching sheets for this day / filters",
  RECORDS_SHEET_EMPTY_FLEET: "No sheets yet",

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
  REGISTER_SUBTITLE:
    "One row per driver for the selected work week. The chip names the leading issue; colour shows how urgent it is.",
  REGISTER_CHIP_HINT:
    "Rose / amber / sky still mean attention, elevated, and monitor. The words on the chip say what to look at (break overdue, 17h episode, unsigned week), and the line under the name adds the time or rule detail.",

  /** Short register-chip labels — one leading issue, not a generic “needs attention”. */
  REGISTER_CHIP: {
    BREAK_OVERDUE: "Break overdue",
    BREAK_DUE: "Break due soon",
    SHIFT_NOT_ENDED: "Shift not ended",
    RECOVERY_WINDOW: "Rest window open",
    MOVEMENT_REST: "Movement during rest",
    SHIFT_CHANGE: "Shift change under 24h",
    SHIFT_CHANGE_TIME: "Shift-change time missing",
    SHIFT_CHANGE_SETUP: "Shift-change setup",
    UNSIGNED: "Week not signed",
    THIN_GPS: "Thin location evidence",
    RECORD_GAP: "Record gap",
    ODOMETER_GPS: "Odometer vs GPS",
    RUN_PLAN_WATCH: "Run plan to watch",
    PLANNED_RUN: "Planned run risk",
    HOURS_BREACH: "Hours rule breach",
    BREAK_RULE: "20 min rest due",
    WINDOW_72H: "72h rest gap",
    EPISODE_17H: "17h episode",
    LIMIT_168H: "Over 168h work",
    APPROACHING_168H: "Approaching 168h",
    REST_7H: "7h rest short",
    REST_14D: "14-day or 28-day rest",
    REST_48H: "48h or 7-day rest",
  },

  TIMELINE_TITLE: "Individual risk",
  TIMELINE_LANE_DUTY_BEFORE_NOW: "recorded, before now",
  TIMELINE_LANE_PROJECTED: "Projected risk (after now, striped)",
  TIMELINE_LANE_PROJECTED_HINT:
    "Stripes after NOW are a risk forecast, not Work, Break, or Non-work.",
  TIMELINE_PICK_DRIVER:
    "Click a fleet row or change Chart driver in Scope.",
  TIMELINE_AUTO_HINT: "Highest current risk",
  TIMELINE_VIEW_ON_MAP: "View on Event Tracker",
  MAP_LOCATE_DRIVER: "Locate on Event Tracker",

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
  FLEET_KPI_IN_SCOPE_HINT:
    "Drivers included for the selected work week and scope filters (day, rego, chart driver).",
  FLEET_KPI_ACTIONABLE_HINT:
    "Drivers at or above 55% combined TPMA risk right now or in the next 24 hours — shown in the heatmap.",
  FLEET_KPI_WORST_NOW_HINT:
    "Highest current combined risk in scope. Tap to select that driver on the individual chart.",
  FLEET_KPI_ELEVATED_NOW_HINT:
    "How many drivers are at or above 55% combined risk at this moment (not forecast).",
  FLEET_KPI_TPMA_LIVE_HINT:
    "Whether scores use live TPMA fleet scoring on the server or demo/legacy data for this view.",
  FLEET_KPI_CHECK_INS_HINT:
    "Drivers flagged for a wellbeing check-in from elevated near-term exposure. Tap when due to scroll to the list.",
  FLEET_PRIORITY_TITLE: "Priority queue",
  FLEET_PRIORITY_HINT:
    "Only drivers at or above the elevated threshold — ranked by current TPMA risk.",
  FLEET_PRIORITY_EMPTY: "No drivers above the elevated threshold right now.",
  FLEET_PRIORITY_ALL_CLEAR: "Fleet looks steady for this scope.",
  FLEET_HEATMAP_SCROLL_LABEL: "Fleet risk timeline — scroll horizontally",
  FLEET_HEATMAP_SCROLL_LEFT: "Scroll timeline left",
  FLEET_HEATMAP_SCROLL_RIGHT: "Scroll timeline right",

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

  MAP_PAGE_SUBTITLE:
    "Logged work, breaks, and shift ends with a location — placed on the map for assurance review.",
  MESSAGES_PAGE_SUBTITLE: "Check in with drivers when exposure rises — coaching tone, not compliance orders.",

  ALERTS_PAGE_SUBTITLE:
    "Camera fatigue signals from your fleet — review clips and decide next steps. Coaching workflow, not a signed compliance breach.",
  ALERTS_EMPTY_TITLE: "No fatigue alerts in this period",
  ALERTS_EMPTY_BODY:
    "When Autonomise sends a fatigue-related event, it appears here automatically. Use Need review to work through past events, or widen the time range.",
  ALERTS_WORKFLOW_HINT:
    "Verified fatigue opens resolution logging before the alert clears. Dismiss when the clip is a false positive.",
} as const;

export type ManagerRiskTier = "attention" | "elevated" | "monitor" | "clear";

export const MANAGER_TIER_STYLES: Record<
  ManagerRiskTier,
  { label: string; chip: string; dot: string }
> = {
  attention: {
    label: MANAGER_EXPERIENCE.TIER_ATTENTION,
    chip:
      "bg-rose-600 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-rose-600 dark:text-white",
    dot: "bg-white/90",
  },
  elevated: {
    label: MANAGER_EXPERIENCE.TIER_ELEVATED,
    chip:
      "bg-amber-600 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-amber-500 dark:text-amber-950",
    dot: "bg-white/90",
  },
  monitor: {
    label: MANAGER_EXPERIENCE.TIER_MONITOR,
    chip:
      "bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-sky-600 dark:text-white",
    dot: "bg-white/90",
  },
  clear: {
    label: MANAGER_EXPERIENCE.TIER_CLEAR,
    chip:
      "bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-emerald-600 dark:text-white",
    dot: "bg-white/90",
  },
};

export type GlanceBadgeTone = "neutral" | "warn" | "bad";

/** Solid severity chips for compliance / prospective glance badges. */
export const MANAGER_GLANCE_BADGE_STYLES: Record<GlanceBadgeTone, string> = {
  bad: "rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-rose-600 dark:text-white",
  warn: "rounded-full bg-amber-600 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-amber-500 dark:text-amber-950",
  neutral:
    "rounded-full bg-slate-600 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-slate-500 dark:text-white",
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
