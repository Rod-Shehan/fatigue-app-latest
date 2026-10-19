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
import { normalizeWeekDateString } from "@/lib/weeks";

export type SheetComplianceRunInput = {
  days: ComplianceDayData[];
  driverType?: string;
  prevWeekDays?: ComplianceDayData[] | null;
  historyDays?: ComplianceDayData[] | null;
  last24hBreak?: string;
  last24hBreakStart?: string | null;
  last24hBreakEnd?: string | null;
  last24hBreakEndMs?: number | null;
  declared24hRests?: {
    last_24h_rest_1?: string | null;
    last_24h_rest_2?: string | null;
    last_24h_rest_3?: string | null;
    last_24h_rest_4?: string | null;
    last_24h_rest_1_start?: string | null;
    last_24h_rest_1_end?: string | null;
    last_24h_rest_2_start?: string | null;
    last_24h_rest_2_end?: string | null;
    last_24h_rest_3_start?: string | null;
    last_24h_rest_3_end?: string | null;
    last_24h_rest_4_start?: string | null;
    last_24h_rest_4_end?: string | null;
  } | null;
  weekStarting?: string;
  prevWeekStarting?: string;
  currentDayIndex?: number;
  slotOffsetWithinToday?: number;
  jurisdiction_code?: string;
};

function complianceDaysTapeScore(days: ComplianceDayData[] | null | undefined): number {
  if (!days?.length) return 0;
  let score = 0;
  for (const d of days) {
    score += Array.isArray(d.events) ? d.events.length : 0;
    if (d.work_time?.some(Boolean) || d.breaks?.some(Boolean) || d.non_work?.some(Boolean)) {
      score += 1;
    }
  }
  return score;
}

/** Prefer the slice that actually has events/coverage — list meta is often `days: []`. */
export function pickRicherComplianceDays(
  remote: ComplianceDayData[] | null | undefined,
  local: ComplianceDayData[] | null | undefined
): ComplianceDayData[] | null {
  const remoteScore = complianceDaysTapeScore(remote);
  const localScore = complianceDaysTapeScore(local);
  if (localScore > remoteScore) return local ?? null;
  if (remote && remote.length) return remote;
  return local ?? remote ?? null;
}

export function buildDriverComplianceWeekContext(
  driverName: string,
  weekStarting: string,
  allSheets: FatigueSheet[]
): ComplianceWeekContext {
  const key = driverName.trim().toLowerCase();
  const week = normalizeWeekDateString(weekStarting);
  const byWeek = new Map<string, { days: string }>();
  for (const s of allSheets) {
    if ((s.driver_name ?? "").trim().toLowerCase() !== key) continue;
    if (!s.week_starting) continue;
    const ws = normalizeWeekDateString(s.week_starting);
    const next = { days: JSON.stringify(s.days ?? []) };
    const prev = byWeek.get(ws);
    if (!prev) {
      byWeek.set(ws, next);
      continue;
    }
    const prevDays = JSON.parse(prev.days) as ComplianceDayData[];
    const nextDays = JSON.parse(next.days) as ComplianceDayData[];
    if (complianceDaysTapeScore(nextDays) >= complianceDaysTapeScore(prevDays)) {
      byWeek.set(ws, next);
    }
  }
  return buildComplianceWeekContextFromMap(week, byWeek);
}

export function runLocalSheetComplianceCheck(input: SheetComplianceRunInput): ComplianceCheckResult[] {
  const jurisdiction = parseJurisdictionCode(input.jurisdiction_code);
  const engine = getComplianceEngine(jurisdiction);
  return engine.run(input.days, {
    driverType: input.driverType,
    prevWeekDays: input.prevWeekDays ?? null,
    historyDays: input.historyDays ?? null,
    last24hBreak: input.last24hBreak,
    last24hBreakStart: input.last24hBreakStart ?? null,
    last24hBreakEnd: input.last24hBreakEnd ?? null,
    last24hBreakEndMs: input.last24hBreakEndMs ?? null,
    declared24hRests: input.declared24hRests ?? null,
    weekStarting: input.weekStarting,
    prevWeekStarting: input.prevWeekStarting,
    currentDayIndex: input.currentDayIndex,
    slotOffsetWithinToday: input.slotOffsetWithinToday,
  });
}
