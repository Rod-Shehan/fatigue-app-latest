/**
 * WA Commercial Driver Medical certificate reminder helpers (S7).
 * Not regulatory advice — managers should confirm requirements with DoT / medical providers.
 */

/** User-facing name (WA Commercial Vehicle Driver certificate). */
export const COMMERCIAL_DRIVERS_MEDICAL = "Commercial Driver Medical";

/** YYYY-MM-DD → UTC Date for Prisma; `undefined` = omit field; `null` = clear. */
export function parseCvdMedicalExpiryInput(input: unknown): Date | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input === "") return null;
  if (typeof input !== "string") return undefined;
  const t = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  return new Date(`${t}T12:00:00.000Z`);
}

export function isInvalidCvdMedicalInput(input: unknown): boolean {
  if (input === undefined || input === null || input === "") return false;
  if (typeof input !== "string") return true;
  const t = input.trim();
  if (!t) return false;
  return !/^\d{4}-\d{2}-\d{2}$/.test(t);
}

/** Required YYYY-MM-DD for roster dates (medical / licence expiry). */
export function parseRequiredYmdDate(input: unknown): Date | null {
  const parsed = parseCvdMedicalExpiryInput(input);
  return parsed instanceof Date ? parsed : null;
}

export function dateToYmd(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Calendar days from local “today” to the given YYYY-MM-DD (can be negative if past). */
export function daysFromTodayToYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return NaN;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - t0.getTime()) / (24 * 60 * 60 * 1000));
}

export type CvdMedicalBannerKind = "none" | "expired" | "soon" | "ok_no_banner";

const SOON_DAYS = 30;

/**
 * `none` — no date on file.
 * `expired` / `soon` — show prominent banner on sheet.
 * `ok_no_banner` — date is more than SOON_DAYS away; no banner.
 */
export function getCvdMedicalBannerKind(ymd: string | null | undefined): CvdMedicalBannerKind {
  if (ymd == null || String(ymd).trim() === "") return "none";
  const days = daysFromTodayToYmd(String(ymd).trim());
  if (Number.isNaN(days)) return "none";
  if (days < 0) return "expired";
  if (days <= SOON_DAYS) return "soon";
  return "ok_no_banner";
}
