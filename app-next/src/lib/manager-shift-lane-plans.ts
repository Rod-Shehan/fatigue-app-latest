/**
 * Projected duty segments from run plans / manual km·hours and break-due windows.
 */

import type { DayData, FatigueSheet } from "@/lib/api";
import { getDayWithCarriedOverCardInfo } from "@/lib/day-route-carry";
import {
  DEMO_BREAK_BLOCKS,
  DEMO_WORK_BLOCKS_PER_BREAK,
} from "@/lib/fatigue-risk-carry";
import { inferRouteCarryMode } from "@/lib/driver-route-defaults";
import type { ShiftLaneKind } from "@/lib/manager-risk-shift-lane";
import type { TimelineEvent } from "@/lib/manager-risk-shift-lane";
import { findNowBlockStartMs, RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";
import {
  findWorkWindowStartMs,
  getRestSlotsForBreakRange,
  getMinutesBeforeDueFromSlots,
  TOTAL_QUAL_BREAK_MIN,
  WORK_WINDOW_MIN,
} from "@/lib/five-hour-break-rule";
import {
  resolvePlannedOnDutyHours,
  sheetDayYmdFromIndex,
  type RunPlanFields,
} from "@/lib/route-plan";
import { getRegulatoryTodayYmd } from "@/lib/weeks";

const BLOCK_MS = RISK_BLOCK_MINUTES * 60 * 1000;
const BREAK_MS = TOTAL_QUAL_BREAK_MIN * 60 * 1000;
const WORK_MS = WORK_WINDOW_MIN * 60 * 1000;

export type ShiftWorkProjectionSource = "run_plan" | "manual_hours" | "manual_km";

export type ShiftDutySegment = {
  startMs: number;
  endMs: number;
  kind: Exclude<ShiftLaneKind, "idle">;
  generated: boolean;
  planLabel?: string | null;
};

export type BreakDueRange = {
  startMs: number;
  endMs: number;
};

/** @deprecated Use ShiftDutySegment[] from buildShiftDutySegments */
export type ShiftWorkProjection = ShiftDutySegment & {
  routeLabel: string | null;
  plannedHours: number;
  source: ShiftWorkProjectionSource;
  dayYmd: string;
};

export type ShiftLanePlanContext = {
  segments: ShiftDutySegment[];
  breakDue: BreakDueRange | null;
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

function workMsInWindowEndingAt(events: TimelineEvent[], endMs: number): number {
  const windowStart = findWorkWindowStartMs(events, endMs);
  if (windowStart == null) return 0;
  const sorted = [...events].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].type !== "work") continue;
    const start = new Date(sorted[i].time).getTime();
    const next = sorted[i + 1];
    const segEnd = next ? new Date(next.time).getTime() : endMs;
    const clipStart = Math.max(windowStart, start);
    const clipEnd = Math.min(endMs, segEnd);
    if (clipEnd > clipStart) total += clipEnd - clipStart;
  }
  return total;
}

export function getBreakDueRange(events: TimelineEvent[], nowMs: number): BreakDueRange | null {
  if (events.length === 0) return null;
  const sorted = [...events].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
  const last = sorted[sorted.length - 1];
  if (last.type !== "work") return null;

  const windowStartMs = findWorkWindowStartMs(sorted, nowMs);
  if (windowStartMs == null) return null;
  const slots = getRestSlotsForBreakRange(sorted, windowStartMs, nowMs);
  const minutesBeforeDue = getMinutesBeforeDueFromSlots(slots);
  if (minutesBeforeDue === 0) return null;

  const dueMs = windowStartMs + (WORK_WINDOW_MIN - minutesBeforeDue) * 60 * 1000;
  if (dueMs >= nowMs) return null;

  return { startMs: dueMs, endMs: nowMs };
}

