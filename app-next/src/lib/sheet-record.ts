/**
 * Weekly record contract: archive by week epoch, driver attestation, manager amendment.
 * @see product-copy.ts SHEET_RECORD_CONTRACT
 */

import { isPastRegulatoryWeek } from "@/lib/weeks";

export { isPastRegulatoryWeek };

/** Driver may log work/break/edit day content only on the current regulatory week. */
export function canDriverLogOnSheet(weekStarting: string, status: string): boolean {
  if (isPastRegulatoryWeek(weekStarting)) return false;
  return status !== "completed";
}

/** Driver may edit sheet content (not attestation-only). */
export function canDriverEditSheetContent(weekStarting: string, status: string): boolean {
  return canDriverLogOnSheet(weekStarting, status);
}

/** Driver may sign / complete attestation (current or past week). */
export function canDriverAttestSheet(status: string, signature?: string | null): boolean {
  if (signature) return false;
  return true;
}

export const SHEET_CONTENT_PATCH_KEYS = [
  "driver_name",
  "second_driver",
  "driver_type",
  "destination",
  "last_24h_break",
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
