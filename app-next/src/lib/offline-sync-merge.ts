/**
 * Pure helpers for offline sheet sync — keep pending local writes from being
 * clobbered by an empty/stale server GET, and send one merged update per sheet.
 */

import type { FatigueSheet } from "./api";
import type { PendingWrite } from "./offline";

export function pendingUpdatesForSheet(
  pending: PendingWrite[],
  sheetId: string
): Extract<PendingWrite, { type: "update" }>[] {
  return pending.filter(
    (p): p is Extract<PendingWrite, { type: "update" }> =>
      p.type === "update" && p.sheetId === sheetId
  );
}

export function hasPendingUpdateForSheet(pending: PendingWrite[], sheetId: string): boolean {
  return pendingUpdatesForSheet(pending, sheetId).length > 0;
}

/** Count events across all days (best-effort richness signal). */
export function countSheetEvents(sheet: Pick<FatigueSheet, "days"> | null | undefined): number {
  if (!sheet?.days?.length) return 0;
  let n = 0;
  for (const d of sheet.days) {
    n += Array.isArray(d.events) ? d.events.length : 0;
  }
  return n;
}

/**
 * Prefer on-device sheet when it has more logged events than the server copy.
 * Protects auto-restored / unsynced driver work from being wiped by an empty GET
 * even when the pending queue was cleared or never restored.
 */
export function shouldPreferLocalSheet(
  local: Pick<FatigueSheet, "days"> | null | undefined,
  server: Pick<FatigueSheet, "days"> | null | undefined
): boolean {
  return countSheetEvents(local) > countSheetEvents(server);
}

/**
 * Merge local cached sheet with ordered pending update payloads (oldest → newest).
 * Each save already includes a full `days` array when present, so later wins for those fields.
 */
export function mergeLocalSheetWithPendingUpdates(
  local: FatigueSheet | null,
  pending: PendingWrite[],
  sheetId: string
): FatigueSheet | null {
  const updates = pendingUpdatesForSheet(pending, sheetId);
  if (!local && updates.length === 0) return null;

  let merged: FatigueSheet = local
    ? { ...local, id: sheetId }
    : ({ id: sheetId, ...(updates[0]?.data ?? {}) } as FatigueSheet);

  for (const u of updates) {
    merged = { ...merged, ...u.data, id: sheetId };
  }
  return merged;
}

/** Payload fields we persist on PATCH (mirrors driver autosave). */
export function toSheetUpdatePayload(sheet: Partial<FatigueSheet>): Partial<FatigueSheet> {
  return {
    jurisdiction_code: sheet.jurisdiction_code,
    driver_name: sheet.driver_name,
    second_driver: sheet.second_driver,
    driver_type: sheet.driver_type,
    destination: sheet.destination ?? null,
    last_24h_break: sheet.last_24h_break || undefined,
    last_24h_break_start:
      sheet.last_24h_break_start === undefined
        ? undefined
        : sheet.last_24h_break_start || null,
    last_24h_break_end:
      sheet.last_24h_break_end === undefined
        ? undefined
        : sheet.last_24h_break_end || null,
    last_24h_rest_1: sheet.last_24h_rest_1 || undefined,
    last_24h_rest_2: sheet.last_24h_rest_2 || undefined,
    last_24h_rest_3: sheet.last_24h_rest_3 || undefined,
    last_24h_rest_4: sheet.last_24h_rest_4 || undefined,
    week_starting: sheet.week_starting,
    days: sheet.days,
    status: sheet.status,
    signature: sheet.signature,
    signed_at: sheet.signed_at,
  };
}

export function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string; body?: { error?: string } };
  if (e.status === 404) return true;
  const msg = (e.message || e.body?.error || "").toLowerCase();
  return msg.includes("not found");
}