/** Future duty with 5h work / 20 min break cycles through remaining planned work time. */
export function buildCycledWorkSegments(
  startMs: number,
  horizonEndMs: number,
  workBudgetMs: number,
  events: TimelineEvent[],
  nowMs: number,
  planLabel: string | null
): ShiftDutySegment[] {
  if (workBudgetMs <= 0 || startMs >= horizonEndMs) return [];

  const sorted = [...events].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
  const last = sorted[sorted.length - 1];
  const segments: ShiftDutySegment[] = [];
  let cursor = startMs;
  let workLeft = workBudgetMs;
  let workInWindowMs =
    last?.type === "work" ? workMsInWindowEndingAt(sorted, nowMs) : 0;

  if (last?.type === "break") {
    const breakStart = new Date(last.time).getTime();
    const breakCompleteAt = breakStart + BREAK_MS;
    if (cursor < breakCompleteAt) {
      const end = Math.min(breakCompleteAt, horizonEndMs);
      if (end > cursor) {
        segments.push({
          startMs: cursor,
          endMs: end,
          kind: "break",
          generated: true,
          planLabel,
        });
        cursor = end;
      }
    }
    workInWindowMs = 0;
  }

  while (workLeft > 0 && cursor < horizonEndMs) {
    const roomInWindow = Math.max(0, WORK_MS - workInWindowMs);
    const workChunk = Math.min(workLeft, roomInWindow, horizonEndMs - cursor);

    if (workChunk > 0) {
      segments.push({
        startMs: cursor,
        endMs: cursor + workChunk,
        kind: "work",
        generated: true,
        planLabel,
      });
      cursor += workChunk;
      workLeft -= workChunk;
      workInWindowMs += workChunk;
    }

    if (workLeft <= 0 || cursor >= horizonEndMs) break;

    if (workInWindowMs >= WORK_MS - 500) {
      const breakEnd = Math.min(cursor + BREAK_MS, horizonEndMs);
      if (breakEnd > cursor) {
        segments.push({
          startMs: cursor,
          endMs: breakEnd,
          kind: "break",
          generated: true,
          planLabel,
        });
        cursor = breakEnd;
      }
      workInWindowMs = 0;
      continue;
    }

    if (workChunk <= 0) break;
  }

  return segments;
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

export function buildShiftDutySegments(opts: {
  sheets: FatigueSheet[];
  driverName: string;
  weekStarting: string;
  windowStartMs: number;
  windowEndMs: number;
  nowMs: number;
  events: TimelineEvent[];
  todayYmd?: string;
}): ShiftDutySegment[] {
  const { sheets, driverName, weekStarting, windowStartMs, windowEndMs, nowMs, events } = opts;
  const sheet = sheetForDriver(sheets, driverName, weekStarting);
  if (!sheet?.days?.length) return [];

  const todayYmd = opts.todayYmd ?? getRegulatoryTodayYmd(sheet.jurisdiction_code);
  const days = sheet.days as DayData[];
  const nowBlock = findNowBlockStartMs(nowMs);
  const projectionStart = nowBlock + BLOCK_MS;
  const segments: ShiftDutySegment[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const { startMs: dayStartMs, endMs: dayEndMs, ymd } = dayBoundsMs(weekStarting, dayIndex);
    if (dayEndMs <= windowStartMs || dayStartMs >= windowEndMs) continue;
    if (dayEndMs <= projectionStart) continue;

    const day = getDayWithCarriedOverCardInfo(days, dayIndex, weekStarting, todayYmd);
    const plannedHours = resolvePlannedOnDutyHours(day);
    if (plannedHours == null || plannedHours <= 0 || !projectionSource(day)) continue;

    const loggedWorkMs = loggedWorkMsForDay(events, dayStartMs, dayEndMs, nowMs);
    const remainingMs = Math.max(0, plannedHours * 60 * 60 * 1000 - loggedWorkMs);
    if (remainingMs <= 0) continue;

    const workStartMs = ymd === todayYmd ? projectionStart : Math.max(projectionStart, dayStartMs);
    const horizonEnd = Math.min(windowEndMs, dayEndMs);
    const planLabel = (day.route_label ?? "").trim() || `~${plannedHours}h planned`;

    segments.push(
      ...buildCycledWorkSegments(
        workStartMs,
        horizonEnd,
        remainingMs,
        events,
        nowMs,
        planLabel
      )
    );
  }

  return segments;
}

/** @deprecated Use buildShiftDutySegments */
export function buildShiftWorkProjections(
  opts: Parameters<typeof buildShiftDutySegments>[0]
): ShiftWorkProjection[] {
  return buildShiftDutySegments(opts).map((seg) => ({
    ...seg,
    routeLabel: seg.planLabel ?? null,
    plannedHours: 0,
    source: "run_plan" as const,
    dayYmd: "",
  }));
}

export function buildShiftLanePlanContext(
  opts: Parameters<typeof buildShiftDutySegments>[0]
): ShiftLanePlanContext {
  return {
    segments: buildShiftDutySegments(opts),
    breakDue: getBreakDueRange(opts.events, opts.nowMs),
  };
}

export function sawtoothKindForBlockIndex(blockIndex: number): ShiftLaneKind {
  const cycle = DEMO_WORK_BLOCKS_PER_BREAK + DEMO_BREAK_BLOCKS;
  const pos = blockIndex % cycle;
  if (pos < DEMO_WORK_BLOCKS_PER_BREAK) return "work";
  return "break";
}

function overlapMs(
  blockStartMs: number,
  blockEndMs: number,
  segStart: number,
  segEnd: number
): number {
  const start = Math.max(blockStartMs, segStart);
  const end = Math.min(blockEndMs, segEnd);
  return Math.max(0, end - start);
}

export function dutyFromSegmentsForBlock(
  blockStartMs: number,
  segments: ShiftDutySegment[]
): { kind: ShiftLaneKind; planLabel?: string | null } {
  const blockEnd = blockStartMs + BLOCK_MS;
  let work = 0;
  let breakMs = 0;
  let nonWork = 0;
  let planLabel: string | null = null;

  for (const seg of segments) {
    const ms = overlapMs(blockStartMs, blockEnd, seg.startMs, seg.endMs);
    if (ms <= 0) continue;
    if (seg.planLabel) planLabel = seg.planLabel;
    if (seg.kind === "work") work += ms;
    else if (seg.kind === "break") breakMs += ms;
    else nonWork += ms;
  }

  if (work === 0 && breakMs === 0 && nonWork === 0) {
    return { kind: "non_work", planLabel };
  }
  if (work >= breakMs && work >= nonWork) return { kind: "work", planLabel };
  if (breakMs >= nonWork) return { kind: "break", planLabel };
  return { kind: "non_work", planLabel };
}

export function blockOverlapsBreakDue(
  blockStartMs: number,
  breakDue: BreakDueRange | null,
  nowMs: number
): boolean {
  if (!breakDue) return false;
  const blockEnd = blockStartMs + BLOCK_MS;
  if (blockStartMs >= nowMs) return false;
  return blockStartMs < breakDue.endMs && blockEnd > breakDue.startMs;
}
