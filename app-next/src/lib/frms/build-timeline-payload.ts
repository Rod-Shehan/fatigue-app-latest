import { createHash } from "crypto";
import type { ComplianceDayData } from "@/lib/compliance";
import { normalizeDayCoverageArrays } from "@/lib/coverage/derive-minute-coverage";
import { parseSheetDaysJson } from "@/lib/compliance-history";
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
  break: number;
  nonWork: number;
};

function isWorkIntervalType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "work" || t === "driving";
}

function isRestIntervalType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "rest" || t === "sleep" || t === "break" || t === "non_work";
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
    const work = isWorkIntervalType(interval.type);
    const rest = isRestIntervalType(interval.type);
    for (let t = start; t < end; t += 60 * 1000) {
      const blockStart = alignToBlockStartMs(t);
      const bucket = counts.get(blockStart) ?? { work: 0, break: 0, nonWork: 0 };
      if (work) bucket.work += 1;
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
    const bucket = counts.get(blockStart) ?? { work: 0, break: 0, nonWork: 0 };
    if (normalized.work_time[minute]) bucket.work += 1;
    else if (normalized.breaks[minute]) bucket.break += 1;
    else if (normalized.non_work[minute]) bucket.nonWork += 1;
    counts.set(blockStart, bucket);
  }
}

function blockFlags(counts: BlockMinuteCounts): { is_work: boolean; is_rest: boolean } {
  const { work, break: brk, nonWork } = counts;
  const is_work = work > 0 && work >= brk && work >= nonWork;
  const is_rest = !is_work && (brk > 0 || nonWork > 0);
  return { is_work, is_rest };
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
  const sortedWeeks = Array.from(input.weekMap.keys()).sort();

  for (const weekKey of sortedWeeks) {
    const weekData = input.weekMap.get(weekKey);
    if (!weekData) continue;

    const days = parseSheetDaysJson(weekData.days);

    days.forEach((rawDay, dayIndex) => {
      const day = rawDay as DayWithIntervals;
      if (day.intervals?.length) {
        accumulateFromIntervals(blockCounts, day.intervals);
      }
      accumulateFromCoverageDay(blockCounts, weekKey, dayIndex, day);
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
    if (!counts) {
      timeline_blocks.push({ start_ms, is_work: false, is_rest: false });
      continue;
    }
    timeline_blocks.push({ start_ms, ...blockFlags(counts) });
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
