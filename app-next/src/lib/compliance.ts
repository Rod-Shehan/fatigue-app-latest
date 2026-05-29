/**
 * WA OSH Reg 3.132 compliance logic (pure, testable).
 * Used by CompliancePanel for display.
 *
 * Multi-jurisdiction / Australia-wide direction: see docs/adr/0001-multi-jurisdiction-fatigue-architecture.md
 * and src/lib/jurisdiction/. Do not claim NHVR EWD approval from this module alone.
 */

import { getSheetDayDateString, getPerthMidnightUtcMs, getTodayYmdInTimeZone } from "@/lib/weeks";
import { haversineDistanceKm } from "@/lib/geo";
import {
  MINUTES_PER_DAY,
  normalizeCoverageFieldToMinutes,
  normalizeDayCoverageArrays,
} from "@/lib/coverage/derive-minute-coverage";
import { qualifyingRestMetForWorkAfterBreak } from "@/lib/five-hour-break-rule";
import { getEventsForDriverInOrder, getEventsInTimeOrder } from "@/lib/rolling-events";
import {
  SHIFT_CHANGE_EDUCATION_MESSAGE,
  SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS,
  SHIFT_CHANGE_MIN_GAP_HOURS,
  formatShiftChangeMissingTimesMessage,
  formatShiftChangeViolationMessage,
  type ShiftChangeGapDetail,
  type ShiftLabel,
} from "@/lib/shift-change";

export type ComplianceDayData = {
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  events?: { time: string; type: string; lat?: number; lng?: number; accuracy?: number }[];
  start_kms?: number | null;
  end_kms?: number | null;
  /** Optional label used only for shift-change 24h rule: "A" | "B". */
  shift_label?: "A" | "B" | "" | null;
};

export type ComplianceCheckResult = {
  type: "violation" | "warning" | "info";
  iconKey: "Coffee" | "AlertTriangle" | "Moon" | "Clock" | "TrendingUp" | "CheckCircle2" | "MapPin";
  day: string;
  message: string;
  /** Stable id for UI (scroll, education). */
  ruleId?: "shift_change_24h" | "shift_change_education" | "location_evidence" | "odometer_gps_plausibility";
  /** Current-week day index (0–6) to scroll to when the driver taps “View day”. */
  scrollDayIndex?: number;
  shiftChange?: ShiftChangeGapDetail;
};

/** Hours from coverage: always via minute grid (48-slot legacy expanded to 1440 first). */
export function getHours(slots: boolean[] | undefined): number {
  const mins = normalizeCoverageFieldToMinutes(slots);
  return mins.filter(Boolean).length / 60;
}

/** Day is considered to have work if it has work_time slots or any work event (used for 7h/17h rule scope). */
function dayHasWork(day: ComplianceDayData): boolean {
  if (getHours(day.work_time) > 0) return true;
  return (day.events?.some((e) => e.type === "work") ?? false);
}

export function findLongestContinuousBlock(slots: boolean[] | undefined): number {
  const arr = (() => {
    if (!slots || slots.length === 0) return Array(MINUTES_PER_DAY).fill(false);
    // Legacy: one-day half-hour slots.
    if (slots.length === 48) return normalizeCoverageFieldToMinutes(slots);
    // Single day: pad/truncate to 1440.
    if (slots.length <= MINUTES_PER_DAY) return normalizeCoverageFieldToMinutes(slots);
    // Multi-day minute grid already flattened: do NOT truncate.
    return slots.slice();
  })();
  let max = 0,
    current = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max / 60;
}

export function countContinuousBlocksOfAtLeast(slots: boolean[] | undefined, minHours: number): number {
  const arr = (() => {
    if (!slots || slots.length === 0) return Array(MINUTES_PER_DAY).fill(false);
    // Legacy: one-day half-hour slots.
    if (slots.length === 48) return normalizeCoverageFieldToMinutes(slots);
    // Single day: pad/truncate to 1440.
    if (slots.length <= MINUTES_PER_DAY) return normalizeCoverageFieldToMinutes(slots);
    // Multi-day minute grid already flattened: do NOT truncate.
    return slots.slice();
  })();
  const minSlots = minHours * 60;
  let count = 0,
    current = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      current++;
    } else {
      if (current >= minSlots) count++;
      current = 0;
    }
  }
  if (current >= minSlots) count++;
  return count;
}

/** 48h continuous no-work in minutes (rolling). */
const NON_WORK_MINUTES_48H = 48 * 60;
/** 24h continuous no-work in minutes (rolling). */
const NON_WORK_MINUTES_24H = 24 * 60;

/**
 * Continuous "no work" slots spanning the boundary between two consecutive days (end of dayA + start of dayB).
 * No work = work_time is false (recorded non-work, break, or no entry all count the same; rule is rolling).
 */
function continuousNoWorkAcrossBoundary(dayA: ComplianceDayData, dayB: ComplianceDayData): number {
  const a = dayA.work_time || Array(MINUTES_PER_DAY).fill(false);
  const b = dayB.work_time || Array(MINUTES_PER_DAY).fill(false);
  const len = Math.min(a.length, MINUTES_PER_DAY);
  let slots = 0;
  for (let s = len - 1; s >= 0 && !a[s]; s--) slots++;
  for (let s = 0; s < len && !b[s]; s++) slots++;
  return slots;
}

/**
 * Split 14 days into segments separated by ≥48h continuous no-work (non-work or no work record; rolling).
 * Returns an array of segments; each segment is an array of day indices (0..13).
 */
