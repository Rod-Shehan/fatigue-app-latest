import { weekEndingDateLabel } from "@/lib/worksafe-day-sheet/weekly-trip-sheet";
import { isPastRegulatoryWeek, normalizeWeekDateString } from "@/lib/weeks";

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
