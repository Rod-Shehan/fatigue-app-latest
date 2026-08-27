import type { ComplianceCheckResult, ManagerComplianceItem } from "@/lib/api";
import type { FatigueSheet } from "@/lib/api";
import { MANAGER_EXPERIENCE, type ManagerRiskTier } from "@/lib/manager-experience";

export type GlanceBadge = { label: string; tone: "neutral" | "warn" | "bad" };

/** Warnings that are record-quality / education — not fatigue exposure for manager tiering. */
const HOUSEKEEPING_RULE_IDS = new Set([
  "shift_change_education",
  "location_evidence",
  "odometer_gps_plausibility",
]);

export function isHousekeepingComplianceWarning(r: ComplianceCheckResult): boolean {
  if (r.type !== "warning") return false;
  if (r.ruleId && HOUSEKEEPING_RULE_IDS.has(r.ruleId)) return true;
  // Shift-change gap checks without times — fix the record, not an exposure alert.
  if (r.ruleId === "shift_change_24h") return true;
  return false;
}

export function fatigueExposureWarnings(results: ComplianceCheckResult[]): ComplianceCheckResult[] {
  return results.filter((r) => r.type === "warning" && !isHousekeepingComplianceWarning(r));
}

/** Badges that can raise manager tier (GPS coverage alone does not). */
export function badgeAffectsTier(badge: GlanceBadge, level: "attention" | "elevated"): boolean {
  if (badge.label.startsWith("GPS ")) return false;
  if (level === "attention") return badge.tone === "bad";
  if (level === "elevated") {
    if (badge.tone !== "warn") return false;
    if (badge.label.startsWith("Run plan: monitor")) return false;
    return true;
  }
  return false;
}

export function buildGlanceBadges(item: ManagerComplianceItem): GlanceBadge[] {
  const badges: GlanceBadge[] = [];
  const results = item.results ?? [];
  const hasShiftChangeViolation = results.some(
    (r) => r.ruleId === "shift_change_24h" && r.type === "violation"
  );
  const hasShiftChangeWarning = results.some(
    (r) =>
      r.ruleId === "shift_change_24h" &&
      r.type === "warning" &&
      r.message.toLowerCase().includes("end shift")
  );
  if (hasShiftChangeViolation) badges.push({ label: "Shift change <24h", tone: "bad" });
  else if (hasShiftChangeWarning) badges.push({ label: "Shift change time missing", tone: "warn" });

  const movementDetected = results.some((r) =>
    r.message.toLowerCase().includes("movement evidence detected")
  );
  const stationaryNotProven = results.some(
    (r) => r.type === "warning" && r.message.toLowerCase().includes("enable location to prove stationary")
  );
  if (movementDetected) badges.push({ label: "Movement during rest", tone: "bad" });
  else if (stationaryNotProven) badges.push({ label: "Stationary rest not proven", tone: "warn" });

  const total = item.totalEvents ?? 0;
  const withLoc = item.eventsWithLocation ?? 0;
  if (total > 0) {
    const pct = Math.round((withLoc / total) * 100);
    badges.push({ label: `GPS ${pct}%`, tone: pct < 50 ? "warn" : "neutral" });
  }

  const risk = item.risk_register;
  if (risk?.worstLevel === "critical") {
    badges.push({ label: "Prospective: critical", tone: "bad" });
  } else if (risk?.worstLevel === "elevated") {
    badges.push({ label: "Prospective: elevated", tone: "warn" });
  } else if (risk?.worstLevel === "monitor" && risk.entries.length > 0) {
    badges.push({ label: "Run plan: monitor", tone: "warn" });
  }

  return badges;
}

export type RiskLineKind =
  | "break_due"
  | "break_overdue"
  | "no_stop_long"
  | "insufficient_nonwork";

export type NearTermRiskHint = {
  kind: RiskLineKind;
  detail: string;
};

const NEAR_TERM_KIND_RANK: Record<RiskLineKind, number> = {
  break_overdue: 0,
  break_due: 1,
  insufficient_nonwork: 2,
  no_stop_long: 3,
};