function segmentsSplitBy48hNonWork(all14Days: ComplianceDayData[]): number[][] {
  if (all14Days.length === 0) return [];
  if (all14Days.length === 1) return [[0]];
  const segments: number[][] = [];
  let start = 0;
  for (let i = 0; i < all14Days.length - 1; i++) {
    const across = continuousNoWorkAcrossBoundary(all14Days[i], all14Days[i + 1]);
    if (across >= NON_WORK_MINUTES_48H) {
      segments.push(Array.from({ length: i - start + 1 }, (_, j) => start + j));
      start = i + 1;
    }
  }
  segments.push(Array.from({ length: all14Days.length - start }, (_, j) => start + j));
  return segments;
}

/**
 * Date for a day in extendedDays: first prevCount days are from prev week (Fri,Sat), then this week Sun..Sat.
 */
function getExtendedDayDate(
  dayIndex: number,
  weekStarting: string,
  prevWeekStarting: string,
  prevCount: number
): string {
  if (dayIndex < prevCount) return getSheetDayDateString(prevWeekStarting, 5 + dayIndex);
  return getSheetDayDateString(weekStarting, dayIndex - prevCount);
}

/**
 * Split days into segments separated by ≥24h continuous no-work (non-work or no work record; rolling).
 * Same rule as "last 24 hour break" input: declared date, or any ≥24h with no work / non-work.
 * When last24hBreak (YYYY-MM-DD) is set, any boundary touching that date is also treated as a 24h break (resets rules).
 */
