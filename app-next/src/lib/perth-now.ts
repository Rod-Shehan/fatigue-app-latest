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
