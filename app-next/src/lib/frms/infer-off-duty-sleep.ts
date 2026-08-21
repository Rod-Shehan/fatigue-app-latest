/**
 * FRMS-only: infer main sleep inside End-shift non-work bouts.
 *
 * 24h identity (owner): 12 h shift + 7 h sleep + 1 h travel + 4 h home.
 * Travel is 30 min each way. Extra off-duty time is home (awake) at the front.
 * Converted Rest (31+) is not passed in — only `stop` → next work/other_work.
 * Not a diary event. Assurance tape only.
 */

import { RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** 30 min commute each way (most drivers within 30 min of the workplace). */
export const FRMS_COMMUTE_EACH_WAY_MS = 30 * MINUTE_MS;
/** Average main sleep. */
export const FRMS_MAIN_SLEEP_CAP_MS = 7 * HOUR_MS;
/** Home duties on a 12 h knock-off: 12 − 1 h travel − 7 h sleep. */
export const FRMS_HOME_DUTIES_MS = 4 * HOUR_MS;
/** Short gaps are not a night at home. */
export const FRMS_MIN_OFF_DUTY_FOR_SLEEP_MS = 2 * HOUR_MS;
export const FRMS_DAY_CYCLE_MS = 24 * HOUR_MS;

const MIN_SLEEP_MS = RISK_BLOCK_MINUTES * MINUTE_MS;
const WAKE_BETWEEN_SLEEPS_MS = FRMS_DAY_CYCLE_MS - FRMS_MAIN_SLEEP_CAP_MS; // 17 h

export type FrmsSleepWindow = { startMs: number; endMs: number };

/**
 * Closed bout: End shift → next Work / Other work.
 * Sleep is anchored to the next start minus 30 min (they sleep until they have to leave).
 * Longer than 12 h: extra time is home after arriving; further nights walk back 24 h.
 */
export function inferClosedOffDutySleepWindows(boutStartMs: number, boutEndMs: number): FrmsSleepWindow[] {
  const duration = boutEndMs - boutStartMs;
  if (duration < FRMS_MIN_OFF_DUTY_FOR_SLEEP_MS) return [];

  const earliestSleep = boutStartMs + FRMS_COMMUTE_EACH_WAY_MS;
  const latestSleepEnd = boutEndMs - FRMS_COMMUTE_EACH_WAY_MS;
  if (latestSleepEnd - earliestSleep < MIN_SLEEP_MS) return [];

  const windows: FrmsSleepWindow[] = [];
  let sleepEnd = latestSleepEnd;
  while (sleepEnd > earliestSleep) {
    let sleepStart = sleepEnd - FRMS_MAIN_SLEEP_CAP_MS;
    if (sleepStart < earliestSleep) sleepStart = earliestSleep;
    if (sleepEnd - sleepStart < MIN_SLEEP_MS) break;
    windows.push({ startMs: sleepStart, endMs: sleepEnd });
    sleepEnd = sleepStart - WAKE_BETWEEN_SLEEPS_MS;
  }
  return windows.reverse();
}

/**
 * Open bout: End shift with no following on-duty yet.
 * First night uses the 12 h identity (30 min + 4 h home, then 7 h sleep), then every 24 h.
 */
export function inferOpenOffDutySleepWindows(boutStartMs: number, horizonEndMs: number): FrmsSleepWindow[] {
  const firstSleepStart = boutStartMs + FRMS_COMMUTE_EACH_WAY_MS + FRMS_HOME_DUTIES_MS;
  const windows: FrmsSleepWindow[] = [];
  for (let sleepStart = firstSleepStart; sleepStart < horizonEndMs; sleepStart += FRMS_DAY_CYCLE_MS) {
    const sleepEnd = Math.min(sleepStart + FRMS_MAIN_SLEEP_CAP_MS, horizonEndMs);
    if (sleepEnd - sleepStart < MIN_SLEEP_MS) break;
    windows.push({ startMs: sleepStart, endMs: sleepEnd });
  }
  return windows;
}

export function blockOverlapsInferredSleep(
  blockStartMs: number,
  blockMs: number,
  windows: FrmsSleepWindow[]
): boolean {
  const blockEnd = blockStartMs + blockMs;
  const majority = blockMs / 2;
  for (const w of windows) {
    const overlap = Math.min(blockEnd, w.endMs) - Math.max(blockStartMs, w.startMs);
    if (overlap >= majority) return true;
  }
  return false;
}

type DiaryEvent = { time: string; type: string };

function eventMs(ev: DiaryEvent): number {
  const t = new Date(ev.time).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function isOnDutyType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "work" || t === "driving" || t === "other_work";
}

function isStopType(type: string): boolean {
  return type.toLowerCase() === "stop";
}

/**
 * Build inferred sleep windows from rolling diary events.
 * `stop` opens an off-duty bout; `work` / `other_work` closes it.
 */
export function inferMainSleepWindowsFromEvents(
  events: DiaryEvent[],
  horizonEndMs: number
): FrmsSleepWindow[] {
  const sorted = events
    .map((ev) => ({ type: ev.type, ms: eventMs(ev) }))
    .filter((ev) => Number.isFinite(ev.ms))
    .sort((a, b) => a.ms - b.ms);

  const windows: FrmsSleepWindow[] = [];
  let boutStart: number | null = null;

  for (const ev of sorted) {
    if (isStopType(ev.type) && boutStart === null) {
      boutStart = ev.ms;
      continue;
    }
    if (isOnDutyType(ev.type) && boutStart !== null) {
      windows.push(...inferClosedOffDutySleepWindows(boutStart, ev.ms));
      boutStart = null;
    }
  }

  if (boutStart !== null) {
    windows.push(...inferOpenOffDutySleepWindows(boutStart, horizonEndMs));
  }

  return windows;
}
