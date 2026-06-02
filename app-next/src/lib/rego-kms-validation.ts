/**
 * Rolling km validation for the same truck rego.
 * Ensures start_kms and end_kms are never lower than any previous saved entry for that rego.
 */

export type DayWithKms = {
  truck_rego?: string;
  start_kms?: number | null;
  end_kms?: number | null;
};

/** Normalize rego for comparison (trim, case-insensitive). */
function sameRego(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/**
 * Returns the maximum end_kms from previous days (0..dayIndex-1) that have the same rego.
 * Used to enforce: this day's start_kms must be >= this value.
 */
export function getLocalMaxEndKmsForRego(
  days: DayWithKms[],
  dayIndex: number,
  rego: string
): number | null {
  let max: number | null = null;
  for (let i = 0; i < dayIndex && i < days.length; i++) {
    const d = days[i];
    if (!sameRego(d.truck_rego, rego)) continue;
    const end = d.end_kms;
    if (end != null && typeof end === "number" && !Number.isNaN(end)) {
      if (max === null || end > max) max = end;
    }
  }
  return max;
}

/**
 * Minimum allowed value for start_kms on this day for this rego.
 * Either serverMaxEndKms (from other sheets) or local previous max, whichever is higher.
 */
export function getMinAllowedStartKms(
  days: DayWithKms[],
  dayIndex: number,
  rego: string,
  serverMaxEndKms: number | null
): number | null {
  const localMax = getLocalMaxEndKmsForRego(days, dayIndex, rego);
  if (localMax === null && serverMaxEndKms === null) return null;
  if (localMax === null) return serverMaxEndKms;
  if (serverMaxEndKms === null) return localMax;
  return Math.max(localMax, serverMaxEndKms);
}

export type ValidateKmsResult = {
  valid: boolean;
  message?: string;
};

/**
 * Validates start_kms and end_kms for a day with the given rego.
 * - start_kms must be >= minAllowed (from previous days + server).
 * - end_kms must be >= start_kms and >= minAllowed.
 */
export function validateDayKms(
  days: DayWithKms[],
  dayIndex: number,
  rego: string,
  startKms: number | null,
  endKms: number | null,
  serverMaxEndKms: number | null
): ValidateKmsResult {
  if (rego.trim() === "") {
    return { valid: true }; // no rego = no rolling check
  }

  const minAllowed = getMinAllowedStartKms(days, dayIndex, rego, serverMaxEndKms);

  if (startKms != null) {
    if (minAllowed != null && startKms < minAllowed) {
      return {
        valid: false,
        message: `Start km (${startKms}) cannot be lower than the last recorded end km for this rego (${minAllowed}).`,
      };
    }
  }

  if (endKms != null) {
    if (minAllowed != null && endKms < minAllowed) {
      return {
        valid: false,
        message: `End km (${endKms}) cannot be lower than the last recorded end km for this rego (${minAllowed}).`,
      };
    }
    if (startKms != null && endKms < startKms) {
      return {
        valid: false,
        message: `End km (${endKms}) cannot be less than start km (${startKms}).`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates all days in the sheet: for any day with a rego, both start_kms and end_kms
 * are required and must form a non-decreasing sequence for that rego (local only).
 * Returns the first error message or null if valid.
 */
export function validateSheetKms(days: DayWithKms[]): string | null {
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const rego = (d.truck_rego ?? "").trim();
    if (rego === "") continue;
    const startKms = d.start_kms;
    const endKms = d.end_kms;
    if (startKms == null || (typeof startKms === "number" && Number.isNaN(startKms))) {
      return `Day ${i + 1}: start km is required when rego is set.`;
    }
    if (endKms == null || (typeof endKms === "number" && Number.isNaN(endKms))) {
      return `Day ${i + 1}: end km is required when rego is set. Open Edit route on that day and enter end kilometres.`;
    }
    const result = validateDayKms(days, i, rego, startKms, endKms, null);
    if (!result.valid) return result.message ?? `Day ${i + 1}: invalid km.`;
  }
  return null;
}
