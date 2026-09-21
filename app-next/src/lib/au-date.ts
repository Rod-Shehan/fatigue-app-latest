/** Australian calendar dates for Enterprise roster screens (`dd/mm/yyyy`). */

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/** `2026-09-21` → `21/09/2026`. */
export function formatYmdAsDmy(ymd: string | null | undefined): string {
  const t = (ymd ?? "").trim();
  const m = t.match(YMD);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Accept `dd/mm/yyyy` (or already-ISO `yyyy-mm-dd`) and return `yyyy-mm-dd`.
 * Invalid calendar dates return null.
 */
export function parseDmyOrYmdToYmd(input: string | null | undefined): string | null {
  const t = (input ?? "").trim();
  if (!t) return null;
  const dmy = t.match(DMY);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const ymd = t.match(YMD);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  }
  return null;
}

/** ISO timestamp → `21/09/2026, 3:04 pm`. */
export function formatInstantAsDmyTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}
