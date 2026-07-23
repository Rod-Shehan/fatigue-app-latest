import type { FatigueSheet, PrismaClient } from "@prisma/client";
import type { ComplianceCheckResult } from "@/lib/api";
import { getComplianceEngine, parseJurisdictionCode, type JurisdictionCode } from "@/lib/jurisdiction";
import { getSlotOffsetWithinTodayLocal } from "@/lib/compliance";
import { loadComplianceWeekContext, parseSheetDaysJson } from "@/lib/compliance-history";
import { last24hBreakEndMsFromIso } from "@/lib/last-24h-break-range";

/**
 * Same inputs as manager compliance / sheet API — used for PDF roadside summary.
 */
export async function computeComplianceForSheetExport(
  prisma: PrismaClient,
  row: Pick<
    FatigueSheet,
    | "driverName"
    | "weekStarting"
    | "driverType"
    | "last24hBreak"
    | "last24hBreakEnd"
    | "days"
    | "jurisdictionCode"
  >
): Promise<{ results: ComplianceCheckResult[]; jurisdictionCode: JurisdictionCode }> {
  const { prevWeekDays, prevWeekStarting, historyDays } = await loadComplianceWeekContext(
    prisma,
    row.driverName,
    row.weekStarting
  );
  const days = parseSheetDaysJson(row.days);

  const now = Date.now();
  const today = new Date(now);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const slotOffsetWithinToday = getSlotOffsetWithinTodayLocal(now, row.jurisdictionCode);

  const [yw, mw, dw] = row.weekStarting.split("-").map(Number);
  let currentDayIndex: number | undefined;
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(yw, mw - 1, dw + i);
    const ds = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(dayDate.getDate()).padStart(2, "0")}`;
    if (ds === todayStr) {
      currentDayIndex = i;
      break;
    }
  }

  const jurisdictionCode = parseJurisdictionCode(row.jurisdictionCode);
  const engine = getComplianceEngine(jurisdictionCode);
  const results = engine.run(days, {
    driverType: row.driverType ?? "solo",
    prevWeekDays,
    historyDays,
    last24hBreak: row.last24hBreak ?? undefined,
    last24hBreakEndMs: last24hBreakEndMsFromIso(row.last24hBreakEnd?.toISOString()),
    weekStarting: row.weekStarting,
    prevWeekStarting,
    currentDayIndex,
    slotOffsetWithinToday,
  });

  return { results, jurisdictionCode };
}
