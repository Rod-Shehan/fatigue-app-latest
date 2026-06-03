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
  days: DayKmContext[],
  dayIndex: number,
  rego: string
): number | null {
  let max: number | null = null;
  for (let i = 0; i < dayIndex && i < days.length; i++) {
    const d = days[i];
    if (!sameRego(d.truck_rego, rego)) continue;
    if (!dayRequiresKmEntry(d)) continue;
    const end = d.end_kms;
    if (end != null && typeof end === "number" && !Number.isNaN(end)) {
      if (max === null || end > max) max = end;
    }
  }
  return max;
}

/**
 * End km from the most recent earlier day in this week with the same rego (for chaining).
 */
export function getImmediatePriorSameRegoEndKms(
  days: DayKmContext[],
  dayIndex: number,
  rego: string
): number | null {
  for (let i = dayIndex - 1; i >= 0; i--) {
    const d = days[i];
    if (!sameRego(d.truck_rego, rego)) continue;
    if (!dayRequiresKmEntry(d)) continue;
    const end = d.end_kms;
    if (end != null && typeof end === "number" && !Number.isNaN(end)) {
      return end;
    }
  }
  return null;
}

/**
 * Minimum allowed start_kms on this day:
 * - When this week already has an earlier end km for this rego → that value (link days in order).
 * - Otherwise → fleet-wide max end km from other sheets (first driving day this week).
 */
export function getMinAllowedStartKms(
  days: DayKmContext[],
  dayIndex: number,
  rego: string,
  serverMaxEndKms: number | null
): number | null {
  const priorEndInWeek = getImmediatePriorSameRegoEndKms(days, dayIndex, rego);
  if (priorEndInWeek != null) return priorEndInWeek;
  return serverMaxEndKms;
}

/** Human-readable reason for the start-km floor (sign-fix UI). */
export function describeStartKmFloor(
  days: DayKmContext[],
  dayIndex: number,
  rego: string,
  serverMaxEndKms: number | null
): { value: number; source: "previous_day" | "fleet_record" } | null {
  const priorEndInWeek = getImmediatePriorSameRegoEndKms(days, dayIndex, rego);
  if (priorEndInWeek != null) return { value: priorEndInWeek, source: "previous_day" };
  if (serverMaxEndKms != null) return { value: serverMaxEndKms, source: "fleet_record" };
  return null;
}

export function formatKmReading(km: number): string {
  return Number(km).toLocaleString("en-AU");
}

/** Most recent earlier day in this week with an end km for the same rego. */
export function findPriorSameRegoEndWithLabel(
  days: DayKmContext[],
  dayIndex: number,
  rego: string
): { endKms: number; dayLabel: string } | null {
  for (let i = dayIndex - 1; i >= 0; i--) {
    const d = days[i];
    if (!sameRego(d.truck_rego, rego)) continue;
    if (!dayRequiresKmEntry(d)) continue;
    const end = d.end_kms;
    if (end != null && typeof end === "number" && !Number.isNaN(end)) {
      return { endKms: end, dayLabel: DAY_LABELS[i] ?? `Day ${i + 1}` };
    }
  }
  return null;
}

export type OdometerGuide = {
  /** Minimum start km allowed (same as validation floor). */
  minAllowed: number | null;
  /** End km from the previous driving day this week (same rego), if any. */
  priorEndKms: number | null;
  priorDayLabel: string | null;
  /** Last end km for this rego from earlier weeks / other sheets (when no prior day this week). */
  fleetEndKms: number | null;
};

/** Reference readings for the driver — not written into the form automatically. */
export function getOdometerGuideForDay(
  days: DayKmContext[],
  dayIndex: number,
  rego: string,
  serverMaxEndKms: number | null
): OdometerGuide | null {
  const trimmed = rego.trim();
  if (!trimmed) return null;

  const prior = findPriorSameRegoEndWithLabel(days, dayIndex, trimmed);
  const floor = describeStartKmFloor(days, dayIndex, trimmed, serverMaxEndKms);

  return {
    minAllowed: floor?.value ?? null,
    priorEndKms: prior?.endKms ?? null,
    priorDayLabel: prior?.dayLabel ?? null,
    fleetEndKms:
      prior == null && serverMaxEndKms != null && !Number.isNaN(serverMaxEndKms)
        ? serverMaxEndKms
        : null,
  };
}

/** One-line hint for under the start km field. */
export function formatOdometerGuideLine(guide: OdometerGuide | null): string | null {
  if (!guide) return null;
  if (guide.priorEndKms != null && guide.priorDayLabel) {
    return `Previous end ${formatKmReading(guide.priorEndKms)} (${guide.priorDayLabel})`;
  }
  if (guide.fleetEndKms != null) {
    return `Last recorded ${formatKmReading(guide.fleetEndKms)}`;
  }
  return null;
}

const FLEET_FLOOR_LABEL = "last end km from a previous week";

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
  days: DayKmContext[],
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

export type RegoKmFleetQuery = {
  /** Omit this sheet when loading fleet max (same week’s later days must not floor earlier days). */
  excludeSheetId?: string;
  /** Only count sheets with weekStarting strictly before this YYYY-MM-DD (omit future weeks). */
  beforeWeekStarting?: string;
};

export type ValidateSheetKmsOptions = {
  /** Fleet max end km per rego from prior weeks / other sheets. Keys: normalized rego. */
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
      const floor = describeStartKmFloor(days, i, rego, serverMax);
      const floorHint =
        floor?.source === "fleet_record"
          ? `${FLEET_FLOOR_LABEL} (${minStart})`
          : `previous day end km (${minStart})`;
      issues.push({
        dayIndex: i,
        dayLabel: label,
        code: "start_too_low",
        message: `Start km (${startKms}) must be at least ${floorHint}.`,
        canAutoFixStart: true,
        suggestedStartKms: minStart,
      });
      continue;
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
      const msg = result.message ?? "Invalid km.";
      const isStartProblem = msg.toLowerCase().includes("start km");
      issues.push({
        dayIndex: i,
        dayLabel: label,
        code: isStartProblem ? "start_too_low" : "end_invalid",
        message: msg,
        canAutoFixStart: isStartProblem,
        suggestedStartKms: isStartProblem ? minStart ?? undefined : undefined,
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
    // Fleet floor only when this is the first driving day for this rego in the week; otherwise chain from prior end.
    let floor: number | null = runningEnd[key] ?? null;
    if (floor == null) {
      floor = serverFloor;
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
