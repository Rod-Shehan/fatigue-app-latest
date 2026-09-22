/**
 * Two-up 184E(3)(b): non-work that is not in a moving vehicle.
 * Sleeper berth counts for 184E(3)(a) only. Parked (GPS) and End shift (GPS) count here.
 * Owner 2026-09-22: D work-enliven, E 48h mature window from first duty, F declared ranges.
 */

import {
  OTHER_WORK_EVENT_TYPE,
  PASSENGER_EVENT_TYPE,
  STATIONARY_REST_EVENT_TYPE,
} from "@/lib/activity-kind";
import {
  AMI_48H_MIN_CONTINUOUS_NON_WORK,
  AMI_48H_WINDOW,
  AMI_7D_MIN_CONTINUOUS_BLOCK,
  AMI_7D_MIN_NON_WORK_PIECE,
  AMI_7D_MIN_TOTAL_NON_WORK,
  AMI_7D_WINDOW,
} from "@/lib/ami/constants";
import { alignToMinuteMs } from "@/lib/ami/paint";
import { LAST_24H_BREAK_MIN_MS, LAST_7H_BREAK_MIN_MS } from "@/lib/last-24h-break-range";

export type StationaryGeoEvent = {
  time: string;
  type: string;
  lat?: number;
  lng?: number;
};

/** Attested Parked / End shift range (paper or pre-Circadia). Counts as proven stationary. */
export type TwoUpDeclaredStationaryRange = {
  startIso: string;
  endIso: string;
};

export type ScoreTwoUp184E3bInput = {
  recordStartMs?: number;
  /** D: work/break exists. When omitted, inferred from duty events. */
  hasDuty?: boolean;
  /** E: first work/break instant. Unknown start + known duty → score live. */
  firstDutyMs?: number;
  /** F: declared 7h and/or 24h stationary ranges. */
  declaredRanges?: TwoUpDeclaredStationaryRange[];
};

export type TwoUp184E3bSkipReason = "not_enlivened" | "window_immature" | null;

/** Work / break-from-driving that enlivens 184E(3)(b). */
export function isTwoUpDutyEventType(type: string): boolean {
  return (
    type === "work" ||
    type === "break" ||
    type === OTHER_WORK_EVENT_TYPE ||
    type === PASSENGER_EVENT_TYPE
  );
}

export function twoUpHasDutyOnDays(
  days: Array<{ work_time?: boolean[]; breaks?: boolean[] } | null | undefined>
): boolean {
  return days.some((d) => d?.work_time?.some(Boolean) || d?.breaks?.some(Boolean));
}

export function twoUpFirstDutyMsFromDays(
  days: Array<{ work_time?: boolean[]; breaks?: boolean[] } | null | undefined>,
  timelineStartMs: number
): number | undefined {
  if (!Number.isFinite(timelineStartMs)) return undefined;
  let offset = 0;
  for (const d of days) {
    const work = d?.work_time ?? [];
    const br = d?.breaks ?? [];
    const n = Math.max(work.length, br.length);
    for (let i = 0; i < n; i++) {
      if (work[i] || br[i]) return timelineStartMs + (offset + i) * 60_000;
    }
    offset += 1440;
  }
  return undefined;
}

export const TWO_UP_DECLARED_REST_COPY = {
  TITLE: "Last parked / End shift rest",
  WHY: "Two-up 48-hour / 7-day rest is proven by Parked or End shift with GPS. If that rest happened before this app, enter it here. A 7-hour block meets the 48-hour option. A 24-hour block also helps the 7-day option.",
  LABEL_7H: "Last 7 hour parked or End shift",
  LABEL_24H: "Last 24 hour stationary rest",
  HINT_7H: "Set when the vehicle was parked or you ended shift (Perth). End fills 7 hours later — change it only if the rest ran longer.",
  HINT_24H: "Set when a full 24 hours off started (motel / home). End fills 24 hours later — change it only if the rest ran longer.",
  LOCKED_HINT: "Locked after sign-off — ask your manager to amend.",
} as const;

