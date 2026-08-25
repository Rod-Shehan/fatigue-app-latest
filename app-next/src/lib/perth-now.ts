/** Australia/Perth calendar clock (UTC+8, no DST). */
export function getPerthNowParts(): { ymd: string; hour: number; minute: number } {
  const PERTH_OFFSET_MIN = 8 * 60;
  const perth = new Date(Date.now() + PERTH_OFFSET_MIN * 60_000);
  const y = perth.getUTCFullYear();
  const m = perth.getUTCMonth() + 1;
  const d = perth.getUTCDate();
  const hour = perth.getUTCHours();
  const minute = perth.getUTCMinutes();
  const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { ymd, hour, minute };
}

/**
 * Midnight Australia/Perth for a YMD descriptor, as UTC ms.
 * Day cards / PDF hours are Perth wall time — never the host server timezone.
 */
export function perthDayStartUtcMs(ymd: string): number {
  const ms = Date.parse(`${ymd}T00:00:00+08:00`);
  return Number.isFinite(ms) ? ms : Date.parse(`${getPerthNowParts().ymd}T00:00:00+08:00`);
}

/** Last millisecond of that Perth calendar day. */
export function perthDayEndUtcMs(ymd: string): number {
  return perthDayStartUtcMs(ymd) + 24 * 60 * 60 * 1000 - 1;
}