function segmentsSplitBy24hNonWork(
  days: ComplianceDayData[],
  options?: { weekStarting?: string; prevWeekStarting?: string; prevCount?: number; last24hBreak?: string }
): number[][] {
  if (days.length === 0) return [];
  if (days.length === 1) return [[0]];
  const { weekStarting = "", prevWeekStarting = "", prevCount = 0, last24hBreak } = options ?? {};
  const segments: number[][] = [];
  let start = 0;
  for (let i = 0; i < days.length - 1; i++) {
    const across = continuousNoWorkAcrossBoundary(days[i], days[i + 1]);
    const isDeclaredBreak =
      last24hBreak &&
      weekStarting &&
      (getExtendedDayDate(i, weekStarting, prevWeekStarting, prevCount) === last24hBreak ||
        getExtendedDayDate(i + 1, weekStarting, prevWeekStarting, prevCount) === last24hBreak);
    if (across >= NON_WORK_MINUTES_24H || isDeclaredBreak) {
      segments.push(Array.from({ length: i - start + 1 }, (_, j) => start + j));
      start = i + 1;
    }
  }
  segments.push(Array.from({ length: days.length - start }, (_, j) => start + j));
  return segments;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MINUTES_24H = 24 * 60;
const MINUTES_48H = 48 * 60;
const MINUTES_72H = 72 * 60;
const MIN_NON_WORK_HRS_24H = 7;
const MIN_NON_WORK_MINUTES_24H = MIN_NON_WORK_HRS_24H * 60;
const MIN_RECORDED_HRS_24H = 16;
const MIN_7H_BLOCK_MINUTES = 7 * 60;
const MIN_24H_BLOCK_MINUTES = 24 * 60;

/**
 * Flat minute arrays across days for rolling window checks.
 * Call only with days already passed through `normalizeDayCoverageArrays` (as in `runComplianceChecks`).
 */
function flatSlots(days: ComplianceDayData[], key: "non_work" | "work_time" | "breaks"): boolean[] {
  return days.flatMap((d) => (d[key] || Array(MINUTES_PER_DAY).fill(false)).slice(0, MINUTES_PER_DAY));
}

function fiveHourBreakViolationMessage(): string {
  return "20 min rest per 5h work not met (2×10 min or 1×20 min)";
}

function checkBreakFromDriving(days: ComplianceDayData[], results: ComplianceCheckResult[]) {
  // Rolling-time evaluation: flatten all events across days (midnight is not a boundary).
  // Days are used only for attribution/labels.
  const ordered = getEventsInTimeOrder(days);
  if (ordered.length < 2) {
    // Coverage-only fallback: if we have no meaningful event timeline, still warn in the
    // simplest "5h work with no breaks recorded" case so users aren’t misled by silence.
    days.forEach((day, idx) => {
      const dayLabel = DAY_LABELS[idx] ?? `D${idx + 1}`;
      const workHrs = getHours(day.work_time);
      const breakHrs = getHours(day.breaks);
      if (workHrs >= 5 && breakHrs === 0) {
        results.push({
          type: "warning",
          iconKey: "Coffee",
          day: dayLabel,
          message: "20 min rest per 5h work (2×10 min or 1×20 min)",
        });
      }
    });
    return;
  }

  // Mirror LogBar logic: evaluate rest when returning to work after a break run,
  // and emit at most one violation per "block" until a valid break occurs or stop resets the block.
  let workMinsSinceValidBreak = 0;
  let breakSegments: number[] = [];
  let violationEmittedForCurrentBlock = false;

  for (let i = 0; i < ordered.length - 1; i++) {
    const ev = ordered[i];
    const next = ordered[i + 1];
    const segStart = new Date(ev.time).getTime();
    const segEnd = new Date(next.time).getTime();
    const dur = Math.max(0, Math.floor((segEnd - segStart) / 60000));
    if (dur === 0) continue;

    if (ev.type === "work") {
      // If a break run just ended and we’re moving into work, decide if that run qualified.
      if (breakSegments.length > 0) {
        const slice = ordered
          .slice(0, i)
          .map(({ time, type }) => ({ time, type }));
        const valid = qualifyingRestMetForWorkAfterBreak(slice, breakSegments);
        if (!valid && !violationEmittedForCurrentBlock) {
          const dayLabel = DAY_LABELS[ev.dayIndex] ?? `D${ev.dayIndex + 1}`;
          results.push({
            type: "violation",
            iconKey: "Coffee",
            day: dayLabel,
            message: fiveHourBreakViolationMessage(),
          });
          violationEmittedForCurrentBlock = true;
        }
        if (valid) {
          workMinsSinceValidBreak = 0;
          violationEmittedForCurrentBlock = false;
        }
        breakSegments = [];
      }

      workMinsSinceValidBreak += dur;
      if (workMinsSinceValidBreak > 5 * 60 && !violationEmittedForCurrentBlock) {
        const dayLabel = DAY_LABELS[ev.dayIndex] ?? `D${ev.dayIndex + 1}`;
        results.push({
          type: "violation",
          iconKey: "AlertTriangle",
          day: dayLabel,
          message: "More than 5h work without valid break",
        });
        violationEmittedForCurrentBlock = true;
      }
      continue;
    }

    if (ev.type === "break") {
      breakSegments.push(dur);
      continue;
    }

    // stop/non_work/etc: reset the rolling work/break block.
    breakSegments = [];
    workMinsSinceValidBreak = 0;
    violationEmittedForCurrentBlock = false;
  }
}

const MINUTES_17H_WORK_BREAK = 17 * 60;
const MINUTES_7H_NON_WORK = 7 * 60;

function checkSoloRules(
  days: ComplianceDayData[],
  results: ComplianceCheckResult[],
  prevCount: number,
  soloOptions?: {
    weekStarting?: string;
    prevWeekStarting?: string;
    last24hBreak?: string;
    /** Current day index in the current week (0–6). When set with slotOffsetWithinToday, 72h rule is retrospective from now. */
    currentDayIndex?: number;
    /** Minutes elapsed since regulatory midnight today (0–1440); 72h window ends at "now". */
    slotOffsetWithinToday?: number;
    /** Optional preceding history days (chronological) to allow 28-day checks. */
    historyDays?: ComplianceDayData[] | null;
  }
) {
  const hasAnyWork = days.some(dayHasWork);
  if (!hasAnyWork) return;

  const segments24 = segmentsSplitBy24hNonWork(days, {
    weekStarting: soloOptions?.weekStarting,
    prevWeekStarting: soloOptions?.prevWeekStarting,
    prevCount,
    last24hBreak: soloOptions?.last24hBreak,
  });
  const getDayLabel = (dayIdx: number) => {
    const ci = dayIdx - prevCount;
    return ci < 0 ? `prev+${dayIdx + 1}` : DAY_LABELS[ci] ?? `D${dayIdx + 1}`;
  };

  /*
   * Reg 184E(2)(a): within any 72h period there must be ≥3 periods of ≥7h consecutive non-work,
   * and each period must be separated from the next by not more than 17h.
   *
   * We evaluate the "≤17h between ≥7h non-work periods" as an elapsed-time separation where
   * any minute that is NOT non_work counts toward the separation (not just work+break minutes).
   * Segments split by ≥24h non-work (or declared last24hBreak) act as resets for the 17h/72h checks.
   */
  for (const segment of segments24) {
    const segmentDays = segment.map((i) => days[i]);
    const nonWork = flatSlots(segmentDays, "non_work");
    let separationRun = 0; // minutes since end of last qualifying ≥7h non-work period
    let nonWorkRun = 0; // minutes in current non-work run
    let lastNonWorkQualified = false;
    for (let s = 0; s < nonWork.length; s++) {
      const dayIndexInSegment = Math.min(Math.floor(s / MINUTES_PER_DAY), segmentDays.length - 1);
      const segmentDayHasWork = dayHasWork(segmentDays[dayIndexInSegment] ?? {});
      if (!segmentDayHasWork) {
        separationRun = 0;
        nonWorkRun = 0;
        lastNonWorkQualified = false;
        continue;
      }
      if (nonWork[s]) {
        nonWorkRun++;
        // Once we reach a qualifying ≥7h in this run, it "anchors" the separation.
        if (nonWorkRun >= MINUTES_7H_NON_WORK) {
          if (lastNonWorkQualified) {
            // We have now found the "next" qualifying period; reset separation counter.
            separationRun = 0;
          }
          lastNonWorkQualified = true;
        }
      } else {
        // Not non-work: counts toward the 17h separation window once a qualifying non-work period exists.
        if (lastNonWorkQualified) separationRun++;
        nonWorkRun = 0;
        if (separationRun > MINUTES_17H_WORK_BREAK) {
          const dayIdx = segment[dayIndexInSegment];
          const violationDayDate = getExtendedDayDate(
            dayIdx,
            soloOptions?.weekStarting ?? "",
            soloOptions?.prevWeekStarting ?? "",
            prevCount
          );
          if (soloOptions?.last24hBreak && violationDayDate === soloOptions.last24hBreak) {
            separationRun = 0;
            continue;
          }
          results.push({
            type: "violation",
            iconKey: "Clock",
            day: getDayLabel(dayIdx),
            message: "Two ≥7h non-work periods cannot be separated by more than 17h (elapsed time)",
          });
          break;
        }
      }
    }
  }

  /*
   * 72-hour rule (Solo): rolling 72h must have ≥27h non-work and ≥3 blocks of ≥7h non-work.
   * Rule is retrospective from NOW only; it resets after any ≥24h non-work (driver or system).
   * We only evaluate the single 72h window ending at "now" for the segment that contains today.
   * Past segments are skipped so we never warn on historical windows.
   */
  const weekStarting = soloOptions?.weekStarting ?? "";
  const prevWeekStarting = soloOptions?.prevWeekStarting ?? "";
  const currentDayIndex = soloOptions?.currentDayIndex;
  const slotOffsetWithinToday = soloOptions?.slotOffsetWithinToday;
  const todayExtended =
    currentDayIndex != null && currentDayIndex >= 0 && currentDayIndex <= 6 && slotOffsetWithinToday != null
      ? prevCount + currentDayIndex
      : null;

  for (const segment of segments24) {
    const segmentContainsToday = todayExtended != null && segment.includes(todayExtended);
    if (!segmentContainsToday) continue;

    const segmentDays = segment.map((i) => days[i]);
    const nonWork = flatSlots(segmentDays, "non_work");
    const work = flatSlots(segmentDays, "work_time");
    const breaks = flatSlots(segmentDays, "breaks");
    const getLabelSlot = (minuteIndex: number) =>
      getDayLabel(segment[Math.min(Math.floor(minuteIndex / MINUTES_PER_DAY), segment.length - 1)]);

    const daysBeforeToday = segment.filter((i) => i < todayExtended!).length;
    const effectiveEndMinute =
      daysBeforeToday * MINUTES_PER_DAY +
      Math.min(MINUTES_PER_DAY, Math.max(0, slotOffsetWithinToday ?? MINUTES_PER_DAY));

    if (effectiveEndMinute < MINUTES_72H) continue;
    const start = effectiveEndMinute - MINUTES_72H;
    const window = nonWork.slice(start, effectiveEndMinute);
    const totalNonWork = window.filter(Boolean).length / 60;
    const sevenHrBlocks = countContinuousBlocksOfAtLeast(window, 7);
    const hasData = window.some((_, i) => work[start + i] || breaks[start + i]);
    if (!hasData) continue;

    const windowEndSuffix = " — 72h window ending now";
    if (totalNonWork < 27) {
      results.push({
        type: "warning",
        iconKey: "TrendingUp",
        day: getLabelSlot(effectiveEndMinute - 1),
        message: `Need ≥27 hrs non-work in any rolling 72hr period (24h non-work resets; this window: ${totalNonWork}h)${windowEndSuffix}`,
      });
    } else if (sevenHrBlocks < 3) {
      results.push({
        type: "warning",
        iconKey: "Moon",
        day: getLabelSlot(effectiveEndMinute - 1),
        message: `Need ≥3 blocks of ≥7 continuous hrs non-work in any rolling 72hrs (24h non-work resets; found: ${sevenHrBlocks})${windowEndSuffix}`,
      });
    }
  }

  /*
   * Reg 184E(2)(b): either
   * (i) in any 14-day period — at least 2 periods of 24 consecutive hours non-work time; OR
   * (ii) in any 28-day period — at least 4 periods of 24 consecutive hours non-work time
   *      if, and only if, the driver has no more than 144 hours work time in any 14-day period
   *      that is part of the 28-day period.
   *
   * We evaluate using the available history:
   * - 14-day check uses the last 14 days when available.
   * - 28-day alternative is applied only when we have a full 28 days AND the 144h/14-day condition holds.
   */
  const combined = [...(soloOptions?.historyDays ?? []), ...days];
  if (combined.length >= 14) {
    const last14 = combined.slice(-14);
    const last14NonWork = flatSlots(last14, "non_work");
    const blocks24h14 = countContinuousBlocksOfAtLeast(last14NonWork, 24);
    const option14Ok = blocks24h14 >= 2;

    let option28Ok = false;
    if (combined.length >= 28) {
      const last28 = combined.slice(-28);
      const last28NonWork = flatSlots(last28, "non_work");
      const blocks24h28 = countContinuousBlocksOfAtLeast(last28NonWork, 24);

      if (blocks24h28 >= 4) {
        // 144h condition: every 14-day period within the 28-day period must have ≤144h work.
        let workOk = true;
        for (let startDay = 0; startDay <= 14; startDay++) {
          const w14 = last28.slice(startDay, startDay + 14).reduce((s, d) => s + getHours(d.work_time), 0);
          if (w14 > 144) {
            workOk = false;
            break;
          }
        }
        option28Ok = workOk;
      }
    }

    if (!option14Ok && !option28Ok) {
      results.push({
        type: "violation",
        iconKey: "Moon",
        day: "14-day",
        message:
          "Need ≥2×24h continuous non-work in any 14-day period (or meet 28-day alternative: 4×24h + ≤144h work in any 14 days)",
      });
    }
  }
}

function checkTwoUpRules(
  days: ComplianceDayData[],
  results: ComplianceCheckResult[],
  prevCount: number,
  evidence?: { movingDuringBreakCount?: number }
) {
  const nonWork = flatSlots(days, "non_work");
  const work = flatSlots(days, "work_time");
  const breaks = flatSlots(days, "breaks");
  const getLabel = (minuteIndex: number) => {
    const dayIdx = Math.floor(minuteIndex / MINUTES_PER_DAY);
    const ci = dayIdx - prevCount;
    return ci < 0 ? `prev+${dayIdx + 1}` : DAY_LABELS[ci] ?? `D${dayIdx + 1}`;
  };

  if (nonWork.length >= MINUTES_24H) {
    for (let start = 0; start <= nonWork.length - MINUTES_24H; start++) {
      const end = start + MINUTES_24H;
      const windowNonWork = nonWork.slice(start, end).filter(Boolean).length;
      const windowWorkBreak = work.slice(start, end).filter(Boolean).length + breaks.slice(start, end).filter(Boolean).length;
      const nonWorkHrs = windowNonWork / 60;
      const hasData = windowWorkBreak > 0;
      // Reg 184E(3)(a): in any 24h period — at least 7h non-work time (may be in moving vehicle).
      if (hasData && nonWorkHrs < MIN_NON_WORK_HRS_24H) {
        results.push({
          type: "violation",
          iconKey: "Moon",
          day: getLabel(end - 1),
          message: "Need ≥7h non-work in any rolling 24h period (Two-Up)",
        });
        break;
      }
    }
  }

  const currentDays = days.slice(prevCount);
  const totalWeekNonWork = currentDays.reduce((sum, d) => sum + getHours(d.non_work), 0);
  const allSlots = currentDays.flatMap((d) => d.non_work || Array(MINUTES_PER_DAY).fill(false));
  const longestBlock = findLongestContinuousBlock(allSlots);
  const hasAnyWork = currentDays.some(dayHasWork);

  // Reg 184E(3)(b)(ii): 7-day option
  const nonWorkBlocksUnder7 = (() => {
    const arr = normalizeCoverageFieldToMinutes(allSlots);
    let current = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]) current++;
      else {
        if (current > 0 && current < MIN_7H_BLOCK_MINUTES) return true;
        current = 0;
      }
    }
    if (current > 0 && current < MIN_7H_BLOCK_MINUTES) return true;
    return false;
  })();

  const meetsTwoUp7DayOption =
    hasAnyWork &&
    totalWeekNonWork >= 48 &&
    longestBlock >= 24 &&
    !nonWorkBlocksUnder7;

  if (hasAnyWork && totalWeekNonWork > 0 && totalWeekNonWork < 48) {
    results.push({
      type: "warning",
      iconKey: "TrendingUp",
      day: "7-day",
      message: `Need ≥48 hrs non-work in any 7-day period (current: ${totalWeekNonWork}h) — Two-Up`,
    });
  }
  if (hasAnyWork && totalWeekNonWork >= 48 && longestBlock < 24) {
    results.push({
      type: "warning",
      iconKey: "Moon",
      day: "7-day",
      message: `48hrs non-work must include ≥24 continuous hrs (longest: ${longestBlock}h) — Two-Up`,
    });
  }
  if (hasAnyWork && totalWeekNonWork >= 48 && nonWorkBlocksUnder7) {
    results.push({
      type: "warning",
      iconKey: "Moon",
      day: "7-day",
      message: "Non-work time must not include a period of less than 7 consecutive hours — Two-Up",
    });
  }

  // Reg 184E(3)(b)(i): 48-hour option applies only if not meeting the 7-day option.
  if (!meetsTwoUp7DayOption && nonWork.length >= MINUTES_48H) {
    for (let start = 0; start <= nonWork.length - MINUTES_48H; start++) {
      const window = nonWork.slice(start, start + MINUTES_48H);
      const sevenHrBlocks = countContinuousBlocksOfAtLeast(window, 7);
      const hasData = window.some((_, i) => work[start + i] || breaks[start + i]);
      if (!hasData) continue;
      if (sevenHrBlocks < 1) {
        const movingCount = evidence?.movingDuringBreakCount ?? 0;
        results.push({
          // We cannot fail purely due to missing/insufficient evidence.
          // Escalate to violation only when we have positive movement evidence during rest.
          type: movingCount > 0 ? "violation" : "warning",
          iconKey: "Moon",
          day: getLabel(start + MINUTES_48H - 1),
          message:
            movingCount > 0
              ? "Need ≥1 period of ≥7 continuous hours non-work NOT spent in a moving vehicle in any rolling 48h period (Two-Up) — movement evidence detected"
              : "Need ≥1 period of ≥7 continuous hours non-work NOT spent in a moving vehicle in any rolling 48h period (Two-Up) — enable location to prove stationary non-work",
        });
        break;
      }
    }
  }
}

