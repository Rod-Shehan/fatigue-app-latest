import { createHash } from "crypto";
import type { DayData } from "@/lib/api";
import type { ComplianceDayData } from "@/lib/compliance";
import { normalizeDayCoverageArrays } from "@/lib/coverage/derive-minute-coverage";
import { parseSheetDaysJson } from "@/lib/compliance-history";
import { stampAlertnessForCalendarDay } from "@/lib/alertness-for-block";
import { isDriverAlertnessLevel } from "@/lib/driver-alertness";
import { RISK_BLOCK_MINUTES, alignToBlockStartMs, findNowBlockStartMs } from "@/lib/manager-risk-timeline";
import { getPerthMidnightUtcMs, getSheetDayDateString } from "@/lib/weeks";

export type FrmsTimelinePayload = {
  schema_version: 1;
  driver_name: string;
  jurisdiction_code: string;
  driver_type: "solo" | "two_up";
  timezone: string;
  as_of_ms: number;
  horizon_from_ms: number;
  horizon_to_ms: number;
  week_starting: string;
  timeline_blocks: Array<{
    start_ms: number;
    is_work: boolean;
    is_rest: boolean;
    /** Loading/admin on BREAKS FROM DRIVING — TSI γ 1.2 (or 0.5 if light_duty). */
    is_other_work?: boolean;
    /** Explicit nap/sleep only. Awake Rest never sets this. */
    is_nap?: boolean;
    sub_type?: "awake_rest" | "nap" | "heavy_labor" | "light_duty";
    /** Driver self-report 1–5 from day card for this Perth calendar day. */
    alertness_level?: 1 | 2 | 3 | 4 | 5;
  }>;
  enrichment?: {
    weather_hourly?: Array<{ timestamp_ms: number; temp_c: number }>;
  };
};

type DayWithIntervals = ComplianceDayData & {
  intervals?: Array<{ startMs: number; type: string }>;
};

type BlockMinuteCounts = {
  work: number;
  otherWork: number;
  break: number;
  nonWork: number;
  nap: number;
};

function emptyCounts(): BlockMinuteCounts {
  return { work: 0, otherWork: 0, break: 0, nonWork: 0, nap: 0 };
}

function isWorkIntervalType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "work" || t === "driving";
}

function isOtherWorkIntervalType(type: string): boolean {
  return type.toLowerCase() === "other_work";
}

function isNapIntervalType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "nap" || t === "sleep";
}

function isRestIntervalType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "rest" || t === "break" || t === "non_work" || isNapIntervalType(t);
}

/** Merge explicit interval rows (when present on day JSON) into 15-minute block counts. */
function accumulateFromIntervals(
  counts: Map<number, BlockMinuteCounts>,
  intervals: Array<{ startMs: number; type: string }>
): void {
  const blockMs = RISK_BLOCK_MINUTES * 60 * 1000;
  for (const interval of intervals) {
    const start = alignToBlockStartMs(interval.startMs);
    const end = start + blockMs;
    const nap = isNapIntervalType(interval.type);
    const otherWork = isOtherWorkIntervalType(interval.type);
    const work = isWorkIntervalType(interval.type);
    const rest = isRestIntervalType(interval.type);
    for (let t = start; t < end; t += 60 * 1000) {
      const blockStart = alignToBlockStartMs(t);
      const bucket = counts.get(blockStart) ?? emptyCounts();
      if (nap) bucket.nap += 1;
      else if (otherWork) bucket.otherWork += 1;
      else if (work) bucket.work += 1;
      else if (rest) bucket.nonWork += 1;
      else bucket.nonWork += 1;
      counts.set(blockStart, bucket);
    }
  }
}

/** Flatten work_time / breaks / non_work minute grids into 15-minute buckets. */
function accumulateFromCoverageDay(
  counts: Map<number, BlockMinuteCounts>,
  weekStarting: string,
  dayIndex: number,
  day: ComplianceDayData
): void {
  const normalized = normalizeDayCoverageArrays(day);
  const dayStartMs = getPerthMidnightUtcMs(getSheetDayDateString(weekStarting, dayIndex));

  for (let minute = 0; minute < normalized.work_time.length; minute++) {
    const minuteMs = dayStartMs + minute * 60 * 1000;
    const blockStart = alignToBlockStartMs(minuteMs);
    const bucket = counts.get(blockStart) ?? emptyCounts();
    const driving = Boolean(normalized.work_time[minute]);
    const onBreaksRow = Boolean(normalized.breaks[minute]);
    const nonWork = Boolean(normalized.non_work[minute]);
    // other_work overlay: work_time + breaks (loading). Driving is work_time only.
    if (driving && onBreaksRow) bucket.otherWork += 1;
    else if (driving) bucket.work += 1;
    else if (onBreaksRow) bucket.break += 1;
    else if (nonWork) bucket.nonWork += 1;
    counts.set(blockStart, bucket);
  }
}

