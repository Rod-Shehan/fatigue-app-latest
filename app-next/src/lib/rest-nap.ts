/**
 * In-shift nap is a qualifier on Rest (`break`), not a fifth activity.
 * Diary / PDF / coverage still see Rest. FRMS uses `napFrom` from that tap
 * until the next logged event.
 */

export type RestNapEvent = {
  time: string;
  type: string;
  napFrom?: string | null;
  driver?: "primary" | "second";
};

export type RestNapWindow = { startMs: number; endMs: number };

function eventMs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export function isRestNapTagged(ev: RestNapEvent | null | undefined): boolean {
  if (!ev || ev.type !== "break") return false;
  return Number.isFinite(eventMs(ev.napFrom));
}

/** Last sheet-owner event is Rest with a nap tag (live "On nap"). */
export function openRestIsNapping(events: RestNapEvent[]): boolean {
  const last = events[events.length - 1];
  return isRestNapTagged(last);
}

/**
 * FRMS windows: nap starts at `napFrom` (not before the Rest tap) and ends at
 * the next event. An open Rest is capped at `nowMs` so we do not invent future sleep.
 */
export function taggedRestNapWindowsFromEvents(
  events: RestNapEvent[],
  nowMs: number,
  horizonEndMs = nowMs
): RestNapWindow[] {
  const sorted = events
    .filter((ev) => ev.driver !== "second")
    .map((ev) => ({ ev, ms: eventMs(ev.time) }))
    .filter((row) => Number.isFinite(row.ms))
    .sort((a, b) => a.ms - b.ms);

  const windows: RestNapWindow[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (!isRestNapTagged(row.ev)) continue;
    const fromMs = eventMs(row.ev.napFrom);
    const startMs = Math.max(row.ms, fromMs);
    const nextMs = i + 1 < sorted.length ? sorted[i + 1].ms : Math.min(horizonEndMs, nowMs);
    if (!(nextMs > startMs)) continue;
    windows.push({ startMs, endMs: nextMs });
  }
  return windows;
}

export function restNapOverlapsBlock(
  blockStartMs: number,
  blockMs: number,
  windows: RestNapWindow[]
): boolean {
  const blockEnd = blockStartMs + blockMs;
  const majority = blockMs / 2;
  for (const w of windows) {
    const overlap = Math.min(blockEnd, w.endMs) - Math.max(blockStartMs, w.startMs);
    if (overlap >= majority) return true;
  }
  return false;
}

type DayWithEvents = { events?: RestNapEvent[] };

/**
 * Set or clear `napFrom` on the open Rest (last owner event). Returns the
 * same array reference when there is nothing to patch.
 */
export function patchOpenRestNapFrom<T extends DayWithEvents>(
  days: T[],
  napFromIso: string | null
): T[] {
  const indexed: { dayIndex: number; eventIndex: number; ev: RestNapEvent }[] = [];
  days.forEach((day, dayIndex) => {
    (day.events ?? []).forEach((ev, eventIndex) => {
      if (ev.driver === "second") return;
      indexed.push({ dayIndex, eventIndex, ev });
    });
  });
  indexed.sort((a, b) => eventMs(a.ev.time) - eventMs(b.ev.time));
  const last = indexed[indexed.length - 1];
  if (!last || last.ev.type !== "break") return days;

  const currentFrom = last.ev.napFrom ?? null;
  if (!napFromIso && !currentFrom) return days;

  let nextFrom: string | undefined;
  if (napFromIso) {
    const restMs = eventMs(last.ev.time);
    const fromMs = eventMs(napFromIso);
    const clamped =
      Number.isFinite(restMs) && Number.isFinite(fromMs) ? Math.max(restMs, fromMs) : fromMs;
    if (!Number.isFinite(clamped)) return days;
    nextFrom = new Date(clamped).toISOString();
    if (currentFrom === nextFrom) return days;
  } else if (!currentFrom) {
    return days;
  }

  return days.map((day, i) => {
    if (i !== last.dayIndex) return day;
    const events = [...(day.events ?? [])];
    const current = events[last.eventIndex];
    if (!current) return day;
    const next = { ...current };
    if (nextFrom) next.napFrom = nextFrom;
    else delete next.napFrom;
    events[last.eventIndex] = next;
    return { ...day, events };
  });
}