/** Max accuracy (m) to trust for GPS-based checks; worse = skip that point. */
const GPS_ACCURACY_MAX_M = 500;
/** Min break duration (min) to check for moving vehicle. */
const BREAK_MIN_DURATION_MINS = 20;
/** Distance (km) above which break is considered "moving". */
const BREAK_MOVING_DISTANCE_KM = 5;
/** Odometer vs GPS ratio: warn if GPS/odometer < this or > 1/this. */
const ODOMETER_GPS_RATIO_MIN = 0.3;
const ODOMETER_GPS_RATIO_MAX = 1 / ODOMETER_GPS_RATIO_MIN;
/** Min events with location to run odometer vs GPS check. */
const ODOMETER_GPS_MIN_POINTS = 2;
/** Fraction of events without location above which to suggest enabling location. */
const LOCATION_EVIDENCE_WARN_FRACTION = 0.5;

type EventWithDay = { time: string; type: string; lat?: number; lng?: number; accuracy?: number; dayIndex: number };

function flattenEventsByTime(days: ComplianceDayData[]): EventWithDay[] {
  const out: EventWithDay[] = [];
  days.forEach((day, dayIndex) => {
    (day.events ?? []).forEach((ev) => out.push({ ...ev, dayIndex }));
  });
  out.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return out;
}

