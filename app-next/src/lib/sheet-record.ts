/**
 * Weekly record contract: archive by week epoch, driver attestation, manager amendment.
 * @see product-copy.ts SHEET_RECORD_CONTRACT
 */

import { isPastRegulatoryWeek } from "@/lib/weeks";

export { isPastRegulatoryWeek };

/** True while the driver has not attested this sheet (no signature, not completed). */
export function sheetIsUnsignedForDriver(status: string, signature?: string | null): boolean {
  if (signature) return false;
  if (status === "completed") return false;
  return true;
}

/** Driver may log work/break via the live LogBar on the current regulatory week only. */
export function canDriverLogOnSheet(
  weekStarting: string,
  status: string,
  signature?: string | null
): boolean {
  if (!sheetIsUnsignedForDriver(status, signature)) return false;
  return !isPastRegulatoryWeek(weekStarting);
}

/** Driver may edit sheet content (day cards, header fields) while the week is unsigned. */
export function canDriverEditSheetContent(
  _weekStarting: string,
  status: string,
  signature?: string | null
): boolean {
  return sheetIsUnsignedForDriver(status, signature);
}

/**
 * Driver may sign only after the regulatory week has ended (next Sunday onward).
 * Prevents signing the in-progress current week and locking out Start shift / day setup.
 */
export function canDriverAttestSheet(
  weekStarting: string,
  status: string,
  signature?: string | null
): boolean {
  if (!sheetIsUnsignedForDriver(status, signature)) return false;
  return isPastRegulatoryWeek(weekStarting);
}

export const SHEET_CONTENT_PATCH_KEYS = [
  "driver_name",
  "second_driver",
  "driver_type",
  "destination",
  "last_24h_break",
  "last_24h_break_start",
  "last_24h_break_end",
  "last_24h_rest_1",
  "last_24h_rest_2",
  "last_24h_rest_3",
  "last_24h_rest_4",
  "week_starting",
  "days",
  "jurisdiction_code",
  "jurisdictionCode",
] as const;

export const SHEET_ATTESTATION_PATCH_KEYS = ["signature", "signed_at", "status"] as const;

export type SheetPatchBody = Record<string, unknown>;

export function patchTouchesContent(body: SheetPatchBody): boolean {
  return SHEET_CONTENT_PATCH_KEYS.some((k) => body[k] !== undefined);
}

export function patchIsAttestationOnly(body: SheetPatchBody): boolean {
  const keys = Object.keys(body).filter(
    (k) => k !== "amendment_reason" && body[k] !== undefined
  );
  if (keys.length === 0) return false;
  return keys.every((k) =>
    (SHEET_ATTESTATION_PATCH_KEYS as readonly string[]).includes(k)
  );
}

/** Manager must supply a reason when changing content on a past or completed sheet. */
export function managerRequiresAmendmentReason(
  weekStarting: string,
  status: string,
  body: SheetPatchBody
): boolean {
  if (!patchTouchesContent(body)) return false;
  return isPastRegulatoryWeek(weekStarting) || status === "completed";
}

export function sheetNeedsDriverSignature(signature?: string | null): boolean {
  return !signature;
}

/** Signed or completed while still the in-progress regulatory week (invalid — locks logging). */
export function isPrematureCurrentWeekAttestation(
  weekStarting: string,
  status: string,
  signature?: string | null
): boolean {
  if (isPastRegulatoryWeek(weekStarting)) return false;
  return status === "completed" || !!signature;
}

export const PREMATURE_ATTESTATION_REOPEN = {
  status: "draft" as const,
  signature: null,
  signedAt: null,
};
