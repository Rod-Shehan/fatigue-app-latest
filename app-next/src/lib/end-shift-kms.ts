/**
 * End km must accompany any End shift (stop) on the record.
 * Live End shift uses EndShiftCorrectionDialog; Edit day must require the same field.
 */

export const END_SHIFT_END_KM_REQUIRED_MESSAGE =
  "End km is required when End shift is on this day's record.";

export function dayEventsIncludeStop(
  events: { type: string }[] | null | undefined
): boolean {
  return (events ?? []).some((e) => e.type === "stop");
}

/**
 * When a stop is present, end km must be a finite number ≥ 0.
 * Returns an error message or null if OK.
 */
export function validateEndKmsRequiredForStop(
  events: { type: string }[] | null | undefined,
  endKms: number | null | undefined
): string | null {
  if (!dayEventsIncludeStop(events)) return null;
  if (endKms == null || Number.isNaN(Number(endKms)) || Number(endKms) < 0) {
    return END_SHIFT_END_KM_REQUIRED_MESSAGE;
  }
  return null;
}
