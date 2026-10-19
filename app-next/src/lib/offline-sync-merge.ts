/**
 * Pure helpers for offline sheet sync — keep pending local writes from being
 * clobbered by an empty/stale server GET, and send one merged update per sheet.
 */

import type { FatigueSheet } from "./api";
import type { SheetUpdatePayload } from "./api";
import type { PendingWrite } from "./offline";
import { sheetHasDriverAttestation } from "./sheet-record";
import { normalizeWeekDateString } from "./weeks";

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

/** Count completed checklist records across all days (FFW / Prestart / Load). */
export function countSheetChecklists(sheet: Pick<FatigueSheet, "days"> | null | undefined): number {
  if (!sheet?.days?.length) return 0;
  let n = 0;
  for (const d of sheet.days) {
    n += Array.isArray(d.checklists) ? d.checklists.length : 0;
  }
  return n;
}

/**
 * Prefer on-device sheet when it has more logged events or checklist records than
 * the server copy. Protects auto-restored / unsynced driver work (including signed
 * forms) from being wiped by an empty GET even when the pending queue was cleared.
 */
export function shouldPreferLocalSheet(
  local: Pick<FatigueSheet, "days"> | null | undefined,
  server: Pick<FatigueSheet, "days"> | null | undefined
): boolean {
  if (countSheetEvents(local) > countSheetEvents(server)) return true;
  return countSheetChecklists(local) > countSheetChecklists(server);
}

export function weekDriverKey(sheet: Pick<FatigueSheet, "driver_name" | "week_starting">): string {
  return `${(sheet.driver_name ?? "").trim().toLowerCase()}|${normalizeWeekDateString(sheet.week_starting ?? "")}`;
}

export function isLocalSheetTempId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith("local-"));
}

/** Server row for the same driver + week as a still-unsynced `local-*` sheet. */
export function findServerTwinForLocal(
  local: Pick<FatigueSheet, "id" | "driver_name" | "week_starting">,
  sheets: FatigueSheet[]
): FatigueSheet | undefined {
  if (!isLocalSheetTempId(local.id)) return undefined;
  const key = weekDriverKey(local);
  if (!key || key.endsWith("|")) return undefined;
  return sheets.find((s) => !isLocalSheetTempId(s.id) && weekDriverKey(s) === key);
}

/** Collapse store + list-cache copies of the same id, keeping the richer days/attestation. */
export function coalesceLocalSheets(groups: FatigueSheet[][]): FatigueSheet[] {
  const byId = new Map<string, FatigueSheet>();
  for (const group of groups) {
    for (const sheet of group) {
      if (!sheet?.id) continue;
      const prev = byId.get(sheet.id);
      byId.set(sheet.id, prev ? overlayLocalSheetOnNetwork(sheet, prev) : sheet);
    }
  }
  return [...byId.values()];
}

/**
 * Overlay a richer on-device copy onto a network list/detail row without dropping local work.
 * Local attestation wins only when a pending sign is still queued — a leftover device
 * "signed" mark must not hide an unsigned server week (Jaydin week-ending 17 Oct).
 */
export function overlayLocalSheetOnNetwork(
  local: FatigueSheet,
  network: FatigueSheet,
  opts?: { keepLocalAttestation?: boolean }
): FatigueSheet {
  const networkEmpty = countSheetEvents(network) === 0 && countSheetChecklists(network) === 0;
  const useLocalDays =
    shouldPreferLocalSheet(local, network) ||
    (networkEmpty && ((local.days?.length ?? 0) > 0 || countSheetEvents(local) > 0));
  const localAttested = sheetHasDriverAttestation(local.status, local.signature);
  const netAttested = sheetHasDriverAttestation(network.status, network.signature);
  const useLocalAttestation =
    Boolean(opts?.keepLocalAttestation) && localAttested && !netAttested;
  return {
    ...network,
    days: useLocalDays ? (local.days ?? network.days) : network.days?.length ? network.days : local.days,
    status: useLocalAttestation ? local.status : network.status,
    signature: useLocalAttestation ? local.signature : network.signature,
    signed_at: useLocalAttestation ? local.signed_at : network.signed_at,
  };
}