function blockFlags(counts: BlockMinuteCounts): {
  is_work: boolean;
  is_rest: boolean;
  is_other_work: boolean;
  is_nap: boolean;
  sub_type?: "awake_rest" | "nap" | "heavy_labor";
} {
  const { work, otherWork, break: brk, nonWork, nap } = counts;
  const restish = brk + nonWork + nap;
  const is_nap = nap > 0 && nap >= work && nap >= otherWork && nap >= brk && nap >= nonWork;
  const is_other_work =
    !is_nap && otherWork > 0 && otherWork >= work && otherWork >= restish;
  const is_work = !is_nap && !is_other_work && work > 0 && work >= restish;
  const is_rest = !is_work && !is_other_work && (is_nap || brk > 0 || nonWork > 0);
  const sub_type = is_nap ? "nap" : is_other_work ? "heavy_labor" : is_rest ? "awake_rest" : undefined;
  return { is_work, is_rest, is_other_work, is_nap, ...(sub_type ? { sub_type } : {}) };
}

export function buildFrmsTimelinePayload(input: {
  driverName: string;
  jurisdictionCode: string;
  driverType: string;
  weekStarting: string;
  weekMap: Map<string, { days: string }>;
  enrichment?: FrmsTimelinePayload["enrichment"];
}): FrmsTimelinePayload {
  const now = findNowBlockStartMs();
  const blockMs = RISK_BLOCK_MINUTES * 60 * 1000;

  const blockCounts = new Map<number, BlockMinuteCounts>();
  const alertnessByBlock = new Map<number, 1 | 2 | 3 | 4 | 5>();
  const sortedWeeks = Array.from(input.weekMap.keys()).sort();

  for (const weekKey of sortedWeeks) {
    const weekData = input.weekMap.get(weekKey);
    if (!weekData) continue;

    const days = parseSheetDaysJson(weekData.days);

    days.forEach((rawDay, dayIndex) => {
      const day = rawDay as DayWithIntervals & DayData;
      if (day.intervals?.length) {
        accumulateFromIntervals(blockCounts, day.intervals);
      }
      accumulateFromCoverageDay(blockCounts, weekKey, dayIndex, day);
      if (isDriverAlertnessLevel(day.alertness_level)) {
        stampAlertnessForCalendarDay(alertnessByBlock, weekKey, dayIndex, day.alertness_level);
      }
    });
  }

  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const horizon_from_ms = alignToBlockStartMs(now - fourteenDaysMs);
  const horizon_to_ms = alignToBlockStartMs(now + sevenDaysMs);

  const timeline_blocks: FrmsTimelinePayload["timeline_blocks"] = [];
  for (let t = horizon_from_ms; t <= horizon_to_ms; t += blockMs) {
    const start_ms = alignToBlockStartMs(t);
    const counts = blockCounts.get(start_ms);
    const alertness_level = alertnessByBlock.get(start_ms);
    if (!counts) {
      const elapsedUnlogged = start_ms <= now;
      timeline_blocks.push({
        start_ms,
        is_work: false,
        is_rest: elapsedUnlogged,
        is_other_work: false,
        is_nap: false,
        ...(elapsedUnlogged ? { sub_type: "awake_rest" as const } : {}),
        ...(alertness_level ? { alertness_level } : {}),
      });
      continue;
    }
    timeline_blocks.push({
      start_ms,
      ...blockFlags(counts),
      ...(alertness_level ? { alertness_level } : {}),
    });
  }

  return {
    schema_version: 1,
    driver_name: input.driverName,
    jurisdiction_code: input.jurisdictionCode,
    driver_type: input.driverType === "two_up" ? "two_up" : "solo",
    timezone: "Australia/Perth",
    as_of_ms: now,
    horizon_from_ms,
    horizon_to_ms,
    week_starting: input.weekStarting,
    timeline_blocks,
    enrichment: input.enrichment,
  };
}

export function hashFrmsPayload(payload: FrmsTimelinePayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