export function buildTwoUp184E3bScoreInput(input: {
  events: StationaryGeoEvent[];
  days: Array<{ work_time?: boolean[]; breaks?: boolean[] } | null | undefined>;
  recordStartMs?: number;
  last7hRestStart?: string | null;
  last7hRestEnd?: string | null;
  last24hBreakStart?: string | null;
  last24hBreakEnd?: string | null;
}): ScoreTwoUp184E3bInput {
  const eventFirstDuty = input.events.reduce<number | undefined>((min, ev) => {
    if (!isTwoUpDutyEventType(ev.type)) return min;
    const t = Date.parse(ev.time);
    if (!Number.isFinite(t)) return min;
    return min == null || t < min ? t : min;
  }, undefined);
  const gridFirstDuty =
    input.recordStartMs != null
      ? twoUpFirstDutyMsFromDays(input.days, input.recordStartMs)
      : undefined;
  const firstDutyMs =
    eventFirstDuty != null && gridFirstDuty != null
      ? Math.min(eventFirstDuty, gridFirstDuty)
      : (eventFirstDuty ?? gridFirstDuty);
  return {
    recordStartMs: input.recordStartMs,
    hasDuty:
      input.events.some((e) => isTwoUpDutyEventType(e.type)) || twoUpHasDutyOnDays(input.days),
    firstDutyMs,
    declaredRanges: collectTwoUpDeclaredStationaryRanges({
      last7hRestStart: input.last7hRestStart,
      last7hRestEnd: input.last7hRestEnd,
      last24hBreakStart: input.last24hBreakStart,
      last24hBreakEnd: input.last24hBreakEnd,
    }),
  };
}

export function collectTwoUpDeclaredStationaryRanges(input: {
  last7hRestStart?: string | null;
  last7hRestEnd?: string | null;
  last24hBreakStart?: string | null;
  last24hBreakEnd?: string | null;
}): TwoUpDeclaredStationaryRange[] {
  const out: TwoUpDeclaredStationaryRange[] = [];
  const add = (start?: string | null, end?: string | null, minMs: number) => {
    const a = start?.trim() ?? "";
    const b = end?.trim() ?? "";
    if (!a || !b) return;
    const startMs = Date.parse(a);
    const endMs = Date.parse(b);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs - startMs < minMs) return;
    out.push({ startIso: a, endIso: b });
  };
  add(input.last7hRestStart, input.last7hRestEnd, LAST_7H_BREAK_MIN_MS);
  add(input.last24hBreakStart, input.last24hBreakEnd, LAST_24H_BREAK_MIN_MS);
  return out;
}

function resolveScoreInput(
  third?: number | ScoreTwoUp184E3bInput
): ScoreTwoUp184E3bInput {
  if (third == null) return {};
  if (typeof third === "number") return { recordStartMs: third };
  return third;
}

export function eventHasGps(ev: StationaryGeoEvent): boolean {
  return (
    typeof ev.lat === "number" &&
    Number.isFinite(ev.lat) &&
    typeof ev.lng === "number" &&
    Number.isFinite(ev.lng)
  );
}

/** Opens GPS-proven stationary non-work: Parked, or End shift. */
export function opensProvenStationaryNonWork(ev: StationaryGeoEvent): boolean {
  if (!eventHasGps(ev)) return false;
  return ev.type === "stop" || ev.type === STATIONARY_REST_EVENT_TYPE;
}

function eventTimeMs(ev: StationaryGeoEvent): number {
  return new Date(ev.time).getTime();
}

function sortEvents(events: StationaryGeoEvent[]): StationaryGeoEvent[] {
  return [...events].sort((a, b) => eventTimeMs(a) - eventTimeMs(b));
}

function lastEventAt(events: StationaryGeoEvent[], asOfMs: number): StationaryGeoEvent | null {
  let last: StationaryGeoEvent | null = null;
  let lastMs = -Infinity;
  for (const ev of events) {
    const t = eventTimeMs(ev);
    if (!Number.isFinite(t) || t > asOfMs) continue;
    if (t >= lastMs) {
      lastMs = t;
      last = ev;
    }
  }
  return last;
}

function stationaryOpenAfter(ev: StationaryGeoEvent | null): boolean {
  if (!ev) return false;
  return opensProvenStationaryNonWork(ev);
}