/**
 * Two-Up: 7h non-work time must be "not in a moving vehicle". The driver is in the same vehicle (rego unchanged)
 * between break and the next work. So GPS should not change between break and next work — if it does,
 * the vehicle moved during the break. Warn when break duration >= 20 min and distance to next *work*
 * event is large.
 */
function checkRestBreakMovingVehicle(
  days: ComplianceDayData[],
  results: ComplianceCheckResult[],
  options: { weekStarting?: string; prevWeekStarting?: string; prevCount: number }
): number {
  const { prevCount, weekStarting = "", prevWeekStarting = "" } = options;
  const getLabel = (dayIdx: number) => {
    const ci = dayIdx - prevCount;
    return ci < 0 ? `prev+${dayIdx + 1}` : DAY_LABELS[ci] ?? `D${dayIdx + 1}`;
  };
  const flat = flattenEventsByTime(days);
  let movingCount = 0;
  for (let i = 0; i < flat.length; i++) {
    if (flat[i].type !== "break") continue;
    const next = flat[i + 1];
    if (!next || next.type !== "work") continue;
    if (flat[i].lat == null || flat[i].lng == null || next.lat == null || next.lng == null) continue;
    const acc = flat[i].accuracy ?? 0;
    const nextAcc = next.accuracy ?? 0;
    if (acc > GPS_ACCURACY_MAX_M || nextAcc > GPS_ACCURACY_MAX_M) continue;
    const durationMin = Math.floor((new Date(next.time).getTime() - new Date(flat[i].time).getTime()) / 60000);
    if (durationMin < BREAK_MIN_DURATION_MINS) continue;
    const distanceKm = haversineDistanceKm(flat[i].lat!, flat[i].lng!, next.lat!, next.lng!);
    if (distanceKm <= BREAK_MOVING_DISTANCE_KM) continue;
    movingCount += 1;
    results.push({
      type: "warning",
      iconKey: "MapPin",
      day: getLabel(flat[i].dayIndex),
      message: `Break may have been taken in a moving vehicle (${distanceKm.toFixed(1)} km over ${durationMin} min) — 7h non-work rule may require stationary non-work time.`,
    });
  }
  return movingCount;
}

