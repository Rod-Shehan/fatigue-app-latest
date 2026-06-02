/**
 * Rolling km validation for the same truck rego.
 * Ensures start_kms and end_kms are never lower than any previous saved entry for that rego.
 */

export type DayWithKms = {
  truck_rego?: string;
  start_kms?: number | null;
  end_kms?: number | null;
};

export type DayKmContext = DayWithKms & {
  events?: { type: string }[];
  work_time?: boolean[];
  breaks?: boolean[];
};

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Normalize rego for comparison (trim, case-insensitive). */
export function regoKey(rego: string): string {
  return rego.trim().toLowerCase();
}

function sameRego(a: string | undefined, b: string | undefined): boolean {
  return regoKey(a ?? "") === regoKey(b ?? "");
}

function serverMaxForRego(
  serverMaxByRego: Record<string, number | null> | undefined,
  rego: string
): number | null {
  if (!serverMaxByRego) return null;
  return serverMaxByRego[regoKey(rego)] ?? serverMaxByRego[rego.trim()] ?? null;
}

/**
 * Only days with driving activity (or km already entered) need start/end km at sign-off.
 * Skips empty days that only inherited rego on the card without a shift.
 */
export function dayRequiresKmEntry(day: DayKmContext): boolean {
  const rego = (day.truck_rego ?? "").trim();
  if (!rego) return false;
  if (day.start_kms != null || day.end_kms != null) return true;
  const events = day.events ?? [];
  if (events.some((e) => e.type === "work" || e.type === "stop" || e.type === "break" || e.type === "non_work")) {
    return true;
  }
  if ((day.work_time ?? []).some(Boolean)) return true;
  if ((day.breaks ?? []).some(Boolean)) return true;
  return false;
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

export type ValidateSheetKmsOptions = {
  /** Fleet-wide max end km per rego (from /api/rego-kms). Keys: normalized rego. */
  serverMaxByRego?: Record<string, number | null>;
};

/**
 * Validates driving days in the sheet: start/end km required and non-decreasing per rego.
 * Returns the first error message or null if valid.
 */
export function validateSheetKms(days: DayKmContext[], options?: ValidateSheetKmsOptions): string | null {
  const serverMaxByRego = options?.serverMaxByRego;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!dayRequiresKmEntry(d)) continue;
    const rego = (d.truck_rego ?? "").trim();
    const startKms = d.start_kms;
    const endKms = d.end_kms;
    const label = DAY_LABELS[i] ?? `Day ${i + 1}`;
    if (startKms == null || (typeof startKms === "number" && Number.isNaN(startKms))) {
      return `${label}: start km is required for ${rego}.`;
    }
    if (endKms == null || (typeof endKms === "number" && Number.isNaN(endKms))) {
      return `${label}: end km is required for ${rego}. Tap Edit day on that day and enter end kilometres.`;
    }
    const serverMax = serverMaxForRego(serverMaxByRego, rego);
    const result = validateDayKms(days, i, rego, startKms, endKms, serverMax);
    if (!result.valid) return `${label}: ${result.message ?? "invalid km."}`;
  }
  return null;
}

export type SheetKmIssue = {
  dayIndex: number;
  dayLabel: string;
  code: "missing_start" | "missing_end" | "start_too_low" | "end_invalid";
  message: string;
  /** Start km can be raised automatically from prior day / fleet record. */
  canAutoFixStart: boolean;
  suggestedStartKms?: number;
};

/** All km issues for sign-off UI (not just the first). */
export function getSheetKmIssues(
  days: DayKmContext[],
  options?: ValidateSheetKmsOptions
): SheetKmIssue[] {
  const serverMaxByRego = options?.serverMaxByRego;
  const issues: SheetKmIssue[] = [];

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!dayRequiresKmEntry(d)) continue;
    const rego = (d.truck_rego ?? "").trim();
    const label = DAY_LABELS[i] ?? `Day ${i + 1}`;
    const serverMax = serverMaxForRego(serverMaxByRego, rego);
    const minStart = getMinAllowedStartKms(days, i, rego, serverMax);

    const startKms = d.start_kms;
    const endKms = d.end_kms;

    if (startKms == null || (typeof startKms === "number" && Number.isNaN(startKms))) {
      issues.push({
        dayIndex: i,
        dayLabel: label,
        code: "missing_start",
        message: `Start km required for ${rego}.`,
        canAutoFixStart: minStart != null,
        suggestedStartKms: minStart ?? undefined,
      });
      continue;
    }

    if (minStart != null && startKms < minStart) {
      issues.push({
        dayIndex: i,
        dayLabel: label,
        code: "start_too_low",
        message: `Start km (${startKms}) is below last end km for this rego (${minStart}).`,
        canAutoFixStart: true,
        suggestedStartKms: minStart,
      });
    }

    if (endKms == null || (typeof endKms === "number" && Number.isNaN(endKms))) {
      issues.push({
        dayIndex: i,
        dayLabel: label,
        code: "missing_end",
        message: `End km required for ${rego}.`,
        canAutoFixStart: false,
      });
      continue;
    }

    const result = validateDayKms(days, i, rego, startKms, endKms, serverMax);
    if (!result.valid) {
      issues.push({
        dayIndex: i,
        dayLabel: label,
        code: "end_invalid",
        message: result.message ?? "Invalid end km.",
        canAutoFixStart: false,
      });
    }
  }

  return issues;
}

export type StartKmsFix = { dayIndex: number; from: number | null; to: number };

/**
 * Set each driving day's start_kms to the previous end km for that rego (and fleet floor when higher).
 * Does not invent end km — driver still enters those.
 */
export function chainRegoKmsAcrossSheet<T extends DayKmContext>(
  days: T[],
  serverMaxByRego: Record<string, number | null> = {}
): { days: T[]; startKmsFixes: StartKmsFix[] } {
  const next = days.map((d) => ({ ...d }));
  const runningEnd: Record<string, number | null> = {};
  const startKmsFixes: StartKmsFix[] = [];

  for (let i = 0; i < next.length; i++) {
    const d = next[i]!;
    const rego = (d.truck_rego ?? "").trim();
    if (!rego || !dayRequiresKmEntry(d)) continue;

    const key = regoKey(rego);
    const serverFloor = serverMaxForRego(serverMaxByRego, rego);
    let floor: number | null = runningEnd[key] ?? null;
    if (serverFloor != null) {
      floor = floor == null ? serverFloor : Math.max(floor, serverFloor);
    }

    if (floor != null) {
      const cur = d.start_kms;
      const curNum = cur != null && typeof cur === "number" && !Number.isNaN(cur) ? cur : null;
      if (curNum == null || curNum < floor) {
        startKmsFixes.push({ dayIndex: i, from: curNum, to: floor });
        next[i] = { ...d, start_kms: floor };
      }
    }

    const end = next[i]!.end_kms;
    if (end != null && typeof end === "number" && !Number.isNaN(end)) {
      const prev = runningEnd[key];
      runningEnd[key] = prev == null ? end : Math.max(prev, end);
    }
  }

  return { days: next, startKmsFixes };
}

/** Unique regos on days that require km, in week order. */
export function collectRegosNeedingKm(days: DayKmContext[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of days) {
    if (!dayRequiresKmEntry(d)) continue;
    const rego = (d.truck_rego ?? "").trim();
    const key = regoKey(rego);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(rego);
  }
  return out;
}
