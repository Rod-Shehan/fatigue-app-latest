/**
 * Map driver self-reported alertness (day card, levels 1–5) to 15-minute risk blocks.
 */

import type { PrismaClient } from "@prisma/client";
import type { DayData } from "@/lib/api";
import { parseSheetDaysJson } from "@/lib/compliance-history";
import { isDriverAlertnessLevel, type DriverAlertnessLevel } from "@/lib/driver-alertness";
import { alignToBlockStartMs, RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";
import { getPerthMidnightUtcMs, getSheetDayDateString, getTodayYmdInTimeZone } from "@/lib/weeks";

const DEFAULT_BLOCK_TZ = "Australia/Perth";

export function ymdFromBlockStartMs(blockStartMs: number, timeZone = DEFAULT_BLOCK_TZ): string {
  return getTodayYmdInTimeZone(timeZone, new Date(blockStartMs));
}

export function findAlertnessLevelForSheetDay(
  weekStarting: string,
  days: DayData[],
  blockStartMs: number,
  timeZone = DEFAULT_BLOCK_TZ
): DriverAlertnessLevel | undefined {
  const ymd = ymdFromBlockStartMs(blockStartMs, timeZone);
  for (let dayIndex = 0; dayIndex < Math.min(7, days.length); dayIndex++) {
    if (getSheetDayDateString(weekStarting, dayIndex) !== ymd) continue;
    const level = days[dayIndex]?.alertness_level;
    return isDriverAlertnessLevel(level) ? level : undefined;
  }
  return undefined;
}

/** Stamp all 15-min block starts on a Perth calendar day with the day's alertness level. */
export function stampAlertnessForCalendarDay(
  map: Map<number, DriverAlertnessLevel>,
  weekStarting: string,
  dayIndex: number,
  level: DriverAlertnessLevel
): void {
  const blockMs = RISK_BLOCK_MINUTES * 60 * 1000;
  const dayStartMs = getPerthMidnightUtcMs(getSheetDayDateString(weekStarting, dayIndex));
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  for (let t = alignToBlockStartMs(dayStartMs); t < dayEndMs; t += blockMs) {
    map.set(t, level);
  }
}

export async function lookupAlertnessFromDriverSheets(
  prisma: PrismaClient,
  driverName: string,
  blockStartMs: number
): Promise<DriverAlertnessLevel | undefined> {
  const rows = await prisma.fatigueSheet.findMany({
    where: { driverName },
    select: { weekStarting: true, days: true },
  });
  for (const row of rows) {
    const days = parseSheetDaysJson(row.days) as DayData[];
    const level = findAlertnessLevelForSheetDay(row.weekStarting, days, blockStartMs);
    if (level) return level;
  }
  return undefined;
}
