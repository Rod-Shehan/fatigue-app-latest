/**
 * Attribute Autonomise camera events to a driver using attested sheet duty only.
 * VRN on day card + work minutes in the 15-min block at triggerTime.
 * Fails closed when zero or multiple drivers match.
 */

import type { PrismaClient } from "@prisma/client";
import type { DayData } from "@/lib/api";
import { ymdFromBlockStartMs } from "@/lib/alertness-for-block";
import { parseSheetDaysJson } from "@/lib/compliance-history";
import type { ComplianceDayData } from "@/lib/compliance";
import { normalizeDayCoverageArrays } from "@/lib/coverage/derive-minute-coverage";
import { alignToBlockStartMs, RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";
import { regoKey } from "@/lib/rego-kms-validation";

function autonomiseRegoKey(rego: string): string {
  return regoKey(rego).replace(/\s+/g, "");
}
import { getPerthMidnightUtcMs, getPreviousWeekSunday, getSheetDayDateString } from "@/lib/weeks";

export type SheetDutyAttributionResult =
  | { ok: true; driverName: string; blockStartMs: number; weekStarting: string; dayIndex: number }
  | { ok: false; reason: "no_rego" | "no_trigger" | "no_sheet_match" | "not_on_duty" | "ambiguous_drivers" };

function weekSundayForYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());
  const yy = sunday.getFullYear();
  const mm = String(sunday.getMonth() + 1).padStart(2, "0");
  const dd = String(sunday.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function dayIndexForBlock(weekStarting: string, blockStartMs: number): number {
  const ymd = ymdFromBlockStartMs(blockStartMs);
  for (let i = 0; i < 7; i++) {
    if (getSheetDayDateString(weekStarting, i) === ymd) return i;
  }
  return -1;
}

/** Work minutes in a 15-min block from day-card minute grids (read-only). */
export function workMinutesInBlock(
  weekStarting: string,
  dayIndex: number,
  day: ComplianceDayData,
  blockStartMs: number
): number {
  if (dayIndex < 0) return 0;
  const normalized = normalizeDayCoverageArrays(day);
  const dayStartMs = getPerthMidnightUtcMs(getSheetDayDateString(weekStarting, dayIndex));
  const blockEndMs = blockStartMs + RISK_BLOCK_MINUTES * 60 * 1000;
  let work = 0;
  for (let minute = 0; minute < normalized.work_time.length; minute++) {
    const minuteMs = dayStartMs + minute * 60 * 1000;
    if (minuteMs >= blockStartMs && minuteMs < blockEndMs && normalized.work_time[minute]) {
      work += 1;
    }
  }
  return work;
}

function regoOnDayMatches(day: DayData | undefined, vehicleRego: string): boolean {
  if (!day) return false;
  const onCard = (day.truck_rego ?? "").trim();
  if (!onCard) return false;
  return autonomiseRegoKey(onCard) === autonomiseRegoKey(vehicleRego);
}

export function resolveDriverFromSheetDutyLocal(args: {
  vehicleRego: string;
  blockStartMs: number;
  sheets: Array<{ driverName: string; weekStarting: string; days: DayData[] }>;
}): SheetDutyAttributionResult {
  const vehicleRego = args.vehicleRego.trim();
  if (!vehicleRego) return { ok: false, reason: "no_rego" };

  const blockStartMs = alignToBlockStartMs(args.blockStartMs);
  const candidates = new Set<string>();
  let sawRegoOnSheet = false;

  for (const sheet of args.sheets) {
    const dayIndex = dayIndexForBlock(sheet.weekStarting, blockStartMs);
    if (dayIndex < 0) continue;
    const day = sheet.days[dayIndex];
    if (!regoOnDayMatches(day, vehicleRego)) continue;
    sawRegoOnSheet = true;
    const work = workMinutesInBlock(sheet.weekStarting, dayIndex, day ?? {}, blockStartMs);
    if (work <= 0) continue;
    candidates.add(sheet.driverName.trim());
  }

  if (candidates.size === 0) {
    return { ok: false, reason: sawRegoOnSheet ? "not_on_duty" : "no_sheet_match" };
  }
  if (candidates.size > 1) return { ok: false, reason: "ambiguous_drivers" };

  const driverName = [...candidates][0]!;
  const matchedSheet = args.sheets.find((s) => {
    const dayIndex = dayIndexForBlock(s.weekStarting, blockStartMs);
    if (dayIndex < 0) return false;
    return (
      s.driverName.trim() === driverName &&
      regoOnDayMatches(s.days[dayIndex], vehicleRego) &&
      workMinutesInBlock(s.weekStarting, dayIndex, s.days[dayIndex] ?? {}, blockStartMs) > 0
    );
  });

  return {
    ok: true,
    driverName,
    blockStartMs,
    weekStarting: matchedSheet?.weekStarting ?? weekSundayForYmd(ymdFromBlockStartMs(blockStartMs)),
    dayIndex: matchedSheet ? dayIndexForBlock(matchedSheet.weekStarting, blockStartMs) : 0,
  };
}

export async function resolveDriverFromSheetDuty(
  prisma: PrismaClient,
  args: { vehicleRego: string | null | undefined; triggerTimeMs: number }
): Promise<SheetDutyAttributionResult> {
  const vehicleRego = (args.vehicleRego ?? "").trim();
  if (!vehicleRego) return { ok: false, reason: "no_rego" };
  if (!Number.isFinite(args.triggerTimeMs)) return { ok: false, reason: "no_trigger" };

  const blockStartMs = alignToBlockStartMs(args.triggerTimeMs);
  const ymd = ymdFromBlockStartMs(blockStartMs);
  const weekSun = weekSundayForYmd(ymd);
  const prevWeek = getPreviousWeekSunday(weekSun);
  const weekKeys = [prevWeek, weekSun];

  const rows = await prisma.fatigueSheet.findMany({
    where: { weekStarting: { in: weekKeys } },
    select: { driverName: true, weekStarting: true, days: true },
  });

  const sheets = rows.map((r) => ({
    driverName: r.driverName,
    weekStarting: r.weekStarting,
    days: parseSheetDaysJson(r.days) as DayData[],
  }));

  return resolveDriverFromSheetDutyLocal({ vehicleRego, blockStartMs, sheets });
}