/**
 * Warn if recorded odometer (end_kms - start_kms) is implausible vs cumulative GPS distance for the day.
 */
function checkOdometerVsGpsPlausibility(
  days: ComplianceDayData[],
  results: ComplianceCheckResult[],
  options: { weekStarting?: string; prevWeekStarting?: string; prevCount: number }
) {
  const { prevCount, weekStarting = "", prevWeekStarting = "" } = options;
  const getLabel = (dayIdx: number) => {
    const ci = dayIdx - prevCount;
    return ci < 0 ? `prev+${dayIdx + 1}` : DAY_LABELS[ci] ?? `D${dayIdx + 1}`;
  };
  days.forEach((day, dayIndex) => {
    const events = day.events ?? [];
    const withLoc = events.filter((e) => e.lat != null && e.lng != null);
    if (withLoc.length < ODOMETER_GPS_MIN_POINTS) return;
    const startKms = day.start_kms;
    const endKms = day.end_kms;
    if (startKms == null || endKms == null || typeof startKms !== "number" || typeof endKms !== "number") return;
    const odometerKm = endKms - startKms;
    if (odometerKm < 0) return;
    let gpsKm = 0;
    for (let i = 0; i < withLoc.length - 1; i++) {
      const a = withLoc[i];
      const b = withLoc[i + 1];
      if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) continue;
      gpsKm += haversineDistanceKm(a.lat, a.lng, b.lat, b.lng);
    }
    if (odometerKm === 0) return;
    const ratio = gpsKm / odometerKm;
    if (ratio < ODOMETER_GPS_RATIO_MIN || ratio > ODOMETER_GPS_RATIO_MAX) {
      results.push({
        type: "info",
        ruleId: "odometer_gps_plausibility",
        iconKey: "MapPin",
        day: getLabel(dayIndex),
        message: `Recorded km (${odometerKm}) differs from GPS path (~${Math.round(gpsKm)} km) — optional check if you use location on this record.`,
      });
    }
  });
}

/**
 * Optional notice when many events have no location data (not a regulatory requirement).
 */
function checkLocationEvidenceWarning(days: ComplianceDayData[], results: ComplianceCheckResult[]) {
  let total = 0;
  let withLocation = 0;
  days.forEach((day) => {
    const events = day.events ?? [];
    events.forEach((ev) => {
      total++;
      if (ev.lat != null && ev.lng != null) withLocation++;
    });
  });
  if (total < 2) return;
  const fractionWithout = 1 - withLocation / total;
  if (fractionWithout > LOCATION_EVIDENCE_WARN_FRACTION) {
    results.push({
      type: "info",
      ruleId: "location_evidence",
      iconKey: "MapPin",
      day: "7-day",
      message: `Location wasn't recorded for some events (${withLocation}/${total} with GPS). Turning on location in your browser is optional — it can help if you ever need to show where you logged from.`,
    });
  }
}

function shiftChangeDayLabel(dayIdx: number, prevCount: number): string {
  const ci = dayIdx - prevCount;
  return ci < 0 ? `prev+${dayIdx + 1}` : DAY_LABELS[ci] ?? `D${dayIdx + 1}`;
}

function scrollDayIndexForExtended(dayIdx: number, prevCount: number): number | undefined {
  const ci = dayIdx - prevCount;
  return ci >= 0 && ci <= 6 ? ci : undefined;
}

