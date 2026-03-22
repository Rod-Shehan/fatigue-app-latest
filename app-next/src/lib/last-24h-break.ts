/**
 * Last 24h break sheet field: legacy `YYYY-MM-DD` (whole calendar day) or
 * `YYYY-MM-DDTHH:mm` / `YYYY-MM-DDTHH:mm:ss` (local) when the continuous rest ended.
 */

import { normalizeWeekDateString, parseLocalDate } from "@/lib/weeks";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** datetime-local style or space-separated */
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/;

export type ParsedLast24hBreak = {
  /** Calendar day (local) when the break ended — used for segment / day boundaries */
  calendarDate: string;
  /** True if a time was supplied (not legacy date-only). */
  hasTime: boolean;
  /** Local timestamp: instant the 24h rest ended. Date-only → end of that calendar day. */
  breakEndMs: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Calendar YYYY-MM-DD from any stored form (date or datetime prefix). */
export function getLast24hBreakCalendarDate(value: string | undefined | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  return normalizeWeekDateString(v);
}

export function last24hBreakHasTime(value: string | undefined | null): boolean {
  const v = value?.trim();
  if (!v) return false;
  if (DATE_ONLY.test(v)) return false;
  return /[T ]\d{1,2}:\d{2}/.test(v);
}

/**
 * Parse stored last_24h_break. Unknown shapes return null.
 */
export function parseLast24hBreak(value: string | undefined | null): ParsedLast24hBreak | null {
  const v = value?.trim();
  if (!v) return null;

  if (DATE_ONLY.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    const breakEndMs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    return { calendarDate: v, hasTime: false, breakEndMs };
  }

  const tm = v.match(DATE_TIME);
  if (tm) {
    const y = Number(tm[1]);
    const mo = Number(tm[2]);
    const d = Number(tm[3]);
    const hh = Number(tm[4]);
    const mi = Number(tm[5]);
    const calendarDate = `${y}-${pad2(mo)}-${pad2(d)}`;
    const breakEndMs = new Date(y, mo - 1, d, hh, mi, 0, 0).getTime();
    return { calendarDate, hasTime: true, breakEndMs };
  }

  // Fallback: ISO / Date parse (may be UTC — avoid if possible)
  const t = Date.parse(v);
  if (!Number.isNaN(t)) {
    const dt = new Date(t);
    const calendarDate = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
    return { calendarDate, hasTime: true, breakEndMs: t };
  }

  return null;
}

/** True if sheet day `dateStr` (YYYY-MM-DD) is strictly before the break calendar day. */
export function isDayBeforeLast24hBreakCalendar(dateStr: string, last24hBreak: string | undefined | null): boolean {
  const cal = getLast24hBreakCalendarDate(last24hBreak);
  if (!cal) return false;
  return dateStr < cal;
}

/**
 * True if this calendar day is the break day or later (for non-work clearing rules).
 * Fixes string compare bugs between `YYYY-MM-DD` and `YYYY-MM-DDTHH:mm`.
 */
export function isDayOnOrAfterBreakCalendar(dateStr: string, last24hBreak: string | undefined | null): boolean {
  const cal = getLast24hBreakCalendarDate(last24hBreak);
  if (!cal) return false;
  return dateStr >= cal;
}

const SLOT_MS = 30 * 60 * 1000;

/**
 * On the break calendar day, when time is set: clear non_work for slots whose interval starts at/after break end
 * (so the driver is not locked into a full day of inferred non-work before starting a shift).
 * Only applied when the day has no work slots.
 */
export function trimNonWorkAfterBreakEnd<T extends { non_work?: boolean[]; work_time?: boolean[] }>(
  day: T,
  dateStr: string,
  parsed: ParsedLast24hBreak
): T {
  if (!parsed.hasTime) return day;
  const hasWorkOnDay = (day.work_time || []).some(Boolean);
  if (hasWorkOnDay) return day;

  const dayStart = parseLocalDate(dateStr).getTime();
  const nw = [...(day.non_work || Array(48).fill(false))];
  for (let s = 0; s < 48; s++) {
    const slotStart = dayStart + s * SLOT_MS;
    if (slotStart >= parsed.breakEndMs) nw[s] = false;
  }
  return { ...day, non_work: nw };
}

/** Display in en-AU: date, or date + time if a time component exists. */
export function formatLast24hBreakDisplay(value: string): string {
  const v = value?.trim();
  if (!v) return "";
  const parsed = parseLast24hBreak(v);
  if (!parsed) {
    const cal = getLast24hBreakCalendarDate(v);
    if (!cal) return v;
    const d = parseLocalDate(cal);
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  }
  const d = new Date(parsed.breakEndMs);
  if (!parsed.hasTime) {
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  }
  return d.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Value for HTML datetime-local from stored string (legacy date → that day 00:00 local).
 */
export function last24hBreakToDatetimeLocalValue(value: string | undefined | null): string {
  const v = value?.trim();
  if (!v) return "";
  const parsed = parseLast24hBreak(v);
  if (!parsed) return "";
  const d = new Date(parsed.breakEndMs);
  if (!parsed.hasTime) {
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    return `${y}-${m}-${day}T00:00`;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
