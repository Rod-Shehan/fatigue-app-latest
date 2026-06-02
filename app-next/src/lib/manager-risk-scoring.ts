import type { ManagerComplianceItem } from "@/lib/api";
import type { FatigueSheet } from "@/lib/api";
import type { ManagerRiskTier } from "@/lib/manager-experience";

export type GlanceBadge = { label: string; tone: "neutral" | "warn" | "bad" };

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
  if (badges.some((b) => b.tone === "bad")) return "attention";

  if (results.some((r) => r.type === "warning")) return "elevated";
  if (badges.some((b) => b.tone === "warn")) return "elevated";
  if (opts?.hasNearTermRisk) return "elevated";

  if (opts?.unsigned) return "monitor";
  const total = item.totalEvents ?? 0;
  const withLoc = item.eventsWithLocation ?? 0;
  if (total > 0 && withLoc / total < 0.5) return "monitor";

  return "clear";
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

    const violations = (item.results ?? []).filter((r) => r.type === "violation");
    const warnings = (item.results ?? []).filter((r) => r.type === "warning");
    let topSignal = "No elevated signals";
    if (hasNearTermRisk) topSignal = "Near-term exposure in next 24h";
    else if (violations.length) topSignal = violations[0]!.message.slice(0, 80);
    else if (warnings.length) topSignal = warnings[0]!.message.slice(0, 80);
    else if (unsigned) topSignal = "Week not yet signed by driver";
    else if (badges.find((b) => b.tone === "bad")) topSignal = badges.find((b) => b.tone === "bad")!.label;
    else if (badges.find((b) => b.tone === "warn")) topSignal = badges.find((b) => b.tone === "warn")!.label;

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
