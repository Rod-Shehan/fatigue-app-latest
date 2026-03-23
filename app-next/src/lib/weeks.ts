/**
 * Week boundaries (Sunday-based). Uses local date.
 */

/** Sunday of the current week as YYYY-MM-DD (local time). */
export function getThisWeekSunday(): string {
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  return formatDateLocal(sunday);
}

/** Sunday of the week before the given week_starting (YYYY-MM-DD). */
export function getPreviousWeekSunday(weekStarting: string): string {
  const [y, m, d] = weekStarting.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 7);
  return formatDateLocal(date);
}

/** True if weekStarting is after this week's Sunday (i.e. "next week" or later). */
export function isNextWeekOrLater(weekStarting: string): boolean {
  const thisWeek = getThisWeekSunday();
  return weekStarting > thisWeek;
}

/** YYYY-MM-DD in local time. Use for "today" and sheet-day comparisons so non-work cap is correct. */
export function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's date as YYYY-MM-DD (local). */
export function getTodayLocalDateString(): string {
  return formatDateLocal(new Date());
}

/** Strip time / timezone suffix so "2026-03-15T00:00:00.000Z" → "2026-03-15". */
export function normalizeWeekDateString(weekStarting: string): string {
  const s = weekStarting.trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const [y, mo, d] = s.split("-").map(Number);
  if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
    return formatDateLocal(new Date(y, mo - 1, d));
  }
  return s;
}

/** Sheet day date as YYYY-MM-DD (local): week_starting + dayIndex. */
export function getSheetDayDateString(weekStarting: string, dayIndex: number): string {
  const norm = normalizeWeekDateString(weekStarting);
  const [y, m, d] = norm.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + dayIndex);
  return formatDateLocal(date);
}

/** Inclusive Sun–Sat range for a sheet week (YYYY-MM-DD strings, local calendar). */
export function getSheetWeekRangeBounds(weekStarting: string): { start: string; end: string } {
  const start = normalizeWeekDateString(weekStarting);
  const [y, m, d] = start.split("-").map(Number);
  const endDate = new Date(y, m - 1, d);
  endDate.setDate(endDate.getDate() + 6);
  return { start, end: formatDateLocal(endDate) };
}

/**
 * True if two Sunday-based work weeks share at least one calendar day.
 * Use this so the manager picker still finds a sheet when `week_starting` was saved
 * off by one day (e.g. UTC vs local) relative to the selected work week.
 */
export function sheetWeeksOverlap(aWeekStarting: string, bWeekStarting: string): boolean {
  const a = getSheetWeekRangeBounds(aWeekStarting);
  const b = getSheetWeekRangeBounds(bWeekStarting);
  return a.start <= b.end && b.start <= a.end;
}

/**
 * Parse YYYY-MM-DD as local midnight. Use this instead of new Date(dateStr), which
 * parses date-only as UTC and can shift the calendar day across the 9–10 March boundary.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Human-readable date for sheet UI (en-AU). Pass YYYY-MM-DD. */
export function formatSheetDisplayDate(ymd: string): string {
  if (!ymd?.trim()) return "";
  const d = parseLocalDate(normalizeWeekDateString(ymd));
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Weekday for a sheet column from the **actual calendar date** (week_starting + dayIndex),
 * not from slot index alone. Keeps labels aligned with dates when week_starting is wrong
 * (e.g. legacy UTC `toISOString().split("T")[0]` off-by-one) or edited manually.
 */
export function getSheetDayWeekdayLong(weekStarting: string, dayIndex: number): string {
  const ymd = getSheetDayDateString(weekStarting, dayIndex);
  return parseLocalDate(ymd).toLocaleDateString("en-AU", { weekday: "long" });
}

export function getSheetDayWeekdayShort(weekStarting: string, dayIndex: number): string {
  const ymd = getSheetDayDateString(weekStarting, dayIndex);
  return parseLocalDate(ymd).toLocaleDateString("en-AU", { weekday: "short" });
}

/** First character of short weekday for compact badges (Sun → S, Tue → T). */
export function getSheetDayWeekdayLetter(weekStarting: string, dayIndex: number): string {
  const s = getSheetDayWeekdayShort(weekStarting, dayIndex);
  return s ? s.charAt(0).toUpperCase() : "?";
}