/** True when a queued update still carries a week signature / completed status. */
export function pendingTouchesAttestation(pending: PendingWrite[], sheetId: string): boolean {
  return pendingUpdatesForSheet(pending, sheetId).some((p) => {
    if (p.data.status === "completed") return true;
    if (typeof p.data.signature === "string" && p.data.signature.trim()) return true;
    if (typeof p.data.signed_at === "string" && p.data.signed_at.trim()) return true;
    return false;
  });
}

/**
 * Keep on-device weeks that the network list omitted (unsynced current week / local-* id)
 * and overlay richer local days/signature onto matching server rows.
 */
export function mergeNetworkSheetListWithLocal(
  network: FatigueSheet[],
  localSheets: FatigueSheet[],
  pendingAttestationIds?: Set<string>
): FatigueSheet[] {
  const localById = new Map(localSheets.map((s) => [s.id, s]));
  const merged = network.map((net) => {
    const local = localById.get(net.id);
    return local
      ? overlayLocalSheetOnNetwork(local, net, {
          keepLocalAttestation: pendingAttestationIds?.has(net.id),
        })
      : net;
  });
  const seenIds = new Set(merged.map((s) => s.id));
  const seenWeeks = new Set(merged.map((s) => weekDriverKey(s)).filter((k) => !k.endsWith("|")));

  for (const local of localSheets) {
    if (seenIds.has(local.id)) continue;
    const key = weekDriverKey(local);
    if (key && !key.endsWith("|") && seenWeeks.has(key)) {
      const idx = merged.findIndex((s) => weekDriverKey(s) === key);
      if (idx >= 0) {
        const twin = merged[idx]!;
        merged[idx] = overlayLocalSheetOnNetwork(local, twin, {
          keepLocalAttestation:
            pendingAttestationIds?.has(twin.id) || pendingAttestationIds?.has(local.id),
        });
      }
      continue;
    }
    merged.push(local);
    seenIds.add(local.id);
    if (key && !key.endsWith("|")) seenWeeks.add(key);
  }
  return merged;
}

/** Same driver + week on device, richer than the sheet we just fetched. */
export function findRicherLocalSheet(
  target: FatigueSheet,
  localSheets: FatigueSheet[]
): FatigueSheet | null {
  const key = weekDriverKey(target);
  let best: FatigueSheet | null = null;
  for (const local of localSheets) {
    if (local.id !== target.id && weekDriverKey(local) !== key) continue;
    if (!best || shouldPreferLocalSheet(local, best)) best = local;
  }
  if (!best) return null;
  if (shouldPreferLocalSheet(best, target)) return best;
  return null;
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
export function toSheetUpdatePayload(
  sheet: Partial<FatigueSheet> & { amendment_reason?: string }
): SheetUpdatePayload {
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
    last_24h_rest_1_start:
      sheet.last_24h_rest_1_start === undefined
        ? undefined
        : sheet.last_24h_rest_1_start || null,
    last_24h_rest_1_end:
      sheet.last_24h_rest_1_end === undefined
        ? undefined
        : sheet.last_24h_rest_1_end || null,
    last_24h_rest_2_start:
      sheet.last_24h_rest_2_start === undefined
        ? undefined
        : sheet.last_24h_rest_2_start || null,
    last_24h_rest_2_end:
      sheet.last_24h_rest_2_end === undefined
        ? undefined
        : sheet.last_24h_rest_2_end || null,
    last_24h_rest_3_start:
      sheet.last_24h_rest_3_start === undefined
        ? undefined
        : sheet.last_24h_rest_3_start || null,
    last_24h_rest_3_end:
      sheet.last_24h_rest_3_end === undefined
        ? undefined
        : sheet.last_24h_rest_3_end || null,
    last_24h_rest_4_start:
      sheet.last_24h_rest_4_start === undefined
        ? undefined
        : sheet.last_24h_rest_4_start || null,
    last_24h_rest_4_end:
      sheet.last_24h_rest_4_end === undefined
        ? undefined
        : sheet.last_24h_rest_4_end || null,
    week_starting: sheet.week_starting,
    days: sheet.days,
    status: sheet.status,
    signature: sheet.signature,
    signed_at: sheet.signed_at,
    amendment_reason: sheet.amendment_reason,
  };
}

export function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string; body?: { error?: string } };
  if (e.status === 404) return true;
  const msg = (e.message || e.body?.error || "").toLowerCase();
  return msg.includes("not found");
}
