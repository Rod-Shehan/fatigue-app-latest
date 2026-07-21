/**
 * End km must accompany any End shift (stop) on the record.
 * Live End shift uses EndShiftCorrectionDialog; Edit day must require the same field.
 *
 * Overnight close: stop may sit on the finish calendar day while end km is stored on
 * the open-shift start day (driver habit: end km on Monday, same reading as Tuesday start).
 */

export const END_SHIFT_END_KM_REQUIRED_MESSAGE =
  "End km is required when End shift is on this day's record.";

export function dayEventsIncludeStop(
  events: { type: string }[] | null | undefined
): boolean {
  return (events ?? []).some((e) => e.type === "stop");
}

export type EndKmsForStopOptions = {
  /** Full week cards — used to accept overnight km on the prior day. */
  sheetDays?: { end_kms?: number | null; start_kms?: number | null }[];
  dayIndex?: number;
  /** This card's start km (draft), for odometer-chain match with prior end. */
  dayStartKms?: number | null;
};

function finiteKm(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value)) || Number(value) < 0) return null;
  return Number(value);
}

/**
 * When a stop is present, end km must be on this card — unless the prior card already
 * holds the overnight end km (and this card's start matches that chain).
 */
export function validateEndKmsRequiredForStop(
  events: { type: string }[] | null | undefined,
  endKms: number | null | undefined,
  options?: EndKmsForStopOptions
): string | null {
  if (!dayEventsIncludeStop(events)) return null;
  if (finiteKm(endKms) != null) return null;

  const days = options?.sheetDays;
  const idx = options?.dayIndex;
  if (days && idx != null && idx > 0) {
    const priorEnd = finiteKm(days[idx - 1]?.end_kms);
    if (priorEnd != null) {
      const start = finiteKm(options?.dayStartKms);
      // Prior day closed the odometer; this card only holds the finish-time stop
      // and/or the next shift's start reading at the same km.
      if (start == null || start === priorEnd) return null;
    }
  }

  return END_SHIFT_END_KM_REQUIRED_MESSAGE;
}