function checkShiftChange24hBetweenShifts(
  days: ComplianceDayData[],
  results: ComplianceCheckResult[],
  prevCount: number
) {
  // Reg 184E(4): if shiftwork on 5+ consecutive days, require ≥24h continuous non-work between shift changes.
  const didWork = days.map(dayHasWork);

  let runStart = 0;
  while (runStart < didWork.length) {
    while (runStart < didWork.length && !didWork[runStart]) runStart++;
    if (runStart >= didWork.length) break;
    let runEnd = runStart;
    while (runEnd < didWork.length && didWork[runEnd]) runEnd++;
    const runLen = runEnd - runStart;

    if (runLen >= SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS) {
      const runHasAnyLabel = Array.from({ length: runLen }, (_, k) => runStart + k).some((i) => {
        const l = days[i]?.shift_label;
        return l === "A" || l === "B";
      });
      if (!runHasAnyLabel) {
        const anchor = runEnd - 1;
        results.push({
          type: "warning",
          ruleId: "shift_change_education",
          iconKey: "Clock",
          day: shiftChangeDayLabel(anchor, prevCount),
          message: SHIFT_CHANGE_EDUCATION_MESSAGE,
          scrollDayIndex: scrollDayIndexForExtended(anchor, prevCount),
        });
      }

      for (let i = runStart; i < runEnd - 1; i++) {
        const a = (days[i]?.shift_label ?? "") as ShiftLabel | "";
        const b = (days[i + 1]?.shift_label ?? "") as ShiftLabel | "";
        if (!a || !b || a === b) continue;

        const aEvents = days[i].events ?? [];
        const bEvents = days[i + 1].events ?? [];
        const stopMs = [...aEvents]
          .filter((e) => e.type === "stop")
          .map((e) => new Date(e.time).getTime())
          .filter((t) => Number.isFinite(t))
          .sort((x, y) => y - x)[0];
        const workMs = [...bEvents]
          .filter((e) => e.type === "work")
          .map((e) => new Date(e.time).getTime())
          .filter((t) => Number.isFinite(t))
          .sort((x, y) => x - y)[0];

        const detailBase: ShiftChangeGapDetail = {
          fromDayIndex: i,
          toDayIndex: i + 1,
          fromLabel: a,
          toLabel: b,
          gapHours: 0,
          stopTimeIso: Number.isFinite(stopMs) ? new Date(stopMs!).toISOString() : undefined,
          workTimeIso: Number.isFinite(workMs) ? new Date(workMs!).toISOString() : undefined,
        };

        if (!Number.isFinite(stopMs) || !Number.isFinite(workMs)) {
          results.push({
            type: "warning",
            ruleId: "shift_change_24h",
            iconKey: "Clock",
            day: shiftChangeDayLabel(i + 1, prevCount),
            message: formatShiftChangeMissingTimesMessage(a, b),
            scrollDayIndex: scrollDayIndexForExtended(i + 1, prevCount),
            shiftChange: detailBase,
          });
          continue;
        }

        const gapHrs = (workMs! - stopMs!) / (3600 * 1000);
        detailBase.gapHours = gapHrs;
        if (gapHrs < SHIFT_CHANGE_MIN_GAP_HOURS) {
          results.push({
            type: "violation",
            ruleId: "shift_change_24h",
            iconKey: "Clock",
            day: shiftChangeDayLabel(i + 1, prevCount),
            message: formatShiftChangeViolationMessage(detailBase),
            scrollDayIndex: scrollDayIndexForExtended(i, prevCount),
            shiftChange: detailBase,
          });
        }
      }
    }
    runStart = runEnd;
  }
}

/**
 * Run all compliance checks for the given week and optional previous week.
 * Returns violations and warnings (empty array = all compliant).
 */
