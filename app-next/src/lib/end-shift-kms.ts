import { isTrueShiftContinuation } from "@/lib/day-route-carry";

/**
 * End km must accompany any End shift (stop) on the record.
 * Live End shift uses EndShiftCorrectionDialog; Edit day must require the same field.
 *
 * One shift, one end km. The stop may sit on a later day label; end km stays on the
 * card that holds the shift's start km. A new shift after that stop needs its own km.
 */

export const END_SHIFT_END_KM_REQUIRED_MESSAGE =
  "End km is required when End shift is on this day's record. For overnight, enter it on the previous day's card (or here if that day has none).";

export function dayEventsIncludeStop(
  events: { type: string }[] | null | undefined
): boolean {
  return (events ?? []).some((e) => e.type === "stop");
}

export type DayEventForStopKm = { type: string; time?: string };

export type EndKmsForStopOptions = {
  /** Full week cards — used to accept overnight km on the prior day. */
  sheetDays?: {
    end_kms?: number | null;
    start_kms?: number | null;
    events?: DayEventForStopKm[];
  }[];
  dayIndex?: number;
  /** @deprecated Unused — overnight cover uses prior-day end km + event order. */
  dayStartKms?: number | null;
};

function finiteKm(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value)) || Number(value) < 0) return null;
  return Number(value);
}

function eventTimeMs(time: string): number {
  const ms = new Date(time).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * True when work/break was logged on this card before the last End shift —
 * same-calendar-day close; end km belongs on this card.
 * Overnight finish cards typically only have the stop (work lived on the prior card).
 */
export function hasWorkOrBreakBeforeLastStop(
  events: DayEventForStopKm[] | null | undefined
): boolean {
  const list = events ?? [];
  let lastStopMs = -Infinity;
  for (const e of list) {
    if (e.type !== "stop") continue;
    const t = eventTimeMs(e.time ?? "");
    if (Number.isFinite(t) && t >= lastStopMs) lastStopMs = t;
  }
  if (!Number.isFinite(lastStopMs) || lastStopMs === -Infinity) return false;
  return list.some((e) => {
    if (e.type !== "work" && e.type !== "break" && e.type !== "other_work") return false;
    const t = eventTimeMs(e.time ?? "");
    return Number.isFinite(t) && t < lastStopMs;
  });
}

export function hasWorkOrBreakAfterLastStop(
  events: DayEventForStopKm[] | null | undefined
): boolean {
  const list = events ?? [];
  let lastStopMs = -Infinity;
  for (const e of list) {
    if (e.type !== "stop") continue;
    const t = eventTimeMs(e.time ?? "");
    if (Number.isFinite(t) && t >= lastStopMs) lastStopMs = t;
  }
  if (!Number.isFinite(lastStopMs) || lastStopMs === -Infinity) return false;
  return list.some((e) => {
    if (e.type !== "work" && e.type !== "break" && e.type !== "other_work") return false;
    const t = eventTimeMs(e.time ?? "");
    return Number.isFinite(t) && t > lastStopMs;
  });
}

/**
 * Stop on this label, end km already on the shift's start card.
 * Rest/drive on this label before the stop is still the same shift.
 * A new shift on this card (work after this stop) is not covered.
 */
export function overnightStopCoveredByPriorEndKm(
  events: DayEventForStopKm[] | null | undefined,
  endKms: number | null | undefined,
  options?: EndKmsForStopOptions
): boolean {
  if (!dayEventsIncludeStop(events)) return false;
  if (finiteKm(endKms) != null) return true;

  const days = options?.sheetDays;
  const idx = options?.dayIndex;
  if (!days || idx == null || idx <= 0) return false;
  if (finiteKm(days[idx - 1]?.end_kms) == null) return false;

  if (hasWorkOrBreakBeforeLastStop(events) && !isTrueShiftContinuation(days, idx)) {
    return false;
  }
  return true;
}

/**
 * When a stop is present, end km must be on this card — unless this is an overnight
 * finish card whose end km already sits on the previous day.
 */
export function validateEndKmsRequiredForStop(
  events: DayEventForStopKm[] | null | undefined,
  endKms: number | null | undefined,
  options?: EndKmsForStopOptions
): string | null {
  if (!dayEventsIncludeStop(events)) return null;
  if (finiteKm(endKms) != null) return null;

  if (overnightStopCoveredByPriorEndKm(events, endKms, options)) {
    return null;
  }

  return END_SHIFT_END_KM_REQUIRED_MESSAGE;
}
