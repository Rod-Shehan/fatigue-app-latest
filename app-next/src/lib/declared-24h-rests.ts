/**
 * Declared solo 24h non-work rests (Reg 184E(2)(b)) when the logged timeline
 * cannot yet prove ≥2×24h (or the 28-day alternative).
 *
 * RULE IP — wiring into compliance needs owner approval; this module is the
 * shared predicate + counting used by UI and compliance.
 */

import { MINUTES_PER_DAY, normalizeDayCoverageArrays } from "@/lib/coverage/derive-minute-coverage";
import { formatDateLocal } from "@/lib/weeks";

export const MINUTES_14D = 14 * MINUTES_PER_DAY;
export const MINUTES_28D = 28 * MINUTES_PER_DAY;
export const MINUTES_24H = 24 * 60;
export const MAX_WORK_MINUTES_14D_ALT = 144 * 60;

export type Declared24hRestFields = {
  last_24h_rest_1?: string | null;
  last_24h_rest_2?: string | null;
  last_24h_rest_3?: string | null;
  last_24h_rest_4?: string | null;
  last_24h_rest_1_start?: string | null;
  last_24h_rest_1_end?: string | null;
  last_24h_rest_2_start?: string | null;
  last_24h_rest_2_end?: string | null;
  last_24h_rest_3_start?: string | null;
  last_24h_rest_3_end?: string | null;
  last_24h_rest_4_start?: string | null;
  last_24h_rest_4_end?: string | null;
};

export type Declared24hRestKey =
  | "last_24h_rest_1"
  | "last_24h_rest_2"
  | "last_24h_rest_3"
  | "last_24h_rest_4";

export const DECLARED_24H_REST_KEYS: Declared24hRestKey[] = [
  "last_24h_rest_1",
  "last_24h_rest_2",
  "last_24h_rest_3",
  "last_24h_rest_4",
];

export function declaredRestRangeKeys(key: Declared24hRestKey): {
  start: keyof Declared24hRestFields;
  end: keyof Declared24hRestFields;
} {
  return {
    start: `${key}_start` as keyof Declared24hRestFields,
    end: `${key}_end` as keyof Declared24hRestFields,
  };
}

export type Declared24hRestRequirement = {
  /** 0 = hide UI; 2 = first-28d / option (i); 4 = 28-day alternative path only */
  fieldCount: 0 | 2 | 4;
  reason: "none" | "need_2" | "need_4";
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function addCalendarDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return formatDateLocal(date);
}

