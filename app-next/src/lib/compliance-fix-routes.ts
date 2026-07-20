/**
 * Maps compliance messages to a primary fix destination.
 * Every warning banner should use this — if kind is review_only, do not pretend the user can fix it in-app.
 */

export type ComplianceFixKind =
  | "setup_week_record"
  | "edit_day"
  | "manager_amend"
  | "review_only";

export type ComplianceFixInput = {
  message: string;
  type?: "violation" | "warning" | "info";
  scrollDayIndex?: number;
  ruleId?: string;
  day?: string;
  /** Fallback when the issue is on the live day card. */
  currentDayIndex?: number;
};

export type ComplianceFixRoute = {
  kind: ComplianceFixKind;
  driverLabel: string;
  managerLabel: string;
  scrollDayIndex?: number;
};

export const MANAGER_FIX_RECORD_LABEL = "Fix on record";
export const REVIEW_DETAILS_LABEL = "Review details";
export const FIX_DAY_LABEL = "Fix this day";

/** Must match SETUP_WEEK_RECORD_BUTTON_LABEL in declared-24h-rests.ts */
const SETUP_WEEK_RECORD_LABEL = "Set up week record";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const FIX_PRIORITY: Record<ComplianceFixKind, number> = {
  setup_week_record: 0,
  edit_day: 1,
  manager_amend: 1,
  review_only: 99,
};

export function dayIndexFromComplianceDay(day: string | undefined): number | undefined {
  if (!day) return undefined;
  const i = DAY_LABELS.indexOf(day as (typeof DAY_LABELS)[number]);
  return i >= 0 ? i : undefined;
}

export function isComplianceFixActionable(route: ComplianceFixRoute): boolean {
  return route.kind !== "review_only";
}

function isSetupWeekRecordMessage(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("2×24h") || m.includes("2x24h")) return true;
  if (m.includes("28-day alternative")) return true;
  if (m.includes("rolling 14-day non-work gap")) return true;
  if (m.includes("no previous sheet found to check full 14-day")) return true;
  return false;
}

function isRetrospectiveOnlyMessage(message: string, type?: ComplianceFixInput["type"]): boolean {
  const m = message.toLowerCase();
  if (type === "info") return true;
  if (m.includes("optional check") || m.includes("optional note")) return true;
  if (m.includes("location wasn't recorded")) return true;
  if (m.includes("recorded km") && m.includes("gps path")) return true;
  if (type === "violation" && (m.includes("exceeds 168") || m.includes("14-day work exceeds"))) {
    return true;
  }
  if (
    type === "violation" &&
    m.includes("17h") &&
    (m.includes("elapsed") || m.includes("separated by more than 17h"))
  ) {
    return true;
  }
  return false;
}

function isEditDayMessage(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("20 min rest") || m.includes("5h work")) return true;
  if (m.includes("72hr") || m.includes("72h") || m.includes("rolling 72")) return true;
  if (m.includes("7h non-work") || m.includes("7 consecutive hours")) return true;
  if (m.includes("17h")) return true;
  if (m.includes("48 hrs") || m.includes("48hrs")) return true;
  if (m.includes("shift pattern") || m.includes("shift change")) return true;
  if (m.includes("approaching 168")) return true;
  if (m.includes("moving vehicle")) return true;
  return false;
}

export function resolveComplianceFixRoute(input: ComplianceFixInput): ComplianceFixRoute {
  const { message, type, scrollDayIndex, ruleId, day, currentDayIndex } = input;

  if (isRetrospectiveOnlyMessage(message, type)) {
    return {
      kind: "review_only",
      driverLabel: REVIEW_DETAILS_LABEL,
      managerLabel: REVIEW_DETAILS_LABEL,
    };
  }

  if (isSetupWeekRecordMessage(message)) {
    return {
      kind: "setup_week_record",
      driverLabel: SETUP_WEEK_RECORD_LABEL,
      managerLabel: MANAGER_FIX_RECORD_LABEL,
    };
  }

  const dayIdx = scrollDayIndex ?? dayIndexFromComplianceDay(day) ?? currentDayIndex;

  if (
    scrollDayIndex != null ||
    ruleId === "shift_change_24h" ||
    ruleId === "shift_change_education"
  ) {
    return {
      kind: "edit_day",
      driverLabel: FIX_DAY_LABEL,
      managerLabel: FIX_DAY_LABEL,
      scrollDayIndex: scrollDayIndex ?? dayIdx,
    };
  }

  if (isEditDayMessage(message) && dayIdx != null) {
    return {
      kind: "edit_day",
      driverLabel: FIX_DAY_LABEL,
      managerLabel: FIX_DAY_LABEL,
      scrollDayIndex: dayIdx,
    };
  }

  if (type === "warning" && isEditDayMessage(message)) {
    return {
      kind: "edit_day",
      driverLabel: FIX_DAY_LABEL,
      managerLabel: FIX_DAY_LABEL,
      scrollDayIndex: currentDayIndex,
    };
  }

  if (type === "violation") {
    const idx = dayIndexFromComplianceDay(day);
    if (idx != null) {
      return {
        kind: "edit_day",
        driverLabel: FIX_DAY_LABEL,
        managerLabel: FIX_DAY_LABEL,
        scrollDayIndex: idx,
      };
    }
    return {
      kind: "review_only",
      driverLabel: REVIEW_DETAILS_LABEL,
      managerLabel: MANAGER_FIX_RECORD_LABEL,
    };
  }

  return {
    kind: "review_only",
    driverLabel: REVIEW_DETAILS_LABEL,
    managerLabel: REVIEW_DETAILS_LABEL,
  };
}

/** Pick the most helpful single fix when a banner lists several issues. */
export function resolvePrimaryComplianceFixRoute(
  items: ComplianceFixInput[]
): ComplianceFixRoute | null {
  if (!items.length) return null;
  const routes = items.map((item) => resolveComplianceFixRoute(item));
  const actionable = routes.filter((r) => r.kind !== "review_only");
  if (!actionable.length) return routes[0] ?? null;
  return [...actionable].sort((a, b) => FIX_PRIORITY[a.kind] - FIX_PRIORITY[b.kind])[0];
}

export function complianceIssueInputsFromMessages(
  messages: string[],
  type: "warning" | "violation" = "warning",
  currentDayIndex?: number
): ComplianceFixInput[] {
  return messages.map((message) => ({ message, type, currentDayIndex }));
}

/** True when the driver can fix this warning via Set up day header fields. */
export function isComplianceMessageFixableInDaySetup(message: string): boolean {
  return resolveComplianceFixRoute({ message, type: "warning" }).kind === "setup_week_record";
}

export function complianceMessagesFixableInDaySetup(messages: string[]): boolean {
  return messages.some(isComplianceMessageFixableInDaySetup);
}

export function isComplianceMessageActionable(
  message: string,
  type?: "violation" | "warning" | "info"
): boolean {
  return resolveComplianceFixRoute({ message, type }).kind !== "review_only";
}
