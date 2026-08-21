/**
 * Declared fundamental ≥24h break as an absolute time range (not a calendar-day descriptor).
 * Soft-reset uses the range end instant on the rolling timeline.
 */

export const LAST_24H_BREAK_MIN_MS = 24 * 60 * 60 * 1000;

export type Last24hBreakRange = {
  startIso: string;
  endIso: string;
};

/** `datetime-local` value (no zone) interpreted as Australia/Perth wall time → UTC ISO. */
export function perthDatetimeLocalToIso(local: string): string | null {
  const m = local.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+08:00`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Add whole hours to a Perth `datetime-local` value (no DST in Perth). */
export function addHoursToPerthDatetimeLocal(local: string, hours: number): string {
  const iso = perthDatetimeLocalToIso(local);
  if (!iso) return "";
  const ms = Date.parse(iso) + hours * 3600_000;
  if (!Number.isFinite(ms)) return "";
  return isoToPerthDatetimeLocal(new Date(ms).toISOString());
}

/** UTC ISO → `datetime-local` string in Perth wall time. */
export function isoToPerthDatetimeLocal(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const perth = new Date(ms + 8 * 60 * 60_000);
  const y = perth.getUTCFullYear();
  const mo = String(perth.getUTCMonth() + 1).padStart(2, "0");
  const d = String(perth.getUTCDate()).padStart(2, "0");
  const h = String(perth.getUTCHours()).padStart(2, "0");
  const mi = String(perth.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

/** Perth calendar YYYY-MM-DD of an instant (legacy day-grid sync only). */
export function isoToPerthYmd(iso: string): string | null {
  const local = isoToPerthDatetimeLocal(iso);
  return local ? local.slice(0, 10) : null;
}

export function validateLast24hBreakRange(
  startIso: string,
  endIso: string
): { ok: true; startMs: number; endMs: number } | { ok: false; error: string } {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { ok: false, error: "Enter a valid start and end time." };
  }
  if (endMs <= startMs) {
    return { ok: false, error: "End must be after start." };
  }
  if (endMs - startMs < LAST_24H_BREAK_MIN_MS) {
    return { ok: false, error: "Break must be at least 24 continuous hours." };
  }
  return { ok: true, startMs, endMs };
}

export function formatLast24hBreakRangeDisplay(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return "—";
    return new Date(ms).toLocaleString("en-AU", {
      timeZone: "Australia/Perth",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };
  return `${fmt(startIso)} → ${fmt(endIso)}`;
}

export const LAST_24H_RANGE_EDITOR_HINT =
  "Set when the break started (Perth). End is filled 24 hours later — change it only if the rest ran longer.";

/** Absolute end of declared ≥24h break → AMI soft-reset instant (ms), or null. */
export function last24hBreakEndMsFromIso(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function rangeFromSheetFields(input: {
  last_24h_break_start?: string | null;
  last_24h_break_end?: string | null;
}): Last24hBreakRange | null {
  const start = input.last_24h_break_start?.trim();
  const end = input.last_24h_break_end?.trim();
  if (!start || !end) return null;
  const v = validateLast24hBreakRange(start, end);
  if (!v.ok) return null;
  return { startIso: start, endIso: end };
}