/**
 * Minute flags: GPS-proven parked / End-shift non-work only.
 * Sleeper berth, unlogged gaps, and events without GPS do not set true.
 */
export function paintProvenStationaryNonWork(
  events: StationaryGeoEvent[],
  originMs: number,
  asOfMs: number,
  declaredRanges?: TwoUpDeclaredStationaryRange[]
): boolean[] {
  const origin = alignToMinuteMs(originMs);
  const end = alignToMinuteMs(asOfMs);
  const length = Math.max(0, Math.floor((end - origin) / 60_000));
  const flags = Array(length).fill(false) as boolean[];
  if (length === 0) return flags;

  const sorted = sortEvents(events).filter((e) => Number.isFinite(eventTimeMs(e)));
  const minuteIndex = (ms: number): number =>
    Math.max(0, Math.min(length, Math.floor((ms - origin) / 60_000)));

  const fill = (fromMs: number, toMs: number, on: boolean) => {
    if (!on) return;
    const a = minuteIndex(fromMs);
    const b = minuteIndex(toMs);
    for (let i = a; i < b; i++) flags[i] = true;
  };

  let cursorMs = origin;
  let open = stationaryOpenAfter(lastEventAt(sorted, origin));

  for (const ev of sorted) {
    const t = eventTimeMs(ev);
    if (t >= end) break;
    if (t < origin) continue;
    fill(cursorMs, t, open);
    open = stationaryOpenAfter(ev);
    cursorMs = t;
  }
  fill(cursorMs, end, open);

  for (const range of declaredRanges ?? []) {
    const startMs = Date.parse(range.startIso);
    const endMs = Date.parse(range.endIso);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    fill(Math.max(startMs, origin), Math.min(endMs, end), true);
  }
  return flags;
}

function continuousTrueRuns(
  flags: boolean[],
  from = 0
): Array<{ start: number; end: number; length: number }> {
  const runs: Array<{ start: number; end: number; length: number }> = [];
  for (let s = from; s < flags.length; ) {
    if (!flags[s]) {
      s++;
      continue;
    }
    let e = s;
    while (e < flags.length && flags[e]) e++;
    runs.push({ start: s, end: e, length: e - s });
    s = e;
  }
  return runs;
}

function sliceWindow(flags: boolean[], windowMin: number): { flags: boolean[]; from: number } {
  const from = Math.max(0, flags.length - windowMin);
  return { flags: flags.slice(from), from };
}

export function evaluateTwoUp48hStationaryOption(
  events: StationaryGeoEvent[],
  asOfMs: number,
  recordStartMs?: number,
  declaredRanges?: TwoUpDeclaredStationaryRange[]
): { hasQualBlock: boolean } {
  const originMs =
    recordStartMs != null && Number.isFinite(recordStartMs)
      ? Math.max(recordStartMs, asOfMs - AMI_48H_WINDOW * 60_000)
      : asOfMs - AMI_48H_WINDOW * 60_000;
  const flags = paintProvenStationaryNonWork(events, originMs, asOfMs, declaredRanges);
  const { flags: window } = sliceWindow(flags, AMI_48H_WINDOW);
  const hasQualBlock = continuousTrueRuns(window).some(
    (r) => r.length >= AMI_48H_MIN_CONTINUOUS_NON_WORK
  );
  return { hasQualBlock };
}

/** Combined 184E(3)(b) fail copy — AMI overlay and AMI kill-switch share this. */
export const TWO_UP_184E3B_FAIL_MESSAGE =
  "Need ≥7h continuous GPS-proven Parked or End shift in any rolling 48h (Two-Up 48h option) or 7-day option (≥48h GPS-proven non-work including ≥24h, no period under 7h)";