/** Pick the most urgent live signal per driver (break overdue before a long open shift). */
export function indexNearTermByDriver(
  lines: Array<{ driver: string; kind: RiskLineKind; detail: string }>
): Map<string, NearTermRiskHint> {
  const map = new Map<string, NearTermRiskHint>();
  for (const line of lines) {
    const prev = map.get(line.driver);
    if (!prev || NEAR_TERM_KIND_RANK[line.kind] < NEAR_TERM_KIND_RANK[prev.kind]) {
      map.set(line.driver, { kind: line.kind, detail: line.detail });
    }
  }
  return map;
}

export function chipLabelForNearTermKind(kind: RiskLineKind): string {
  const chip = MANAGER_EXPERIENCE.REGISTER_CHIP;
  switch (kind) {
    case "break_overdue":
      return chip.BREAK_OVERDUE;
    case "break_due":
      return chip.BREAK_DUE;
    case "no_stop_long":
      return chip.SHIFT_NOT_ENDED;
    case "insufficient_nonwork":
      return chip.RECOVERY_WINDOW;
  }
}

/** Short enterprise chip from a compliance engine message — not a generic “needs attention”. */
export function chipLabelFromComplianceMessage(message: string): string | null {
  const chip = MANAGER_EXPERIENCE.REGISTER_CHIP;
  const m = message.toLowerCase();
  if (m.includes("exceeds 168") || (m.includes("168") && m.includes("14-day") && !m.includes("approaching"))) {
    return chip.LIMIT_168H;
  }
  if (m.includes("approaching 168")) return chip.APPROACHING_168H;
  if (m.includes("72hr") || m.includes("72h") || m.includes("rolling 72")) return chip.WINDOW_72H;
  if (m.includes("17h")) return chip.EPISODE_17H;
  if (m.includes("less than 7 hours non-work") || m.includes("7h non-work in any rolling 24")) {
    return chip.REST_7H;
  }
  if (m.includes("2×24h") || m.includes("2x24h") || m.includes("28-day alternative")) return chip.REST_14D;
  if (m.includes("48 hrs") || m.includes("48hrs") || m.includes("rolling 48")) return chip.REST_48H;
  if (m.includes("20 min rest") || m.includes("5h work")) return chip.BREAK_RULE;
  if (m.includes("movement evidence")) return chip.MOVEMENT_REST;
  if (m.includes("end shift") && m.includes("shift")) return chip.SHIFT_CHANGE_TIME;
  if (m.length > 0 && m.length <= 28) return message;
  return null;
}

function chipLabelFromRuleId(ruleId: string | undefined): string | null {
  const chip = MANAGER_EXPERIENCE.REGISTER_CHIP;
  switch (ruleId) {
    case "location_evidence":
      return chip.THIN_GPS;
    case "shift_change_education":
      return chip.SHIFT_CHANGE_SETUP;
    case "odometer_gps_plausibility":
      return chip.ODOMETER_GPS;
    default:
      return null;
  }
}

function chipFromResult(result: ComplianceCheckResult, fallback: string): string {
  const chip = MANAGER_EXPERIENCE.REGISTER_CHIP;
  if (result.ruleId === "shift_change_24h") {
    return result.type === "violation" ? chip.SHIFT_CHANGE : chip.SHIFT_CHANGE_TIME;
  }
  return (
    chipLabelFromRuleId(result.ruleId) ??
    chipLabelFromComplianceMessage(result.message) ??
    fallback
  );
}

export function interventionForKind(kind: RiskLineKind): {
  action: string;
  steps: string[];
  messageStarter: string;
} {
  switch (kind) {
    case "break_overdue":
      return {
        action: "Verify safe stop and rest",
        steps: [
          "Call or message to confirm they are off the road safely.",
          "If still driving, agree an immediate stop — logistics can wait.",
          "After rest, confirm the record shows break/non-work correctly.",
        ],
        messageStarter:
          "Checking in — are you in a safe place to take your required break? Let me know your status when you can.",
      };
    case "break_due":
      return {
        action: "Plan break before the window closes",
        steps: [
          "Confirm route and next safe stop.",
          "Avoid stacking pressure — offer support if traffic or load blocks stopping.",
        ],
        messageStarter:
          "Quick check-in — your next break window is coming up. Do you have a safe stop planned?",
      };
    case "no_stop_long":
      return {
        action: "Clarify shift status",
        steps: [
          "They may still be working, or may have finished without logging End shift.",
          "Align the record with reality before relying on it for assurance.",
        ],
        messageStarter:
          "Can you confirm whether you're still on shift or finished? We want the record to match what happened.",
      };
    case "insufficient_nonwork":
      return {
        action: "Respect recovery window",
        steps: [
          "Confirm they are not being asked to start before 7h non-work since last End shift.",
          "Review roster if pressure is systemic.",
        ],
        messageStarter:
          "Checking recovery time since your last End shift — let me know if roster pressure is making rest difficult.",
      };
  }
}

