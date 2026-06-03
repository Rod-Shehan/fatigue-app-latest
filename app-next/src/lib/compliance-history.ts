import type { PrismaClient } from "@prisma/client";
import type { ComplianceDayData } from "@/lib/compliance";
import { getPreviousWeekSunday } from "@/lib/weeks";

/** Prior weeks loaded for 28-day rules, rolling audit, and 168h context (excludes current week). */
export const COMPLIANCE_PRIOR_WEEKS_LOOKBACK = 12;

export type ComplianceWeekContext = {
  prevWeekDays: ComplianceDayData[] | null;
  prevWeekStarting: string | undefined;
  /** Chronological days from older weeks only (not the immediate prior week). */
  historyDays: ComplianceDayData[];
};

export function parseSheetDaysJson(daysJson: string): ComplianceDayData[] {
  try {
    const parsed = JSON.parse(daysJson);
    return Array.isArray(parsed) ? (parsed as ComplianceDayData[]) : [];
  } catch {
    return [];
  }
}

/** Sunday YYYY-MM-DD values for the N weeks before `weekStarting` (index 0 = previous week). */
export function priorWeekSundays(weekStarting: string, count: number): string[] {
  const out: string[] = [];
  let w = getPreviousWeekSunday(weekStarting);
  for (let i = 0; i < count; i++) {
    out.push(w);
    w = getPreviousWeekSunday(w);
  }
  return out;
}

type WeekSheetLike = { days: string };

/**
 * Build prev week + history from a map keyed by weekStarting.
 * historyDays = weeks prev2 … prevN (oldest first); prev week is separate for 168h / extended rules.
 */
export function buildComplianceWeekContextFromMap(
  weekStarting: string,
  byWeekStarting: Map<string, WeekSheetLike>,
  lookbackWeeks = COMPLIANCE_PRIOR_WEEKS_LOOKBACK
): ComplianceWeekContext {
  const sundays = priorWeekSundays(weekStarting, lookbackWeeks);
  const prevWeekStarting = sundays[0];
  const prevSheet = prevWeekStarting ? byWeekStarting.get(prevWeekStarting) : undefined;
  const prevWeekDays = prevSheet ? parseSheetDaysJson(prevSheet.days) : null;

  const historyDays: ComplianceDayData[] = [];
  for (let i = lookbackWeeks - 1; i >= 1; i--) {
    const sheet = byWeekStarting.get(sundays[i]!);
    if (sheet) historyDays.push(...parseSheetDaysJson(sheet.days));
  }

  return {
    prevWeekDays,
    prevWeekStarting: prevSheet ? prevWeekStarting : undefined,
    historyDays,
  };
}

export async function loadComplianceWeekContext(
  prisma: PrismaClient,
  driverName: string,
  weekStarting: string,
  lookbackWeeks = COMPLIANCE_PRIOR_WEEKS_LOOKBACK
): Promise<ComplianceWeekContext> {
  const sundays = priorWeekSundays(weekStarting, lookbackWeeks);
  const sheets = await prisma.fatigueSheet.findMany({
    where: { driverName, weekStarting: { in: sundays } },
    select: { weekStarting: true, days: true },
  });
  const byWeek = new Map(sheets.map((s) => [s.weekStarting, { days: s.days }]));
  return buildComplianceWeekContextFromMap(weekStarting, byWeek, lookbackWeeks);
}