export function runComplianceChecks(
  days: ComplianceDayData[],
  options: {
    driverType?: string;
    prevWeekDays?: ComplianceDayData[] | null;
    /** Optional preceding history (chronological) to support 28-day checks. */
    historyDays?: ComplianceDayData[] | null;
    last24hBreak?: string;
    weekStarting?: string;
    prevWeekStarting?: string;
    /** Current day index in week (0–6). With slotOffsetWithinToday, 72h rule is retrospective from now. */
    currentDayIndex?: number;
    /** Minutes 0–1440 elapsed since regulatory midnight; 72h window ends at now. */
    slotOffsetWithinToday?: number;
  }
): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];
  const {
    driverType = "solo",
    prevWeekDays,
    historyDays,
    last24hBreak,
    weekStarting,
    prevWeekStarting,
    currentDayIndex,
    slotOffsetWithinToday,
  } = options;

  const normalizedDays = days.map((d) => normalizeDayCoverageArrays(d));

  checkBreakFromDriving(normalizedDays, results);

  const prevDays: ComplianceDayData[] = (prevWeekDays || []).map((d) => normalizeDayCoverageArrays(d));
  /* Include last 3 days of previous sheet so 72h rule can use previous sheet when trailing window intersects */
  const extendedDays = [...prevDays.slice(-3), ...normalizedDays];
  const prevCount = Math.min(3, prevDays.length);

  if (driverType === "two_up") {
    const movingDuringBreakCount = checkRestBreakMovingVehicle(extendedDays, results, {
      weekStarting,
      prevWeekStarting,
      prevCount,
    });
    checkTwoUpRules(extendedDays, results, prevCount, { movingDuringBreakCount });
  } else {
    checkSoloRules(extendedDays, results, prevCount, {
      weekStarting,
      prevWeekStarting,
      last24hBreak,
      currentDayIndex,
      slotOffsetWithinToday,
      historyDays: (historyDays || []).map((d) => normalizeDayCoverageArrays(d)),
    });
  }

  checkShiftChange24hBetweenShifts(extendedDays, results, prevCount);

  checkOdometerVsGpsPlausibility(extendedDays, results, { weekStarting, prevWeekStarting, prevCount });
  checkLocationEvidenceWarning(extendedDays, results);

  const thisWeekWork = normalizedDays.reduce((s, d) => s + getHours(d.work_time), 0);
  const prevWeekWork = prevDays.reduce((s, d) => s + getHours(d.work_time), 0);
  const has14dayData = prevDays.length > 0;

  if (has14dayData) {
    const all14Days = [...prevDays, ...normalizedDays];
    const segments = segmentsSplitBy48hNonWork(all14Days);
    for (const segment of segments) {
      const segmentWork = segment.reduce((s, i) => s + getHours(all14Days[i].work_time), 0);
      if (segmentWork > 168) {
        results.push({
          type: "violation",
          iconKey: "TrendingUp",
          day: "14-day",
          message: "14-day work exceeds 168h",
        });
      } else if (segmentWork > 140) {
        results.push({
          type: "warning",
          iconKey: "TrendingUp",
          day: "14-day",
          message: `${segmentWork}h work in this period — approaching 168h limit (14-day rule resets after ≥48h continuous non-work)`,
        });
      }
    }
  } else {
    if (thisWeekWork > 168) {
      results.push({
        type: "violation",
        iconKey: "TrendingUp",
        day: "14-day",
        message: "14-day work exceeds 168h",
      });
    } else if (thisWeekWork > 84) {
      results.push({
        type: "warning",
        iconKey: "TrendingUp",
        day: "14-day",
        message: `${thisWeekWork}h this week — no previous sheet found to check full 14-day total`,
      });
    }
  }

  return results;
}

/**
 * Minutes elapsed since regulatory midnight today (0–1440). Matches sheet-detail / API compliance payload.
 * WA: Australia/Perth calendar day; otherwise device local. Used for 72h retrospective "window ending now".
 */
export function getSlotOffsetWithinTodayLocal(
  nowMs: number = Date.now(),
  jurisdictionCode?: string | null
): number {
  if (jurisdictionCode == null || jurisdictionCode === "WA_OSH_3132") {
    const ymd = getTodayYmdInTimeZone("Australia/Perth", new Date(nowMs));
    const start = getPerthMidnightUtcMs(ymd);
    return Math.min(MINUTES_PER_DAY, Math.max(0, Math.floor((nowMs - start) / 60000)));
  }
  const today = new Date(nowMs);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.min(MINUTES_PER_DAY, Math.max(0, Math.floor((nowMs - todayStart) / 60000)));
}

/** Clone days and set one work_time minute to true (for prospective "log work now" check). Expects minute-length grids. */
function cloneDaysAndInjectWork(
  days: ComplianceDayData[],
  dayIndex: number,
  minuteIndex: number
): ComplianceDayData[] {
  return days.map((d, i) => {
    if (i !== dayIndex) return { ...d };
    const work = d.work_time ?? Array(MINUTES_PER_DAY).fill(false);
    const next = [...work];
    if (minuteIndex >= 0 && minuteIndex < next.length) next[minuteIndex] = true;
    return { ...d, work_time: next };
  });
}

/** Messages relevant when about to log work (non-work time, 17h, 72h, 48h, 14-day limits). */
const WORK_RELEVANT_MESSAGE_PATTERNS = [
  "non-work",
  "7 continuous",
  "7h ",
  "17h",
  "72",
  "48 hrs",
  "48hrs",
  "168",
  "14-day",
];

function filterWorkRelevantResults(results: ComplianceCheckResult[]): ComplianceCheckResult[] {
  return results.filter((r) =>
    WORK_RELEVANT_MESSAGE_PATTERNS.some((p) => r.message.includes(p))
  );
}

/**
 * Run compliance as if one more minute of work were logged at "now" on the current day.
 * Normalizes legacy 48-slot grids first so injection targets the correct minute index.
 * Returns work-relevant violation/warning messages (non-work time, limits).
 * Use when the user is about to tap "Work" to show prospective issues.
 */
export function getProspectiveWorkWarnings(
  days: ComplianceDayData[],
  currentDayIndex: number,
  weekStarting: string,
  options: {
    driverType?: string;
    prevWeekDays?: ComplianceDayData[] | null;
    last24hBreak?: string;
    prevWeekStarting?: string;
    jurisdictionCode?: string | null;
  }
): string[] {
  const { jurisdictionCode, ...rest } = options;
  const normalizedDays = days.map((d) => normalizeDayCoverageArrays(d));
  const normalizedPrev = (options.prevWeekDays ?? null)?.map((d) => normalizeDayCoverageArrays(d)) ?? null;
  const slotOffsetWithinToday = getSlotOffsetWithinTodayLocal(undefined, jurisdictionCode);
  const injectMinute = Math.min(MINUTES_PER_DAY - 1, Math.max(0, slotOffsetWithinToday));
  const cloned = cloneDaysAndInjectWork(normalizedDays, currentDayIndex, injectMinute);
  const results = runComplianceChecks(cloned, {
    ...rest,
    prevWeekDays: normalizedPrev,
    weekStarting,
    currentDayIndex,
    slotOffsetWithinToday,
  });
  const relevant = filterWorkRelevantResults(results);
  return relevant.map((r) => r.message);
}