function hasElevatedProspectiveRegister(item: ManagerComplianceItem): boolean {
  const w = item.risk_register?.worstLevel;
  return w === "elevated" || w === "critical";
}

function hasThinGpsEvidence(item: ManagerComplianceItem): boolean {
  const total = item.totalEvents ?? 0;
  const withLoc = item.eventsWithLocation ?? 0;
  return total > 0 && withLoc / total < 0.5;
}

export function tierForComplianceItem(
  item: ManagerComplianceItem,
  opts?: { hasNearTermRisk?: boolean; unsigned?: boolean }
): ManagerRiskTier {
  const results = item.results ?? [];
  if (results.some((r) => r.type === "violation")) return "attention";
  if (results.some((r) => r.message.toLowerCase().includes("movement evidence detected"))) {
    return "attention";
  }
  if (opts?.hasNearTermRisk) return "attention";

  const badges = buildGlanceBadges(item);
  if (badges.some((b) => badgeAffectsTier(b, "attention"))) return "attention";

  const exposureWarnings = fatigueExposureWarnings(results);
  if (exposureWarnings.length > 0) return "elevated";
  if (hasElevatedProspectiveRegister(item)) return "elevated";
  if (badges.some((b) => badgeAffectsTier(b, "elevated"))) return "elevated";

  if (opts?.unsigned) return "monitor";
  if (results.some((r) => isHousekeepingComplianceWarning(r))) return "monitor";
  if (hasThinGpsEvidence(item)) return "monitor";
  const risk = item.risk_register;
  if (risk?.worstLevel === "monitor" && (risk.entries?.length ?? 0) > 0) return "monitor";

  return "clear";
}

export function deriveTopSignal(
  item: ManagerComplianceItem,
  tier: ManagerRiskTier,
  opts: { nearTerm?: NearTermRiskHint | null; unsigned?: boolean },
  badges: GlanceBadge[]
): string {
  return deriveRegisterPresentation(item, tier, opts, badges).topSignal;
}