/** Unique YYYY-MM-DD values, order preserved. */
export function collectDeclared24hRests(
  fields: Declared24hRestFields | null | undefined
): string[] {
  if (!fields) return [];
  const raw = [
    fields.last_24h_rest_1,
    fields.last_24h_rest_2,
    fields.last_24h_rest_3,
    fields.last_24h_rest_4,
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const s = typeof v === "string" ? v.trim() : "";
    if (!YMD_RE.test(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Count full non-work periods of length `periodMinutes` on a minute boolean timeline. */
export function countFullNonWorkPeriods(nonWork: boolean[], periodMinutes: number): number {
  if (periodMinutes <= 0) return 0;
  let periods = 0;
  let run = 0;
  for (let i = 0; i < nonWork.length; i++) {
    if (nonWork[i]) {
      run += 1;
      continue;
    }
    if (run > 0) periods += Math.floor(run / periodMinutes);
    run = 0;
  }
  if (run > 0) periods += Math.floor(run / periodMinutes);
  return periods;
}

function workMinutesPrefix(work: boolean[]): number[] {
  const pref = new Array(work.length + 1);
  pref[0] = 0;
  for (let i = 0; i < work.length; i++) pref[i + 1] = pref[i] + (work[i] ? 1 : 0);
  return pref;
}

export function anyRollingWorkWindowExceeds(
  work: boolean[],
  windowMinutes: number,
  maxWorkMinutes: number
): boolean {
  if (windowMinutes <= 0 || work.length < windowMinutes) return false;
  const pref = workMinutesPrefix(work);
  for (let start = 0; start <= work.length - windowMinutes; start++) {
    const w = pref[start + windowMinutes] - pref[start];
    if (w > maxWorkMinutes) return true;
  }
  return false;
}

function isFullNonWorkCalendarDay(nonWork: boolean[], dayIndex: number): boolean {
  const start = dayIndex * MINUTES_PER_DAY;
  const end = start + MINUTES_PER_DAY;
  if (end > nonWork.length) return false;
  for (let i = start; i < end; i++) {
    if (!nonWork[i]) return false;
  }
  return true;
}

/**
 * Logged 24h periods in `nonWork` plus declared dates that are not already a
 * full non-work calendar day on the grid (or that fall outside the grid).
 */
export function countEffective24hPeriods(
  nonWork: boolean[],
  timelineStartYmd: string,
  declared: string[]
): number {
  let n = countFullNonWorkPeriods(nonWork, MINUTES_24H);
  if (!declared.length || !timelineStartYmd) return n;

  const totalDays = Math.floor(nonWork.length / MINUTES_PER_DAY);
  for (const d of declared) {
    const dayOffset = calendarDayOffset(timelineStartYmd, d);
    if (dayOffset == null) continue;
    if (dayOffset < 0 || dayOffset >= totalDays) {
      n += 1;
      continue;
    }
    if (!isFullNonWorkCalendarDay(nonWork, dayOffset)) n += 1;
  }
  return n;
}

/** Days from startYmd to targetYmd (0 = same day). */
export function calendarDayOffset(startYmd: string, targetYmd: string): number | null {
  if (!YMD_RE.test(startYmd) || !YMD_RE.test(targetYmd)) return null;
  const [ys, ms, ds] = startYmd.split("-").map(Number);
  const [yt, mt, dt] = targetYmd.split("-").map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(yt, mt - 1, dt);
  return Math.round((b - a) / 86400000);
}

export function timelineStartYmdFromPriorDays(
  weekStarting: string,
  priorDayCount: number
): string {
  return addCalendarDays(weekStarting, -priorDayCount);
}

export function option14Satisfied(
  nonWork: boolean[],
  timelineStartYmd: string,
  declared: string[]
): boolean {
  if (nonWork.length < MINUTES_14D) {
    // Cold start / short history: declarations carry the absolute.
    return collectDeclaredUniqueCount(declared) >= 2 || countEffective24hPeriods(nonWork, timelineStartYmd, declared) >= 2;
  }
  const e = nonWork.length;
  const slice = nonWork.slice(e - MINUTES_14D, e);
  const sliceStart = addCalendarDays(timelineStartYmd, Math.floor((e - MINUTES_14D) / MINUTES_PER_DAY));
  return countEffective24hPeriods(slice, sliceStart, declared) >= 2;
}

function collectDeclaredUniqueCount(declared: string[]): number {
  return new Set(declared).size;
}

export function option28Satisfied(
  nonWork: boolean[],
  work: boolean[],
  timelineStartYmd: string,
  declared: string[]
): boolean {
  if (nonWork.length < MINUTES_28D) return false;
  const e = nonWork.length;
  const nw = nonWork.slice(e - MINUTES_28D, e);
  const wk = work.slice(e - MINUTES_28D, e);
  const sliceStart = addCalendarDays(timelineStartYmd, Math.floor((e - MINUTES_28D) / MINUTES_PER_DAY));
  if (countEffective24hPeriods(nw, sliceStart, declared) < 4) return false;
  return !anyRollingWorkWindowExceeds(wk, MINUTES_14D, MAX_WORK_MINUTES_14D_ALT);
}

/**
 * Whether the Set up day UI should ask for declared 24h rest dates.
 * Never asks for 4 fields until ≥28 days of timeline exist (first 28 days → 2 only).
 */
export function getDeclared24hRestRequirement(input: {
  driverType?: string | null;
  nonWork: boolean[];
  work: boolean[];
  timelineStartYmd: string;
  declared: string[];
}): Declared24hRestRequirement {
  if ((input.driverType || "solo") === "two_up") {
    return { fieldCount: 0, reason: "none" };
  }

  const { nonWork, work, timelineStartYmd, declared } = input;

  if (option14Satisfied(nonWork, timelineStartYmd, declared)) {
    return { fieldCount: 0, reason: "none" };
  }

  // Prefer option (i) with 2 declarations whenever history is under 28 days.
  if (nonWork.length < MINUTES_28D) {
    return { fieldCount: 2, reason: "need_2" };
  }

  if (option28Satisfied(nonWork, work, timelineStartYmd, declared)) {
    return { fieldCount: 0, reason: "none" };
  }

  // ≥28 days of grid, option (i) still fails even with current decls → 28-day path needs 4.
  if (collectDeclaredUniqueCount(declared) >= 2) {
    // Two decls weren't enough for option (i) on this dense timeline — ask for four for alt.
    return { fieldCount: 4, reason: "need_4" };
  }

  return { fieldCount: 2, reason: "need_2" };
}

/** Build requirement from sheet day grids + prior history (UI entry). */
export function getDeclared24hRestRequirementFromSheets(input: {
  driverType?: string | null;
  weekStarting: string;
  days: Array<{ work_time?: boolean[]; non_work?: boolean[] }>;
  prevWeekDays?: Array<{ work_time?: boolean[]; non_work?: boolean[] }> | null;
  historyDays?: Array<{ work_time?: boolean[]; non_work?: boolean[] }> | null;
  declaredFields: Declared24hRestFields;
}): Declared24hRestRequirement {
  const history = (input.historyDays ?? []).map((d) => normalizeDayCoverageArrays(d));
  const prev = (input.prevWeekDays ?? []).map((d) => normalizeDayCoverageArrays(d));
  const current = input.days.map((d) => normalizeDayCoverageArrays(d));
  const combined = [...history, ...prev, ...current];
  const nonWork = combined.flatMap((d) => d.non_work.slice(0, MINUTES_PER_DAY));
  const work = combined.flatMap((d) => d.work_time.slice(0, MINUTES_PER_DAY));
  const priorDayCount = history.length + prev.length;
  const timelineStartYmd = input.weekStarting
    ? timelineStartYmdFromPriorDays(input.weekStarting, priorDayCount)
    : "";
  return getDeclared24hRestRequirement({
    driverType: input.driverType,
    nonWork,
    work,
    timelineStartYmd,
    declared: collectDeclared24hRests(input.declaredFields),
  });
}

export function declared24hRestsFromSheet(sheet: Declared24hRestFields): Declared24hRestFields {
  return {
    last_24h_rest_1: sheet.last_24h_rest_1 ?? null,
    last_24h_rest_2: sheet.last_24h_rest_2 ?? null,
    last_24h_rest_3: sheet.last_24h_rest_3 ?? null,
    last_24h_rest_4: sheet.last_24h_rest_4 ?? null,
    last_24h_rest_1_start: sheet.last_24h_rest_1_start ?? null,
    last_24h_rest_1_end: sheet.last_24h_rest_1_end ?? null,
    last_24h_rest_2_start: sheet.last_24h_rest_2_start ?? null,
    last_24h_rest_2_end: sheet.last_24h_rest_2_end ?? null,
    last_24h_rest_3_start: sheet.last_24h_rest_3_start ?? null,
    last_24h_rest_3_end: sheet.last_24h_rest_3_end ?? null,
    last_24h_rest_4_start: sheet.last_24h_rest_4_start ?? null,
    last_24h_rest_4_end: sheet.last_24h_rest_4_end ?? null,
  };
}

/**
 * Soft-reset fields for AMI / legacy: the declared rest with the latest end instant.
 * Calendar last24hBreak is derived from that range start (Perth YMD).
 */
export function softResetFieldsFromDeclaredRests(
  fields: Declared24hRestFields,
  isoToPerthYmd: (iso: string) => string | null
): {
  last_24h_break: string;
  last_24h_break_start: string;
  last_24h_break_end: string;
} {
  let best: { start: string; end: string; endMs: number } | null = null;
  for (const key of DECLARED_24H_REST_KEYS) {
    const { start, end } = declaredRestRangeKeys(key);
    const startIso = fields[start]?.toString().trim() ?? "";
    const endIso = fields[end]?.toString().trim() ?? "";
    if (!startIso || !endIso) continue;
    const endMs = Date.parse(endIso);
    if (!Number.isFinite(endMs)) continue;
    if (!best || endMs > best.endMs) best = { start: startIso, end: endIso, endMs };
  }
  if (!best) {
    return { last_24h_break: "", last_24h_break_start: "", last_24h_break_end: "" };
  }
  return {
    last_24h_break: isoToPerthYmd(best.start) ?? "",
    last_24h_break_start: best.start,
    last_24h_break_end: best.end,
  };
}

/**
 * One-shot hydrate: copy legacy sheet soft-reset range into the matching declared
 * rest slot when that slot has a date (or is empty) but no absolute times yet.
 * Does not invent rests — only seeds times onto an existing/empty slot.
 */
export function seedSoftResetRangeIntoDeclaredRests(input: {
  fields: Declared24hRestFields;
  last24hBreak?: string | null;
  last24hBreakStart?: string | null;
  last24hBreakEnd?: string | null;
  isoToPerthYmd: (iso: string) => string | null;
}): Declared24hRestFields {
  const startIso = input.last24hBreakStart?.trim() ?? "";
  const endIso = input.last24hBreakEnd?.trim() ?? "";
  if (!startIso || !endIso) return { ...input.fields };

  const already = softResetFieldsFromDeclaredRests(input.fields, input.isoToPerthYmd);
  if (already.last_24h_break_start && already.last_24h_break_end) {
    return { ...input.fields };
  }

  const softYmd =
    (input.last24hBreak?.trim() || input.isoToPerthYmd(startIso) || "").trim();
  const out: Declared24hRestFields = { ...input.fields };

  const matchKey =
    DECLARED_24H_REST_KEYS.find((key) => (out[key]?.toString().trim() ?? "") === softYmd) ??
    [...DECLARED_24H_REST_KEYS].reverse().find((key) => {
      const ymd = out[key]?.toString().trim() ?? "";
      const { start, end } = declaredRestRangeKeys(key);
      const hasRange = !!(out[start]?.toString().trim() && out[end]?.toString().trim());
      return !!ymd && !hasRange;
    }) ??
    ("last_24h_rest_1" as Declared24hRestKey);

  const { start, end } = declaredRestRangeKeys(matchKey);
  out[matchKey] = softYmd || input.isoToPerthYmd(startIso) || out[matchKey] || null;
  out[start] = startIso;
  out[end] = endIso;
  return out;
}

/** Required declared rests not yet saved with absolute start+end. */
export function declared24hRestsIncomplete(
  fieldCount: 0 | 2 | 4,
  fields: Declared24hRestFields
): boolean {
  if (fieldCount < 2) return false;
  const keys =
    fieldCount === 4
      ? DECLARED_24H_REST_KEYS
      : (["last_24h_rest_1", "last_24h_rest_2"] as Declared24hRestKey[]);
  return keys.some((k) => {
    const { start, end } = declaredRestRangeKeys(k);
    const startIso = fields[start]?.toString().trim() ?? "";
    const endIso = fields[end]?.toString().trim() ?? "";
    return !startIso || !endIso;
  });
}

/** LogBar / compliance dialog — opens Set up day for header record fields. */
export const SETUP_WEEK_RECORD_BUTTON_LABEL = "Set up week record";

export {
  complianceMessagesFixableInDaySetup,
  isComplianceMessageFixableInDaySetup,
} from "@/lib/compliance-fix-routes";

/** ESL copy for the declaration block (driver UI + guides). */
export const DECLARED_24H_REST_COPY = {
  TITLE_2: "Last 2 × 24 hour non-work breaks",
  TITLE_4: "Last 4 × 24 hour non-work breaks",
  WHY_2:
    "The fatigue rules need two full days of non-work (each 24 hours) in any 14-day period. This week is your legal record. If the app does not yet have enough of your past days to show those rests, you must enter the start and end of each break yourself. Signing the week means you say this is true.",
  WHY_4:
    "The 28-day alternative needs four full days of non-work (each 24 hours), and no more than 144 hours of work in any 14 days inside that period. Enter the start and end of each rest the record relies on. Signing the week means you say this is true.",
  LABEL_1: "First 24 hour non-work break",
  LABEL_2: "Second 24 hour non-work break",
  LABEL_3: "Third 24 hour non-work break",
  LABEL_4: "Fourth 24 hour non-work break",
  LOCKED_HINT: "Locked after sign-off — ask your manager to amend.",
  EDITABLE_HINT: "Set start and end times (Perth). You can change these until you sign the week. The most recent end also resets short-horizon rules (17h / 72h).",
  MANAGER_HINT:
    "Full 24 hour non-work breaks when logs cannot prove Reg 184E 2×24h. Enter absolute start and end; ask the driver to sign again after amendment.",
} as const;

function declaredRestSlotFilled(fields: Declared24hRestFields, key: Declared24hRestKey): boolean {
  if (fields[key]?.toString().trim()) return true;
  const { start, end } = declaredRestRangeKeys(key);
  return !!(fields[start]?.toString().trim() && fields[end]?.toString().trim());
}

/** Driver Set up day + manager amend — show 2/4 fields when required or when dates/times already saved. */
export function getDeclared24hRestUiFieldCount(
  requirement: Declared24hRestRequirement,
  fields: Declared24hRestFields
): 0 | 2 | 4 {
  if (requirement.fieldCount > 0) return requirement.fieldCount;
  const n = DECLARED_24H_REST_KEYS.filter((k) => declaredRestSlotFilled(fields, k)).length;
  if (n >= 4) return 4;
  if (n >= 1) return 2;
  return 0;
}

/**
 * When compliance already flags 2×24h / rolling rest gaps, always expose the declaration
 * fields — even if the UI requirement momentarily disagrees (timeline shape mismatch).
 */
export function declaredRestFieldCountFromComplianceMessages(messages: string[]): 0 | 2 | 4 {
  let need: 0 | 2 | 4 = 0;
  for (const message of messages) {
    const m = message.toLowerCase();
    if (
      m.includes("2×24h") ||
      m.includes("2x24h") ||
      m.includes("28-day alternative") ||
      m.includes("rolling 14-day non-work gap")
    ) {
      need = 2;
      if (m.includes("4×24h") || m.includes("4x24h")) need = 4;
    }
  }
  return need;
}

/** Prefer the larger of requirement-based UI count and compliance-driven need. */
export function resolveDeclared24hRestUiFieldCount(input: {
  requirement: Declared24hRestRequirement;
  fields: Declared24hRestFields;
  complianceMessages?: string[];
}): 0 | 2 | 4 {
  const fromReq = getDeclared24hRestUiFieldCount(input.requirement, input.fields);
  const fromComp = declaredRestFieldCountFromComplianceMessages(input.complianceMessages ?? []);
  if (fromReq === 4 || fromComp === 4) return 4;
  if (fromReq >= 2 || fromComp >= 2) return 2;
  return 0;
}
