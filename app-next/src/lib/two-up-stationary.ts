/**
 * Two-up 184E(3)(b): non-work that is not in a moving vehicle.
 * Sleeper berth counts for 184E(3)(a) only. Parked (GPS) and End shift (GPS) count here.
 */

import { STATIONARY_REST_EVENT_TYPE } from "@/lib/activity-kind";
import {
  AMI_48H_MIN_CONTINUOUS_NON_WORK,
  AMI_48H_WINDOW,
  AMI_7D_MIN_CONTINUOUS_BLOCK,
  AMI_7D_MIN_NON_WORK_PIECE,
  AMI_7D_MIN_TOTAL_NON_WORK,
  AMI_7D_WINDOW,
} from "@/lib/ami/constants";
import { alignToMinuteMs } from "@/lib/ami/paint";

export type StationaryGeoEvent = {
  time: string;
  type: string;
  lat?: number;
  lng?: number;
};

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
  asOfMs: number
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
  recordStartMs?: number
): { hasQualBlock: boolean } {
  const originMs =
    recordStartMs != null && Number.isFinite(recordStartMs)
      ? Math.max(recordStartMs, asOfMs - AMI_48H_WINDOW * 60_000)
      : asOfMs - AMI_48H_WINDOW * 60_000;
  const flags = paintProvenStationaryNonWork(events, originMs, asOfMs);
  const { flags: window } = sliceWindow(flags, AMI_48H_WINDOW);
  const hasQualBlock = continuousTrueRuns(window).some(
    (r) => r.length >= AMI_48H_MIN_CONTINUOUS_NON_WORK
  );
  return { hasQualBlock };
}

export function evaluateTwoUp7dStationaryOption(
  events: StationaryGeoEvent[],
  asOfMs: number,
  recordStartMs?: number
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
  const flags = paintProvenStationaryNonWork(events, originMs, asOfMs);
  const { flags: window } = sliceWindow(flags, AMI_7D_WINDOW);
  const runs = continuousTrueRuns(window);
  const totalNonWork = window.filter(Boolean).length;
  const has24hBlock = runs.some((r) => r.length >= AMI_7D_MIN_CONTINUOUS_BLOCK);
  const hasSubMinPiece = runs.some((r) => r.length > 0 && r.length < AMI_7D_MIN_NON_WORK_PIECE);
  const structureOk =
    totalNonWork >= AMI_7D_MIN_TOTAL_NON_WORK && has24hBlock && !hasSubMinPiece;
  return { totalNonWork, has24hBlock, hasSubMinPiece, structureOk };
}
