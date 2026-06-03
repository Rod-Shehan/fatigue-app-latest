import type { ComplianceCheckResult, ManagerComplianceItem } from "@/lib/api";
import type { FatigueSheet } from "@/lib/api";
import type { ManagerRiskTier } from "@/lib/manager-experience";

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
  opts: { hasNearTermRisk?: boolean; unsigned?: boolean },
  badges: GlanceBadge[]
): string {
  const results = item.results ?? [];
  const violations = results.filter((r) => r.type === "violation");
  const exposureWarnings = fatigueExposureWarnings(results);
  const housekeeping = results.filter((r) => isHousekeepingComplianceWarning(r));

  if (tier === "attention") {
    if (opts.hasNearTermRisk) return "Near-term exposure in next 24h";
    if (violations.length) return violations[0]!.message.slice(0, 80);
    if (results.some((r) => r.message.toLowerCase().includes("movement evidence detected"))) {
      return "Movement during rest detected on the record";
    }
    const bad = badges.find((b) => badgeAffectsTier(b, "attention"));
    if (bad) return bad.label;
  }

  if (tier === "elevated") {
    if (exposureWarnings.length) return exposureWarnings[0]!.message.slice(0, 80);
    const topProspective = item.risk_register?.entries.find(
      (e) => e.scenario === "planned" && e.riskLevel !== "low"
    );
    if (topProspective) return topProspective.summary.slice(0, 80);
    const warn = badges.find((b) => badgeAffectsTier(b, "elevated"));
    if (warn) return warn.label;
  }

  if (tier === "monitor") {
    if (opts.unsigned) return "Week not yet signed by driver";
    if (housekeeping.length) return housekeeping[0]!.message.slice(0, 80);
    const gps = badges.find((b) => b.label.startsWith("GPS ") && b.tone === "warn");
    if (gps) return `Location on ${gps.label.replace("GPS ", "")} of events — optional GPS`;
    const runPlan = badges.find((b) => b.label.startsWith("Run plan:"));
    if (runPlan) return runPlan.label;
  }

  if (tier === "clear") return "No elevated signals";
  return "Review driver record";
}

export type DriverRegisterRow = {
  sheetId: string;
  driver: string;
  tier: ManagerRiskTier;
  topSignal: string;
  badges: GlanceBadge[];
};

export function buildDriverRegister(
  items: ManagerComplianceItem[] | undefined,
  weekStarting: string,
  sheets: FatigueSheet[],
  riskDriverNames: Set<string>
): DriverRegisterRow[] {
  if (!items?.length || !weekStarting) return [];
  const filtered = items.filter((i) => i.week_starting === weekStarting);
  const sheetById = new Map(sheets.map((s) => [s.id, s]));

  const rows: DriverRegisterRow[] = filtered.map((item) => {
    const sheet = sheetById.get(item.sheetId);
    const unsigned = Boolean(sheet && !sheet.signature);
    const driver = item.driver_name || "—";
    const hasNearTermRisk = riskDriverNames.has(driver);
    const tier = tierForComplianceItem(item, { hasNearTermRisk, unsigned });
    const badges = buildGlanceBadges(item);
    const topSignal = deriveTopSignal(item, tier, { hasNearTermRisk, unsigned }, badges);

    return { sheetId: item.sheetId, driver, tier, topSignal, badges };
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
