import {
  listCompletedChecklistsOfType,
  type ChecklistRecord,
  type ChecklistRecordType,
} from "@/lib/checklist";
import { weekEndingDateLabel } from "@/lib/worksafe-day-sheet/weekly-trip-sheet";
import { isPastRegulatoryWeek, normalizeWeekDateString } from "@/lib/weeks";

export type RecordsChecklistCounts = Record<ChecklistRecordType, number>;

export const EMPTY_RECORDS_CHECKLIST_COUNTS: RecordsChecklistCounts = {
  ffw: 0,
  prestart: 0,
  dimension_load: 0,
};

export function normalizeRosterName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

/** Sheets whose driver_name matches the roster name (case-insensitive). */
export function sheetsForRosterDriver<T extends { driver_name?: string | null }>(
  sheets: T[],
  driverName: string
): T[] {
  const key = normalizeRosterName(driverName);
  if (!key) return [];
  return sheets.filter((s) => normalizeRosterName(s.driver_name) === key);
}

export function isWeekRecordSigned(status: string | null | undefined, signature?: string | null): boolean {
  return status === "completed" || Boolean(signature?.trim());
}

export function formatRecordsWeekOption(opts: {
  weekStarting: string;
  thisWeekSunday: string;
  signed?: boolean;
}): string {
  const ending = weekEndingDateLabel(opts.weekStarting);
  const signedBit = opts.signed ? "signed" : "unsigned";
  const thisSun = normalizeWeekDateString(opts.thisWeekSunday);
  const weekSun = normalizeWeekDateString(opts.weekStarting);
  if (weekSun === thisSun) {
    return `This week · ending ${ending} · ${signedBit}`;
  }
  return `Week ending ${ending} · ${signedBit}`;
}

/** Previous weeks first (newest), then this week if present. */
export function sortRecordsWeeks<T extends { week_starting: string }>(
  sheets: T[],
  thisWeekSunday: string
): T[] {
  const thisSun = normalizeWeekDateString(thisWeekSunday);
  return [...sheets].sort((a, b) => {
    const aPast = isPastRegulatoryWeek(a.week_starting, thisSun);
    const bPast = isPastRegulatoryWeek(b.week_starting, thisSun);
    if (aPast !== bPast) return aPast ? -1 : 1;
    return b.week_starting.localeCompare(a.week_starting);
  });
}

export function defaultRecordsWeekId<T extends { id: string; week_starting: string }>(
  sheets: T[],
  thisWeekSunday: string
): string {
  const past = sheets.filter((s) => isPastRegulatoryWeek(s.week_starting, thisWeekSunday));
  if (past.length > 0) {
    return [...past].sort((a, b) => b.week_starting.localeCompare(a.week_starting))[0]!.id;
  }
  const current = sheets.find(
    (s) => normalizeWeekDateString(s.week_starting) === normalizeWeekDateString(thisWeekSunday)
  );
  return current?.id ?? sheets[0]?.id ?? "";
}

function checklistsOnDay(day: { checklists?: unknown } | null | undefined): ChecklistRecord[] {
  return Array.isArray(day?.checklists) ? (day.checklists as ChecklistRecord[]) : [];
}

/** Completed signed forms of one type across a week (oldest → newest). */
export function listWeekChecklistsOfType(
  days: Array<{ checklists?: unknown }> | null | undefined,
  type: ChecklistRecordType
): ChecklistRecord[] {
  if (!Array.isArray(days)) return [];
  const out: ChecklistRecord[] = [];
  for (const day of days) {
    out.push(...listCompletedChecklistsOfType(checklistsOnDay(day), type));
  }
  return out.sort((a, b) => String(a.completedAtUtc).localeCompare(String(b.completedAtUtc)));
}

/** Completed signed forms in a week, counted per checklist type (never merged). */
export function countCompletedChecklistsByType(
  days: Array<{ checklists?: unknown }> | null | undefined
): RecordsChecklistCounts {
  return {
    ffw: listWeekChecklistsOfType(days, "ffw").length,
    prestart: listWeekChecklistsOfType(days, "prestart").length,
    dimension_load: listWeekChecklistsOfType(days, "dimension_load").length,
  };
}

export function formatRecordsChecklistCount(n: number): string {
  if (n <= 0) return "No records this week";
  if (n === 1) return "1 record";
  return `${n} records`;
}
