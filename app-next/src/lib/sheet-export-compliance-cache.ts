import type { ComplianceCheckResult, FatigueSheet } from "@/lib/api";
import {
  buildComplianceWeekContextFromMap,
  parseSheetDaysJson,
} from "@/lib/compliance-history";
import { getSlotOffsetWithinTodayLocal } from "@/lib/compliance";
import { getComplianceEngine, parseJurisdictionCode, type JurisdictionCode } from "@/lib/jurisdiction";
import { last24hBreakEndMsFromIso } from "@/lib/last-24h-break-range";
import { declared24hRestsFromSheet } from "@/lib/declared-24h-rests";

/** Compliance for PDF / roadside using cached weekly sheets (IndexedDB), not Prisma. */
export function computeComplianceForCachedSheets(
  allSheets: FatigueSheet[],
  row: FatigueSheet
): { results: ComplianceCheckResult[]; jurisdictionCode: JurisdictionCode } {
  const byWeek = new Map<string, { days: string }>();
  for (const s of allSheets) {
    if (s.driver_name !== row.driver_name || !s.week_starting) continue;
    byWeek.set(s.week_starting, { days: JSON.stringify(s.days ?? []) });
  }
  const { prevWeekDays, prevWeekStarting, historyDays } = buildComplianceWeekContextFromMap(
    row.week_starting,
    byWeek
  );
  const days = row.days ?? [];

  const now = Date.now();
  const today = new Date(now);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const slotOffsetWithinToday = getSlotOffsetWithinTodayLocal(now, row.jurisdiction_code);

  const [yw, mw, dw] = row.week_starting.split("-").map(Number);
  let currentDayIndex: number | undefined;
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(yw, mw - 1, dw + i);
    const ds = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(dayDate.getDate()).padStart(2, "0")}`;
    if (ds === todayStr) {
      currentDayIndex = i;
      break;
    }
  }

  const jurisdictionCode = parseJurisdictionCode(row.jurisdiction_code);
  const engine = getComplianceEngine(jurisdictionCode);
  const results = engine.run(days, {
    driverType: row.driver_type ?? "solo",
    prevWeekDays,
    historyDays,
    last24hBreak: row.last_24h_break ?? undefined,
    last24hBreakEndMs: last24hBreakEndMsFromIso(row.last_24h_break_end),
    declared24hRests: declared24hRestsFromSheet(row),
    weekStarting: row.week_starting,
    prevWeekStarting,
    currentDayIndex,
    slotOffsetWithinToday,
  });

  return { results, jurisdictionCode };
}

export function parseSheetDaysFromApi(days: FatigueSheet["days"]) {
  return parseSheetDaysJson(JSON.stringify(days ?? []));
}
