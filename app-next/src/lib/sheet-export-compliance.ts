import type { FatigueSheet, PrismaClient } from "@prisma/client";
import type { ComplianceCheckResult } from "@/lib/api";
import type { ComplianceDayData } from "@/lib/compliance";
import { getComplianceEngine, parseJurisdictionCode, type JurisdictionCode } from "@/lib/jurisdiction";
import { getPreviousWeekSunday } from "@/lib/weeks";
import { getSlotOffsetWithinTodayLocal } from "@/lib/compliance";

function parseDays(daysJson: string): ComplianceDayData[] {
  try {
    const parsed = JSON.parse(daysJson);
    return Array.isArray(parsed) ? (parsed as ComplianceDayData[]) : [];
  } catch {
    return [];
  }
}

/**
 * Same inputs as manager compliance / sheet API — used for PDF roadside summary.
 */
export async function computeComplianceForSheetExport(
  prisma: PrismaClient,
  row: Pick<
    FatigueSheet,
    "driverName" | "weekStarting" | "driverType" | "last24hBreak" | "days" | "jurisdictionCode"
  >
): Promise<{ results: ComplianceCheckResult[]; jurisdictionCode: JurisdictionCode }> {
  const prevWeekStarting = getPreviousWeekSunday(row.weekStarting);
  const prevSheet = await prisma.fatigueSheet.findFirst({
    where: {
      driverName: row.driverName,
      weekStarting: prevWeekStarting,
    },
  });
  const days = parseDays(row.days);
  const prevWeekDays = prevSheet ? parseDays(prevSheet.days) : null;

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
    last24hBreak: row.last24hBreak ?? undefined,
    weekStarting: row.weekStarting,
    prevWeekStarting: prevSheet?.weekStarting ?? undefined,
    currentDayIndex,
    slotOffsetWithinToday,
  });

  return { results, jurisdictionCode };
}