export function evaluateTwoUp7dStationaryOption(
  events: StationaryGeoEvent[],
  asOfMs: number,
  recordStartMs?: number,
  declaredRanges?: TwoUpDeclaredStationaryRange[]
): {
  totalNonWork: number;
  has24hBlock: boolean;
  hasSubMinPiece: boolean;
  structureOk: boolean;
} {
  const originMs =
    recordStartMs != null && Number.isFinite(recordStartMs)
      ? Math.max(recordStartMs, asOfMs - AMI_7D_WINDOW * 60_000)
      : asOfMs - AMI_7D_WINDOW * 60_000;
  const flags = paintProvenStationaryNonWork(events, originMs, asOfMs, declaredRanges);
  const { flags: window } = sliceWindow(flags, AMI_7D_WINDOW);
  const runs = continuousTrueRuns(window);
  const totalNonWork = window.filter(Boolean).length;
  const has24hBlock = runs.some((r) => r.length >= AMI_7D_MIN_CONTINUOUS_BLOCK);
  const hasSubMinPiece = runs.some((r) => r.length > 0 && r.length < AMI_7D_MIN_NON_WORK_PIECE);
  const structureOk =
    totalNonWork >= AMI_7D_MIN_TOTAL_NON_WORK && has24hBlock && !hasSubMinPiece;
  return { totalNonWork, has24hBlock, hasSubMinPiece, structureOk };
}

export function scoreTwoUp184E3b(
  events: StationaryGeoEvent[],
  asOfMs: number,
  recordStartMsOrInput?: number | ScoreTwoUp184E3bInput
): {
  t7: ReturnType<typeof evaluateTwoUp7dStationaryOption>;
  t48: ReturnType<typeof evaluateTwoUp48hStationaryOption>;
  ok: boolean;
  skipReason: TwoUp184E3bSkipReason;
} {
  const input = resolveScoreInput(recordStartMsOrInput);
  const declared = input.declaredRanges ?? [];
  const t7 = evaluateTwoUp7dStationaryOption(events, asOfMs, input.recordStartMs, declared);
  const t48 = evaluateTwoUp48hStationaryOption(events, asOfMs, input.recordStartMs, declared);
  if (t7.structureOk || t48.hasQualBlock) {
    return { t7, t48, ok: true, skipReason: null };
  }

  const hasDuty = input.hasDuty ?? events.some((e) => isTwoUpDutyEventType(e.type));
  if (!hasDuty) {
    return { t7, t48, ok: true, skipReason: "not_enlivened" };
  }

  const firstDutyMs = input.firstDutyMs;
  const windowMature =
    firstDutyMs != null && Number.isFinite(firstDutyMs)
      ? asOfMs - firstDutyMs >= AMI_48H_WINDOW * 60_000
      : true;
  if (!windowMature) {
    return { t7, t48, ok: true, skipReason: "window_immature" };
  }

  return { t7, t48, ok: false, skipReason: null };
}

/** Extra 7-day structure warnings — only when the combined (3)(b) OR has already failed. */
export function twoUp184E3bStructureWarnings(
  t7: ReturnType<typeof evaluateTwoUp7dStationaryOption>
): Array<{ type: "warning"; iconKey: "TrendingUp" | "Moon"; day: "7-day"; message: string }> {
  const out: Array<{
    type: "warning";
    iconKey: "TrendingUp" | "Moon";
    day: "7-day";
    message: string;
  }> = [];
  if (t7.totalNonWork > 0 && t7.totalNonWork < AMI_7D_MIN_TOTAL_NON_WORK) {
    out.push({
      type: "warning",
      iconKey: "TrendingUp",
      day: "7-day",
      message: `Need ≥48 hrs non-work in any 7-day period (current: ${Math.round(t7.totalNonWork / 60)}h) — Two-Up`,
    });
  }
  if (t7.totalNonWork >= AMI_7D_MIN_TOTAL_NON_WORK && !t7.has24hBlock) {
    out.push({
      type: "warning",
      iconKey: "Moon",
      day: "7-day",
      message: "48hrs non-work must include ≥24 continuous hrs — Two-Up",
    });
  }
  if (t7.totalNonWork >= AMI_7D_MIN_TOTAL_NON_WORK && t7.hasSubMinPiece) {
    out.push({
      type: "warning",
      iconKey: "Moon",
      day: "7-day",
      message: "Non-work time must not include a period of less than 7 consecutive hours — Two-Up",
    });
  }
  return out;
}
