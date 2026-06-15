/**
 * Projected on-duty windows from driver run plans / manual km·hours for the manager shift lane.
 */

import type { DayData, FatigueSheet } from "@/lib/api";
import { getDayWithCarriedOverCardInfo } from "@/lib/day-route-carry";
import { inferRouteCarryMode } from "@/lib/driver-route-defaults";
import {
  resolvePlannedOnDutyHours,
  sheetDayYmdFromIndex,
  type RunPlanFields,
} from "@/lib/route-plan";
import type { TimelineEvent } from "@/lib/manager-risk-shift-lane";
import { RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";
import { getRegulatoryTodayYmd } from "@/lib/weeks";

export type ShiftWorkProjectionSource = "run_plan" | "manual_hours" | "manual_km";

export type ShiftWorkProjection = {
  startMs: number;
  endMs: number;
  routeLabel: string | null;
  plannedHours: number;
  source: ShiftWorkProjectionSource;
  dayYmd: string;
};

function projectionSource(
  day: RunPlanFields & { start_kms?: number | null; end_kms?: number | null }
): ShiftWorkProjectionSource | null {
  const hrs = day.planned_on_duty_hours;
  if (hrs != null && !Number.isNaN(Number(hrs)) && Number(hrs) > 0) {
    return inferRouteCarryMode(day) === "run_plan" ? "run_plan" : "manual_hours";
  }
  const km = day.planned_distance_km;
  if (km != null && !Number.isNaN(Number(km)) && Number(km) > 0) {
    return inferRouteCarryMode(day) === "run_plan" ? "run_plan" : "manual_km";
  }
  const start = day.start_kms;
  const end = day.end_kms;
  if (
    start != null &&
    end != null &&
    !Number.isNaN(Number(start)) &&
    !Number.isNaN(Number(end)) &&
    Number(end) > Number(start)
  ) {
    return "manual_km";
  }
  if (inferRouteCarryMode(day) === "run_plan") return "run_plan";
  return null;
}

function loggedWorkMsForDay(
  events: TimelineEvent[],
  dayStartMs: number,
  dayEndMs: number,
  nowMs: number
): number {
  const sorted = [...events].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.type !== "work") continue;
    const start = new Date(ev.time).getTime();
    const next = sorted[i + 1];
    const naturalEnd = next ? new Date(next.time).getTime() : nowMs;
    const segStart = Math.max(dayStartMs, start);
    const segEnd = Math.min(dayEndMs, naturalEnd, nowMs);
    if (segEnd > segStart) total += segEnd - segStart;
  }
  return total;
}

function dayBoundsMs(weekStarting: string, dayIndex: number): { startMs: number; endMs: number; ymd: string } {
  const ymd = sheetDayYmdFromIndex(weekStarting, dayIndex);
  const startMs = new Date(`${ymd}T00:00:00`).getTime();
  return { startMs, endMs: startMs + 24 * 60 * 60 * 1000, ymd };
}

function sheetForDriver(
  sheets: FatigueSheet[],
  driverName: string,
  weekStarting: string
): FatigueSheet | undefined {
  return sheets.find((sheet) => {
    if (sheet.week_starting !== weekStarting) return false;
    const primary = (sheet.driver_name ?? "").trim();
    const second = (sheet.second_driver ?? "").trim();
    return primary === driverName || second === driverName;
  });
}

export function buildShiftWorkProjections(opts: {
  sheets: FatigueSheet[];
  driverName: string;
  weekStarting: string;
  windowStartMs: number;
  windowEndMs: number;
  nowMs: number;
  events: TimelineEvent[];
  todayYmd?: string;
}): ShiftWorkProjection[] {
  const { sheets, driverName, weekStarting, windowStartMs, windowEndMs, nowMs, events } = opts;
  const sheet = sheetForDriver(sheets, driverName, weekStarting);
  if (!sheet?.days?.length) return [];

  const todayYmd = opts.todayYmd ?? getRegulatoryTodayYmd(sheet.jurisdiction_code);
  const days = sheet.days as DayData[];
  const out: ShiftWorkProjection[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const { startMs: dayStartMs, endMs: dayEndMs, ymd } = dayBoundsMs(weekStarting, dayIndex);
    if (dayEndMs <= windowStartMs || dayStartMs >= windowEndMs) continue;
    if (dayEndMs <= nowMs) continue;

    const day = getDayWithCarriedOverCardInfo(days, dayIndex, weekStarting, todayYmd);
    const plannedHours = resolvePlannedOnDutyHours(day);
    const source = projectionSource(day);
    if (plannedHours == null || plannedHours <= 0 || !source) continue;

    const loggedWorkMs = loggedWorkMsForDay(events, dayStartMs, dayEndMs, nowMs);
    const remainingMs = Math.max(0, plannedHours * 60 * 60 * 1000 - loggedWorkMs);
    if (remainingMs <= 0) continue;

    const workStartMs = ymd === todayYmd ? Math.max(nowMs, dayStartMs) : dayStartMs;
    const workEndMs = workStartMs + remainingMs;

    const clipStart = Math.max(workStartMs, windowStartMs);
    const clipEnd = Math.min(workEndMs, windowEndMs);
    if (clipEnd <= clipStart) continue;

    out.push({
      startMs: clipStart,
      endMs: clipEnd,
      routeLabel: (day.route_label ?? "").trim() || null,
      plannedHours,
      source,
      dayYmd: ymd,
    });
  }

  return out;
}

export function projectedKindFromPlans(
  blockStartMs: number,
  projections: ShiftWorkProjection[]
): "work" | "non_work" {
  const blockEnd = blockStartMs + RISK_BLOCK_MINUTES * 60 * 1000;
  for (const plan of projections) {
    if (blockStartMs < plan.endMs && blockEnd > plan.startMs) return "work";
  }
  return "non_work";
}

export function projectionLabelForBlock(
  blockStartMs: number,
  projections: ShiftWorkProjection[]
): string | null {
  const blockEnd = blockStartMs + RISK_BLOCK_MINUTES * 60 * 1000;
  for (const plan of projections) {
    if (blockStartMs < plan.endMs && blockEnd > plan.startMs) {
      return plan.routeLabel ?? `~${plan.plannedHours}h planned`;
    }
  }
  return null;
}
