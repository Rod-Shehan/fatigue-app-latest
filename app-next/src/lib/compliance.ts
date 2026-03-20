/**
 * WA OSH Reg 3.132 compliance logic (pure, testable).
 * Used by CompliancePanel for display.
 *
 * Multi-jurisdiction / Australia-wide direction: see docs/adr/0001-multi-jurisdiction-fatigue-architecture.md
 * and src/lib/jurisdiction/. Do not claim NHVR EWD approval from this module alone.
 */

import { getSheetDayDateString } from "@/lib/weeks";
import { haversineDistanceKm } from "@/lib/geo";

export type ComplianceDayData = {
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  events?: { time: string; type: string; lat?: number; lng?: number; accuracy?: number }[];
  start_kms?: number | null;
  end_kms?: number | null;
};

export type ComplianceCheckResult = {
  type: "violation" | "warning";
  iconKey: "Coffee" | "AlertTriangle" | "Moon" | "Clock" | "TrendingUp" | "CheckCircle2" | "MapPin";
  day: string;
  message: string;
};

export function getHours(slots: boolean[] | undefined): number {
  return (slots || []).filter(Boolean).length * 0.5;
}

/** Day is considered to have work if it has work_time slots or any work event (used for 7h/17h rule scope). */
function dayHasWork(day: ComplianceDayData): boolean {
  if (getHours(day.work_time) > 0) return true;
  return (day.events?.some((e) => e.type === "work") ?? false);
}

export function findLongestContinuousBlock(slots: boolean[] | undefined): number {
  const arr = slots || [];
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
  return max * 0.5;
}

