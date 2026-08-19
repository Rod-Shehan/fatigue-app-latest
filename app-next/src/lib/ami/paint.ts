import type { AmiEvent, AmiKind, AmiSegment, AmiTape } from "./types";
import { toCoverageKind } from "@/lib/activity-kind";

const MIN_MS = 60_000;

export function alignToMinuteMs(ms: number): number {
  return Math.floor(ms / MIN_MS) * MIN_MS;
}

export function eventTimeMs(ev: { time: string }): number {
  return new Date(ev.time).getTime();
}

export function sortAmiEvents(events: AmiEvent[]): AmiEvent[] {
  return [...events].sort((a, b) => eventTimeMs(a) - eventTimeMs(b));
}

/**
 * Last event with time ≤ asOfMs (raw stream — for UI continuity / stop detection).
 */
export function lastAmiEventAt(events: AmiEvent[], asOfMs: number): AmiEvent | null {
  let last: AmiEvent | null = null;
  let lastMs = -Infinity;
  for (const ev of sortAmiEvents(events)) {
    const t = eventTimeMs(ev);
    if (!Number.isFinite(t) || t > asOfMs) continue;
    if (t >= lastMs) {
      lastMs = t;
      last = ev;
    }
  }
  return last;
}

/** Open activity at asOf from raw events (stop → no open work/break). */
export function openKindAtAsOf(events: AmiEvent[], asOfMs: number): AmiKind | null {
  const last = lastAmiEventAt(events, asOfMs);
  if (!last || last.type === "stop") return null;
  return toCoverageKind(last.type);
}

/**
 * Paint raw events onto an absolute minute tape.
 * - `stop` does not paint work/break; time after stop defaults to non_work until next event.
 * - Open last segment extends to asOfMs.
 * - Minutes before the first event in range are non_work.
 */
export function paintAmiTape(
  events: AmiEvent[],
  originMs: number,
  asOfMs: number
): AmiTape {
  const origin = alignToMinuteMs(originMs);
  const end = alignToMinuteMs(asOfMs);
  const length = Math.max(0, Math.floor((end - origin) / MIN_MS));
  const kinds: AmiKind[] = Array(length).fill("non_work");

  if (length === 0) {
    return { originMs: origin, endMs: end, kinds };
  }

  const sorted = sortAmiEvents(events).filter((e) => Number.isFinite(eventTimeMs(e)));

  const minuteIndex = (ms: number): number =>
    Math.max(0, Math.min(length, Math.floor((ms - origin) / MIN_MS)));

  const fill = (fromMs: number, toMs: number, kind: AmiKind) => {
    const a = minuteIndex(fromMs);
    const b = minuteIndex(toMs);
    for (let i = a; i < b; i++) kinds[i] = kind;
  };

  // Carry kind from last event before origin into the tape start.
  const lastBefore = lastAmiEventAt(sorted, origin);
  let cursorMs = origin;
  let open: AmiKind | "after_stop" | null = null;
  if (lastBefore) {
    if (lastBefore.type === "stop") open = "after_stop";
    else open = toCoverageKind(lastBefore.type);
  }

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]!;
    const t = eventTimeMs(ev);
    if (t >= end) break;
    if (t < origin) continue;

    // Paint open kind from cursor → this event.
    if (open === "work" || open === "break" || open === "other_work" || open === "non_work") {
      fill(cursorMs, t, open);
    } else {
      fill(cursorMs, t, "non_work");
    }

    if (ev.type === "stop") {
      open = "after_stop";
      cursorMs = t;
      continue;
    }

    open = toCoverageKind(ev.type);
    cursorMs = t;
  }

  // Tail to asOf
  if (open === "work" || open === "break" || open === "other_work" || open === "non_work") {
    fill(cursorMs, end, open);
  } else {
    fill(cursorMs, end, "non_work");
  }

  return { originMs: origin, endMs: end, kinds };
}

export function segmentsFromTape(tape: AmiTape): AmiSegment[] {
  const { kinds } = tape;
  if (kinds.length === 0) return [];
  const out: AmiSegment[] = [];
  let start = 0;
  let kind = kinds[0]!;
  for (let i = 1; i <= kinds.length; i++) {
    if (i === kinds.length || kinds[i] !== kind) {
      out.push({ startMinute: start, endMinute: i, kind });
      if (i < kinds.length) {
        start = i;
        kind = kinds[i]!;
      }
    }
  }
  return out;
}

export function tapeMinuteToMs(tape: AmiTape, minuteIndex: number): number {
  return tape.originMs + minuteIndex * MIN_MS;
}