export function deriveRegisterPresentation(
  item: ManagerComplianceItem,
  tier: ManagerRiskTier,
  opts: { nearTerm?: NearTermRiskHint | null; unsigned?: boolean },
  badges: GlanceBadge[]
): { chipLabel: string; topSignal: string } {
  const chip = MANAGER_EXPERIENCE.REGISTER_CHIP;
  const results = item.results ?? [];
  const violations = results.filter((r) => r.type === "violation");
  const exposureWarnings = fatigueExposureWarnings(results);
  const housekeeping = results.filter((r) => isHousekeepingComplianceWarning(r));
  const nearTerm = opts.nearTerm ?? null;

  if (tier === "attention") {
    if (nearTerm) {
      return {
        chipLabel: chipLabelForNearTermKind(nearTerm.kind),
        topSignal: nearTerm.detail,
      };
    }
    if (violations.length) {
      const first = violations[0]!;
      return {
        chipLabel: chipFromResult(first, chip.HOURS_BREACH),
        topSignal: first.message.slice(0, 80),
      };
    }
    if (results.some((r) => r.message.toLowerCase().includes("movement evidence detected"))) {
      return {
        chipLabel: chip.MOVEMENT_REST,
        topSignal: "Movement during rest detected on the record",
      };
    }
    const bad = badges.find((b) => badgeAffectsTier(b, "attention"));
    if (bad) return { chipLabel: bad.label, topSignal: bad.label };
    return { chipLabel: MANAGER_EXPERIENCE.TIER_ATTENTION, topSignal: "Review driver record" };
  }

  if (tier === "elevated") {
    if (exposureWarnings.length) {
      const first = exposureWarnings[0]!;
      return {
        chipLabel: chipFromResult(first, chip.BREAK_RULE),
        topSignal: first.message.slice(0, 80),
      };
    }
    const topProspective = item.risk_register?.entries.find(
      (e) => e.scenario === "planned" && e.riskLevel !== "low"
    );
    if (topProspective) {
      return {
        chipLabel: chip.PLANNED_RUN,
        topSignal: topProspective.summary.slice(0, 80),
      };
    }
    const warn = badges.find((b) => badgeAffectsTier(b, "elevated"));
    if (warn) return { chipLabel: warn.label, topSignal: warn.label };
    return { chipLabel: MANAGER_EXPERIENCE.TIER_ELEVATED, topSignal: "Review driver record" };
  }

  if (tier === "monitor") {
    if (opts.unsigned) {
      return { chipLabel: chip.UNSIGNED, topSignal: "Week not yet signed by driver" };
    }
    if (housekeeping.length) {
      const first = housekeeping[0]!;
      return {
        chipLabel: chipFromResult(first, chip.RECORD_GAP),
        topSignal: first.message.slice(0, 80),
      };
    }
    const gps = badges.find((b) => b.label.startsWith("GPS ") && b.tone === "warn");
    if (gps) {
      return {
        chipLabel: chip.THIN_GPS,
        topSignal: `Location on ${gps.label.replace("GPS ", "")} of events — optional GPS`,
      };
    }
    const runPlan = badges.find((b) => b.label.startsWith("Run plan:"));
    if (runPlan) return { chipLabel: chip.RUN_PLAN_WATCH, topSignal: runPlan.label };
    return { chipLabel: MANAGER_EXPERIENCE.TIER_MONITOR, topSignal: "Review driver record" };
  }

  if (tier === "clear") {
    return { chipLabel: MANAGER_EXPERIENCE.TIER_CLEAR, topSignal: "No elevated signals" };
  }
  return { chipLabel: MANAGER_EXPERIENCE.TIER_ATTENTION, topSignal: "Review driver record" };
}

export type DriverRegisterRow = {
  sheetId: string;
  driver: string;
  tier: ManagerRiskTier;
  /** Context-sensitive leading issue (shown on the coloured chip). */
  chipLabel: string;
  topSignal: string;
  badges: GlanceBadge[];
};

export function buildDriverRegister(
  items: ManagerComplianceItem[] | undefined,
  weekStarting: string,
  sheets: FatigueSheet[],
  nearTermByDriver: Map<string, NearTermRiskHint> = new Map()
): DriverRegisterRow[] {
  if (!items?.length || !weekStarting) return [];
  const filtered = items.filter((i) => i.week_starting === weekStarting);
  const sheetById = new Map(sheets.map((s) => [s.id, s]));

  const rows: DriverRegisterRow[] = filtered.map((item) => {
    const sheet = sheetById.get(item.sheetId);
    const unsigned = Boolean(sheet && !sheet.signature);
    const driver = item.driver_name || "—";
    const nearTerm = nearTermByDriver.get(driver) ?? null;
    const hasNearTermRisk = nearTerm != null;
    const tier = tierForComplianceItem(item, { hasNearTermRisk, unsigned });
    const badges = buildGlanceBadges(item);
    const { chipLabel, topSignal } = deriveRegisterPresentation(
      item,
      tier,
      { nearTerm, unsigned },
      badges
    );

    return { sheetId: item.sheetId, driver, tier, chipLabel, topSignal, badges };
  });

  const order: Record<ManagerRiskTier, number> = {
    attention: 0,
    elevated: 1,
    monitor: 2,
    clear: 3,
  };
  return rows.sort((a, b) => order[a.tier] - order[b.tier] || a.driver.localeCompare(b.driver));
}

export function fleetTierCounts(rows: DriverRegisterRow[]): Record<ManagerRiskTier, number> {
  return rows.reduce(
    (acc, r) => {
      acc[r.tier]++;
      return acc;
    },
    { attention: 0, elevated: 0, monitor: 0, clear: 0 } as Record<ManagerRiskTier, number>
  );
}