export function countContinuousBlocksOfAtLeast(slots: boolean[] | undefined, minHours: number): number {
  const arr = slots || [];
  let count = 0,
    current = 0;
  const minSlots = minHours * 2;
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

/** 48h = 96 half-hour slots. 14-day work limit resets after a continuous non-work break of this length. */
const NON_WORK_SLOTS_48H = 48 * 2;
/** 24h = 48 half-hour slots. A 24h continuous non-work period resets the 17h and 72h rules (Solo). */
const NON_WORK_SLOTS_24H = 48;

/**
 * Continuous "no work" slots spanning the boundary between two consecutive days (end of dayA + start of dayB).
 * No work = work_time is false (recorded non-work, break, or no entry all count the same; rule is rolling).
 */
function continuousNoWorkAcrossBoundary(dayA: ComplianceDayData, dayB: ComplianceDayData): number {
  const a = dayA.work_time || Array(48).fill(false);
  const b = dayB.work_time || Array(48).fill(false);
  let slots = 0;
  for (let s = 47; s >= 0 && !a[s]; s--) slots++;
  for (let s = 0; s < 48 && !b[s]; s++) slots++;
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
    if (across >= NON_WORK_SLOTS_48H) {
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
    if (across >= NON_WORK_SLOTS_24H || isDeclaredBreak) {
      segments.push(Array.from({ length: i - start + 1 }, (_, j) => start + j));
      start = i + 1;
    }
  }
  segments.push(Array.from({ length: days.length - start }, (_, j) => start + j));
  return segments;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOTS_PER_DAY = 48;
const SLOTS_24H = 48;
const SLOTS_48H = 96;
const SLOTS_72H = 72 * 2;
const MIN_NON_WORK_HRS_24H = 7;
const MIN_NON_WORK_SLOTS_24H = MIN_NON_WORK_HRS_24H * 2;
const MIN_RECORDED_HRS_24H = 16;
const MIN_7H_BLOCK_SLOTS = 7 * 2;

/** Flat slot arrays across days for rolling window checks. */
function flatSlots(days: ComplianceDayData[], key: "non_work" | "work_time" | "breaks"): boolean[] {
  return days.flatMap((d) => (d[key] || Array(SLOTS_PER_DAY).fill(false)).slice(0, SLOTS_PER_DAY));
}

function checkBreakFromDriving(days: ComplianceDayData[], results: ComplianceCheckResult[]) {
  days.forEach((day, idx) => {
    const dayLabel = DAY_LABELS[idx];
    const workHrs = getHours(day.work_time);
    const breakHrs = getHours(day.breaks);
    const nonWorkHrs = getHours(day.non_work);
    const totalRecorded = workHrs + breakHrs + nonWorkHrs;
    if (totalRecorded === 0) return;

    const events = day.events || [];
    if (events.length > 1) {
      let workMinsSinceBreak = 0;
      let pendingBreakStart: string | null = null;
      const pendingBreakSegments: number[] = [];
      /** Only one 5h-rule violation per block; block resets when break is pressed. */
      let violationEmittedForCurrentBlock = false;

      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const nextEv = events[i + 1];
        if (!nextEv) continue;
        const dur = Math.floor((new Date(nextEv.time).getTime() - new Date(ev.time).getTime()) / 60000);

        if (ev.type === "work") {
          if (pendingBreakSegments.length > 0) {
            const totalMins = pendingBreakSegments.reduce((a, b) => a + b, 0);
            const blocksOf10 = pendingBreakSegments.filter((m) => m >= 10).length;
            const valid = totalMins >= 20 && blocksOf10 >= 1;
            if (!valid && !violationEmittedForCurrentBlock) {
              results.push({
                type: "violation",
                iconKey: "Coffee",
                day: dayLabel,
                message: `20 min break for 5h work not met`,
              });
              violationEmittedForCurrentBlock = true;
            }
            if (valid) {
              workMinsSinceBreak = 0;
              violationEmittedForCurrentBlock = false;
            }
            pendingBreakSegments.length = 0;
            pendingBreakStart = null;
          }
          workMinsSinceBreak += dur;
          if (workMinsSinceBreak > 5 * 60 && !violationEmittedForCurrentBlock) {
            results.push({
              type: "violation",
              iconKey: "AlertTriangle",
              day: dayLabel,
              message: "More than 5h work without valid break",
            });
            violationEmittedForCurrentBlock = true;
          }
          if (workMinsSinceBreak > 5 * 60) workMinsSinceBreak = 0;
        } else if (ev.type === "break") {
          if (!pendingBreakStart) pendingBreakStart = ev.time;
          pendingBreakSegments.push(dur);
        } else {
          pendingBreakSegments.length = 0;
          pendingBreakStart = null;
          workMinsSinceBreak = 0;
          violationEmittedForCurrentBlock = false;
        }
      }
    } else {
      if (workHrs >= 5 && breakHrs === 0) {
        results.push({
          type: "warning",
          iconKey: "Coffee",
          day: dayLabel,
          message: "20 min break per 5 hours work (incl. ≥10 min continuous)",
        });
      }
    }
  });
}

const SLOTS_17H = 17 * 2;
const SLOTS_7H_NON_WORK = 7 * 2;

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
    /** Slots (0–48) of today already elapsed so the 72h window ends at "now". */
    slotOffsetWithinToday?: number;
  }
) {
  const hasAnyWork = days.some(dayHasWork);
  if (!hasAnyWork) return;

  days.forEach((day, idx) => {
    if (idx < prevCount) return;
    if (!dayHasWork(day)) return;
    const currentIdx = idx - prevCount;
    const dayLabel = DAY_LABELS[currentIdx] || `Day${currentIdx + 1}`;
    const workHrs = getHours(day.work_time);
    const breakHrs = getHours(day.breaks);
    const nonWorkHrs = getHours(day.non_work);
    const totalRecorded = workHrs + breakHrs + nonWorkHrs;
    if (totalRecorded === 0) return;

    const longestNonWork = findLongestContinuousBlock(day.non_work);
    const dayDate = getExtendedDayDate(idx, soloOptions?.weekStarting ?? "", soloOptions?.prevWeekStarting ?? "", prevCount);
    const isBefore24hBreakWithNoWork =
      soloOptions?.last24hBreak && dayDate < soloOptions.last24hBreak && !dayHasWork(day);
    if (isBefore24hBreakWithNoWork) return;
    const is24hBreakDay = soloOptions?.last24hBreak && dayDate === soloOptions.last24hBreak;
    if (is24hBreakDay) return;

    if (totalRecorded >= 12 && longestNonWork > 0 && longestNonWork < 7) {
      results.push({
        type: "violation",
        iconKey: "Moon",
        day: dayLabel,
        message: "Need ≥7 continuous hrs non-work",
      });
    }
  });

  const segments24 = segmentsSplitBy24hNonWork(days, {
    weekStarting: soloOptions?.weekStarting,
    prevWeekStarting: soloOptions?.prevWeekStarting,
    prevCount,
    last24hBreak: soloOptions?.last24hBreak,
  });
  const getLabel = (dayIdx: number) => {
    const ci = dayIdx - prevCount;
    return ci < 0 ? `prev+${dayIdx + 1}` : DAY_LABELS[ci] ?? `D${dayIdx + 1}`;
  };

  /* 17-hour rule (Solo): two periods of non-work time (each longer than 7h) cannot be separated by more than 17h of work and break combined. */
  for (const segment of segments24) {
    const segmentDays = segment.map((i) => days[i]);
    const nonWork = flatSlots(segmentDays, "non_work");
    const work = flatSlots(segmentDays, "work_time");
    const breaks = flatSlots(segmentDays, "breaks");
    let workBreakRun = 0;
    let nonWorkRun = 0;
    for (let s = 0; s < nonWork.length; s++) {
      const dayIndexInSegment = Math.min(Math.floor(s / SLOTS_PER_DAY), segmentDays.length - 1);
      const segmentDayHasWork = dayHasWork(segmentDays[dayIndexInSegment] ?? {});
      if (!segmentDayHasWork) {
        workBreakRun = 0;
        nonWorkRun = 0;
        continue;
      }
      const isWorkBreak = work[s] || breaks[s];
      if (nonWork[s]) {
        nonWorkRun++;
        workBreakRun = 0;
      } else if (isWorkBreak) {
        if (nonWorkRun >= SLOTS_7H_NON_WORK) workBreakRun = 0;
        nonWorkRun = 0;
        workBreakRun++;
        if (workBreakRun > SLOTS_17H) {
          const dayIdx = segment[dayIndexInSegment];
          const violationDayDate = getExtendedDayDate(dayIdx, soloOptions?.weekStarting ?? "", soloOptions?.prevWeekStarting ?? "", prevCount);
          if (soloOptions?.last24hBreak && violationDayDate === soloOptions.last24hBreak) {
            workBreakRun = 0;
            continue;
          }
          results.push({
            type: "violation",
            iconKey: "Clock",
            day: getLabel(dayIdx),
            message: "Two 7-hr+ non-work periods cannot be separated by more than 17h work+break",
          });
          break;
        }
      } else {
        nonWorkRun = 0;
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
    const getLabelSlot = (slotIndex: number) => getLabel(segment[Math.min(Math.floor(slotIndex / SLOTS_PER_DAY), segment.length - 1)]);

    const daysBeforeToday = segment.filter((i) => i < todayExtended!).length;
    const effectiveEndSlot = daysBeforeToday * SLOTS_PER_DAY + Math.min(48, Math.max(0, slotOffsetWithinToday ?? 48));

    if (effectiveEndSlot < SLOTS_72H) continue;
    const start = effectiveEndSlot - SLOTS_72H;
    const window = nonWork.slice(start, effectiveEndSlot);
    const totalNonWork = window.filter(Boolean).length * 0.5;
    const sevenHrBlocks = countContinuousBlocksOfAtLeast(window, 7);
    const hasData = window.some((_, i) => work[start + i] || breaks[start + i]);
    if (!hasData) continue;

    const windowEndSuffix = " — 72h window ending now";
    if (totalNonWork < 27) {
      results.push({
        type: "warning",
        iconKey: "TrendingUp",
        day: getLabelSlot(effectiveEndSlot - 1),
        message: `Need ≥27 hrs non-work in any rolling 72hr period (24h non-work resets; this window: ${totalNonWork}h)${windowEndSuffix}`,
      });
    } else if (sevenHrBlocks < 3) {
      results.push({
        type: "warning",
        iconKey: "Moon",
        day: getLabelSlot(effectiveEndSlot - 1),
        message: `Need ≥3 blocks of ≥7 continuous hrs non-work in any rolling 72hrs (24h non-work resets; found: ${sevenHrBlocks})${windowEndSuffix}`,
      });
    }
  }
}

function checkTwoUpRules(days: ComplianceDayData[], results: ComplianceCheckResult[], prevCount: number) {
  const nonWork = flatSlots(days, "non_work");
  const work = flatSlots(days, "work_time");
  const breaks = flatSlots(days, "breaks");
  const getLabel = (slotIndex: number) => {
    const dayIdx = Math.floor(slotIndex / SLOTS_PER_DAY);
    const ci = dayIdx - prevCount;
    return ci < 0 ? `prev+${dayIdx + 1}` : DAY_LABELS[ci] ?? `D${dayIdx + 1}`;
  };

  if (nonWork.length >= SLOTS_24H) {
    for (let start = 0; start <= nonWork.length - SLOTS_24H; start++) {
      const end = start + SLOTS_24H;
      const windowNonWork = nonWork.slice(start, end).filter(Boolean).length;
      const windowWorkBreak = work.slice(start, end).filter(Boolean).length + breaks.slice(start, end).filter(Boolean).length;
      const nonWorkHrs = windowNonWork * 0.5;
      const recordedHrs = windowWorkBreak * 0.5;
      if (recordedHrs >= MIN_RECORDED_HRS_24H && nonWorkHrs < MIN_NON_WORK_HRS_24H) {
        results.push({
          type: "violation",
          iconKey: "Moon",
          day: getLabel(end - 1),
          message: "Need ≥7h non-work in rolling 24h",
        });
        break;
      }
    }
  }

  if (nonWork.length >= SLOTS_48H) {
    for (let start = 0; start <= nonWork.length - SLOTS_48H; start++) {
      const window = nonWork.slice(start, start + SLOTS_48H);
      const sevenHrBlocks = countContinuousBlocksOfAtLeast(window, 7);
      if (sevenHrBlocks < 1) {
        const hasData = window.some((_, i) => work[start + i] || breaks[start + i]);
        if (hasData) {
          results.push({
            type: "warning",
            iconKey: "Moon",
            day: getLabel(start + SLOTS_48H - 1),
            message: "Need ≥1 block of ≥7 continuous hrs non-work in any rolling 48 hrs (Two-Up rule)",
          });
          break;
        }
      }
    }
  }

  const currentDays = days.slice(prevCount);
  const totalWeekNonWork = currentDays.reduce((sum, d) => sum + getHours(d.non_work), 0);
  const allSlots = currentDays.flatMap((d) => d.non_work || Array(48).fill(false));
  const longestBlock = findLongestContinuousBlock(allSlots);
  if (totalWeekNonWork > 0 && totalWeekNonWork < 48) {
    results.push({
      type: "warning",
      iconKey: "TrendingUp",
      day: "7-day",
      message: `Need ≥48 hrs non-work in 7 days (current: ${totalWeekNonWork}h) — Two-Up rule`,
    });
  }
  if (totalWeekNonWork >= 48 && longestBlock < 24) {
    results.push({
      type: "warning",
      iconKey: "Moon",
      day: "7-day",
      message: `48hrs non-work must include ≥24 continuous hrs (longest: ${longestBlock}h) — Two-Up rule`,
    });
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
) {
  const { prevCount, weekStarting = "", prevWeekStarting = "" } = options;
  const getLabel = (dayIdx: number) => {
    const ci = dayIdx - prevCount;
    return ci < 0 ? `prev+${dayIdx + 1}` : DAY_LABELS[ci] ?? `D${dayIdx + 1}`;
  };
  const flat = flattenEventsByTime(days);
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
    results.push({
      type: "warning",
      iconKey: "MapPin",
      day: getLabel(flat[i].dayIndex),
      message: `Break may have been taken in a moving vehicle (${distanceKm.toFixed(1)} km over ${durationMin} min) — 7h non-work rule may require stationary non-work time.`,
    });
  }
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
        type: "warning",
        iconKey: "MapPin",
        day: getLabel(dayIndex),
        message: `Recorded km (${odometerKm}) may not match route (GPS path ~${Math.round(gpsKm)} km) — verify odometer.`,
      });
    }
  });
}

