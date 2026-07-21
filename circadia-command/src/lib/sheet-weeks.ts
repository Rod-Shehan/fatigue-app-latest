/**
 * Week / day label helpers for Event Tracker filters.
 * Calendar display only — not compliance timeline logic.
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getSheetDayDateString(weekStarting: string, dayIndex: number): string {
  const [y, m, d] = weekStarting.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + dayIndex);
  return formatDateLocal(date);
}

export function formatSheetDisplayDate(ymd: string): string {
  if (!ymd?.trim()) return "";
  return parseLocalDate(ymd).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatWeekLabel(weekStarting: string): string {
  return new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const WEEK_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
