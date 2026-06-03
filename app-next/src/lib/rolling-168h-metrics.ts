/**
 * Rolling 14-day / 168h work metrics on a minute timeline.
 * Shared by compliance (retrospective) and prospective risk projection.
 * Keep aligned with check168hWorkOnMinuteTimeline in compliance.ts.
 */

import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import type { ComplianceDayData } from "@/lib/compliance";

const NON_WORK_MINUTES_48H = 48 * 60;
const MINUTES_14D = 14 * 24 * 60;
export const MAX_WORK_MINUTES_14D = 168 * 60;
export const WARN_WORK_MINUTES_14D = 140 * 60;
export const MAX_WORK_HOURS_14D = 168;
export const WARN_WORK_HOURS_14D = 140;

function flatSlots(days: ComplianceDayData[], key: "non_work" | "work_time"): boolean[] {
  return days.flatMap((d) => (d[key] || Array(MINUTES_PER_DAY).fill(false)).slice(0, MINUTES_PER_DAY));
}

function workMinutesPrefix(work: boolean[]): number[] {
  const pref = new Array(work.length + 1);
  pref[0] = 0;
  for (let i = 0; i < work.length; i++) pref[i + 1] = pref[i] + (work[i] ? 1 : 0);
  return pref;
}

function minuteSegmentsBetween48hNoWorkResets(noWorkMinutes: boolean[]): Array<{ start: number; end: number }> {
  if (noWorkMinutes.length === 0) return [];
  const segments: Array<{ start: number; end: number }> = [];
  let segStart = 0;
  let run = 0;
  let runStart = 0;

  for (let i = 0; i <= noWorkMinutes.length; i++) {
    const isNoWork = i < noWorkMinutes.length && noWorkMinutes[i];
    if (isNoWork) {
      if (run === 0) runStart = i;
      run += 1;
      continue;
    }
    if (run >= NON_WORK_MINUTES_48H && segStart < runStart) {
      segments.push({ start: segStart, end: runStart });
      segStart = i;
    }
    run = 0;
  }

  if (segStart < noWorkMinutes.length) {
    segments.push({ start: segStart, end: noWorkMinutes.length });
  }
  return segments;
}

function maxRollingWorkMinutesInSegment(work: boolean[]): number {
  if (work.length === 0) return 0;
  if (work.length < MINUTES_14D) {
    return work.filter(Boolean).length;
  }
  const pref = workMinutesPrefix(work);
  let max = 0;
  for (let start = 0; start <= work.length - MINUTES_14D; start++) {
    const w = pref[start + MINUTES_14D] - pref[start];
    if (w > max) max = w;
  }
  return max;
}

export type Rolling168hMetrics = {
  maxRollingWorkHours: number;
  headroomHours: number;
  inWarningBand: boolean;
  wouldExceed168: boolean;
};

export function computeRolling168hMetricsFromDays(days: ComplianceDayData[]): Rolling168hMetrics {
  const work = flatSlots(days, "work_time");
  const noWork = flatSlots(days, "non_work");
  return computeRolling168hMetrics(work, noWork);
}

export function computeRolling168hMetrics(work: boolean[], noWork: boolean[]): Rolling168hMetrics {
  if (work.length === 0) {
    return {
      maxRollingWorkHours: 0,
      headroomHours: MAX_WORK_HOURS_14D,
      inWarningBand: false,
      wouldExceed168: false,
    };
  }
  const segments = minuteSegmentsBetween48hNoWorkResets(noWork);
  let maxWorkMinutes = 0;
  for (const { start, end } of segments) {
    const max = maxRollingWorkMinutesInSegment(work.slice(start, end));
    if (max > maxWorkMinutes) maxWorkMinutes = max;
  }
  const maxRollingWorkHours = Math.round((maxWorkMinutes / 60) * 10) / 10;
  return {
    maxRollingWorkHours,
    headroomHours: Math.max(0, Math.round((MAX_WORK_HOURS_14D - maxRollingWorkHours) * 10) / 10),
    inWarningBand: maxWorkMinutes > WARN_WORK_MINUTES_14D && maxWorkMinutes <= MAX_WORK_MINUTES_14D,
    wouldExceed168: maxWorkMinutes > MAX_WORK_MINUTES_14D,
  };
}

/** Inject planned on-duty hours from minute 0 (future-day simplification). */
export function dayWithInjectedWorkHours(
  day: ComplianceDayData,
  hours: number
): ComplianceDayData {
  const mins = Math.min(MINUTES_PER_DAY, Math.max(0, Math.round(hours * 60)));
  const work_time = Array(MINUTES_PER_DAY).fill(false);
  for (let i = 0; i < mins; i++) work_time[i] = true;
  const non_work = work_time.map((w) => !w);
  return {
    ...day,
    work_time,
    non_work,
    breaks: Array(MINUTES_PER_DAY).fill(false),
  };
}