/**
 * Soft warning when many events have no location data (audit evidence).
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
      type: "warning",
      iconKey: "MapPin",
      day: "7-day",
      message: `Many events have no location data (${withLocation}/${total} with GPS) — consider enabling location for compliance evidence.`,
    });
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
    last24hBreak?: string;
    weekStarting?: string;
    prevWeekStarting?: string;
    /** Current day index in week (0–6). With slotOffsetWithinToday, 72h rule is retrospective from now. */
    currentDayIndex?: number;
    /** Slots (0–48) of today elapsed so 72h window ends at now. */
    slotOffsetWithinToday?: number;
  }
): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];
  const {
    driverType = "solo",
    prevWeekDays,
    last24hBreak,
    weekStarting,
    prevWeekStarting,
    currentDayIndex,
    slotOffsetWithinToday,
  } = options;

  checkBreakFromDriving(days, results);

  const prevDays: ComplianceDayData[] = (prevWeekDays || []).map((d) => ({
    ...d,
    work_time: d.work_time || Array(48).fill(false),
    breaks: d.breaks || Array(48).fill(false),
    non_work: d.non_work || Array(48).fill(false),
  }));
  /* Include last 3 days of previous sheet so 72h rule can use previous sheet when trailing window intersects */
  const extendedDays = [...prevDays.slice(-3), ...days];
  const prevCount = Math.min(3, prevDays.length);

  if (driverType === "two_up") {
    checkTwoUpRules(extendedDays, results, prevCount);
    checkRestBreakMovingVehicle(extendedDays, results, { weekStarting, prevWeekStarting, prevCount });
  } else {
    checkSoloRules(extendedDays, results, prevCount, {
      weekStarting,
      prevWeekStarting,
      last24hBreak,
      currentDayIndex,
      slotOffsetWithinToday,
    });
  }

  checkOdometerVsGpsPlausibility(extendedDays, results, { weekStarting, prevWeekStarting, prevCount });
  checkLocationEvidenceWarning(extendedDays, results);

  const thisWeekWork = days.reduce((s, d) => s + getHours(d.work_time), 0);
  const prevWeekWork = prevDays.reduce((s, d) => s + getHours(d.work_time), 0);
  const has14dayData = prevDays.length > 0;

  if (has14dayData) {
    const all14Days = [...prevDays, ...days];
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

/** Slot index (0–47) for "now" on the given sheet day. Uses local date. */
function getSlotIndexForNow(weekStarting: string, currentDayIndex: number): number {
  const dateStr = getSheetDayDateString(weekStarting, currentDayIndex);
  const startOfDay = new Date(dateStr + "T00:00:00").getTime();
  const now = Date.now();
  const slot = Math.floor((now - startOfDay) / (30 * 60 * 1000));
  return Math.max(0, Math.min(47, slot));
}

/** Clone days and set one work_time slot to true (for prospective "log work now" check). */
function cloneDaysAndInjectWork(
  days: ComplianceDayData[],
  dayIndex: number,
  slotIndex: number
): ComplianceDayData[] {
  return days.map((d, i) => {
    if (i !== dayIndex) return { ...d };
    const work = d.work_time ?? Array(48).fill(false);
    const next = [...work];
    if (slotIndex >= 0 && slotIndex < next.length) next[slotIndex] = true;
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
 * Run compliance as if one more 30-min work segment were logged at "now" on the current day.
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
  }
): string[] {
  const slot = getSlotIndexForNow(weekStarting, currentDayIndex);
  const cloned = cloneDaysAndInjectWork(days, currentDayIndex, slot);
  const results = runComplianceChecks(cloned, {
    ...options,
    weekStarting,
  });
  const relevant = filterWorkRelevantResults(results);
  return relevant.map((r) => r.message);
}
