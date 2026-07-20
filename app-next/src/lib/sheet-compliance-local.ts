/**
 * RULE IP — Do not change fatigue time/compliance rule logic without explicit owner approval.
 * See .cursor/rules/time-rules-ip.mdc
 *
 * Client-side compliance for driver UI — same engines as POST /api/compliance/check.
 */

import type { ComplianceCheckResult, FatigueSheet } from "@/lib/api";
import type { ComplianceDayData } from "@/lib/compliance";
import {
  buildComplianceWeekContextFromMap,
  type ComplianceWeekContext,
} from "@/lib/compliance-history";
import { getComplianceEngine, parseJurisdictionCode } from "@/lib/jurisdiction";

export type SheetComplianceRunInput = {
  days: ComplianceDayData[];
  driverType?: string;
  prevWeekDays?: ComplianceDayData[] | null;
  historyDays?: ComplianceDayData[] | null;
  last24hBreak?: string;
  declared24hRests?: {
    last_24h_rest_1?: string | null;
    last_24h_rest_2?: string | null;
    last_24h_rest_3?: string | null;
    last_24h_rest_4?: string | null;
  } | null;
  weekStarting?: string;
  prevWeekStarting?: string;
  currentDayIndex?: number;
  slotOffsetWithinToday?: number;
  jurisdiction_code?: string;
};

export function buildDriverComplianceWeekContext(
  driverName: string,
  weekStarting: string,
  allSheets: FatigueSheet[]
): ComplianceWeekContext {
  const key = driverName.trim().toLowerCase();
  const byWeek = new Map<string, { days: string }>();
  for (const s of allSheets) {
    if ((s.driver_name ?? "").trim().toLowerCase() !== key) continue;
    if (!s.week_starting) continue;
    byWeek.set(s.week_starting, { days: JSON.stringify(s.days ?? []) });
  }
  return buildComplianceWeekContextFromMap(weekStarting, byWeek);
}

export function runLocalSheetComplianceCheck(input: SheetComplianceRunInput): ComplianceCheckResult[] {
  const jurisdiction = parseJurisdictionCode(input.jurisdiction_code);
  const engine = getComplianceEngine(jurisdiction);
  return engine.run(input.days, {
    driverType: input.driverType,
    prevWeekDays: input.prevWeekDays ?? null,
    historyDays: input.historyDays ?? null,
    last24hBreak: input.last24hBreak,
    declared24hRests: input.declared24hRests ?? null,
    weekStarting: input.weekStarting,
    prevWeekStarting: input.prevWeekStarting,
    currentDayIndex: input.currentDayIndex,
    slotOffsetWithinToday: input.slotOffsetWithinToday,
  });
}
