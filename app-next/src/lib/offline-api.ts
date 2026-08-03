/**
 * Offline-first API layer for sheets and regos.
 *
 * Absolute write order (owner rule):
 *   1) Confirm on driver device (IndexedDB sheet + pending queue)
 *   2) Only then attempt DB push (runSync → api.sheets.*)
 *
 * Never call api.sheets.create/update for driver sheet bodies until device confirm
 * has succeeded. GET/list may still prefer network for freshness, but must not
 * clobber richer local / pending work.
 */

import { api, type FatigueSheet, type Rego, type SheetUpdatePayload } from "./api";
import {
  isOnline,
  offlineGetSheet,
  offlineSetSheet,
  offlineGetSheetsList,
  offlineSetSheetsList,
  offlineGetRegos,
  offlineSetRegos,
  offlineGetPending,
  offlineEnqueue,
  offlineEnqueueSheetUpdate,
  offlineRemovePending,
  offlineDeleteSheet,
  type PendingWrite,
} from "./offline";
import { scheduleDeviceBackupAfterWrite, writeDeviceSnapshot } from "./device-backup";
import {
  hasPendingUpdateForSheet,
  isNotFoundError,
  mergeLocalSheetWithPendingUpdates,
  pendingUpdatesForSheet,
  shouldPreferLocalSheet,
  toSheetUpdatePayload,
} from "./offline-sync-merge";

export { isOnline };

export type SyncResult = {
  synced: number;
  error?: string;
  replacedTempId?: { tempId: string; realId: string };
};

function newLocalSheetTempId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Device confirm for a full sheet row. Throws if IndexedDB put fails —
 * callers must not push to the DB when this rejects.
 */
export async function confirmDeviceSheetWrite(sheet: FatigueSheet): Promise<FatigueSheet> {
  const withId = { ...sheet, id: sheet.id };
  await offlineSetSheet(withId);
  return withId;
}

/** Try to run sync (process pending queue). Call when online. Returns list of synced ids and any error. */
export async function runSync(): Promise<SyncResult> {
  // Refresh list so remapping after deleted sheet ids can find the live week sheet.
  if (isOnline()) {
    try {
      const sheets = await api.sheets.list();
      await offlineSetSheetsList(sheets);
    } catch {
      /* keep cached list */
    }
  }

  const pending = await offlineGetPending();
  let synced = 0;
  let replacedTempId: { tempId: string; realId: string } | undefined;
  const removedIds = new Set<number>();

  for (const item of pending) {
    if (removedIds.has(item.id)) continue;
    try {
      if (item.type === "update") {
        const siblings = pendingUpdatesForSheet(pending, item.sheetId).filter(
          (p) => !removedIds.has(p.id)
        );
        const local = await offlineGetSheet(item.sheetId);
        const merged = mergeLocalSheetWithPendingUpdates(local, siblings, item.sheetId);
        const payload = toSheetUpdatePayload(merged ?? item.data);

        // Device confirm of what we intend to push — never PATCH without this.
        if (merged) {
          await confirmDeviceSheetWrite(merged);
        } else {
          await confirmDeviceSheetWrite({
            ...(item.data as FatigueSheet),
            id: item.sheetId,
          });
        }

        await api.sheets.update(item.sheetId, payload);
        const serverSheet = await api.sheets.get(item.sheetId);
        // A Start shift (or other tap) may have landed in IDB while this sync was in flight.
        // Never let the older server copy wipe richer local events/checklists.
        const localNow = await offlineGetSheet(item.sheetId);
        if (localNow && shouldPreferLocalSheet(localNow, serverSheet)) {
          await offlineEnqueueSheetUpdate(item.sheetId, toSheetUpdatePayload(localNow));
        } else {
          await confirmDeviceSheetWrite(serverSheet);
        }
        for (const s of siblings) {
          await offlineRemovePending(s.id);
          removedIds.add(s.id);
        }
        synced += siblings.length;
      } else if (item.type === "create") {
        const latest = await offlineGetSheet(item.tempId);
        const deviceSheet: FatigueSheet = latest
          ? latest
          : ({ ...item.data, id: item.tempId } as FatigueSheet);
        // Re-confirm device before POST (recovers wiped IDB from pending payload).
        await confirmDeviceSheetWrite(deviceSheet);

        const payload = {
          jurisdiction_code: deviceSheet.jurisdiction_code,
          driver_name: deviceSheet.driver_name,
          second_driver: deviceSheet.second_driver,
          driver_type: deviceSheet.driver_type,
          last_24h_break: deviceSheet.last_24h_break,
          last_24h_break_start: deviceSheet.last_24h_break_start,
          last_24h_break_end: deviceSheet.last_24h_break_end,
          last_24h_rest_1: deviceSheet.last_24h_rest_1,
          last_24h_rest_2: deviceSheet.last_24h_rest_2,
          last_24h_rest_3: deviceSheet.last_24h_rest_3,
          last_24h_rest_4: deviceSheet.last_24h_rest_4,
          last_24h_rest_1_start: deviceSheet.last_24h_rest_1_start,
          last_24h_rest_1_end: deviceSheet.last_24h_rest_1_end,
          last_24h_rest_2_start: deviceSheet.last_24h_rest_2_start,
          last_24h_rest_2_end: deviceSheet.last_24h_rest_2_end,
          last_24h_rest_3_start: deviceSheet.last_24h_rest_3_start,
          last_24h_rest_3_end: deviceSheet.last_24h_rest_3_end,
          last_24h_rest_4_start: deviceSheet.last_24h_rest_4_start,
          last_24h_rest_4_end: deviceSheet.last_24h_rest_4_end,
          week_starting: deviceSheet.week_starting,
          days: deviceSheet.days,
          status: deviceSheet.status,
          signature: deviceSheet.signature,
          signed_at: deviceSheet.signed_at,
        };
        const created = await api.sheets.create(payload as Omit<FatigueSheet, "id" | "created_date">);
        await confirmDeviceSheetWrite(created);
        await offlineDeleteSheet(item.tempId);
        const list = await offlineGetSheetsList();
        const newList = list.filter((s) => s.id !== item.tempId);
        newList.push(created);
        await offlineSetSheetsList(newList);
        await offlineRemovePending(item.id);
        removedIds.add(item.id);
        replacedTempId = { tempId: item.tempId, realId: created.id };
        synced++;
      }
    } catch (e) {
      // Orphaned writes after a server purge / deleted sheet: remap to the live sheet
      // for the same driver + week when we can, then drop the dead id.
      if (item.type === "update" && isNotFoundError(e)) {
        const siblings = pendingUpdatesForSheet(pending, item.sheetId).filter(
          (p) => !removedIds.has(p.id)
        );
        const local = await offlineGetSheet(item.sheetId);
        const merged = mergeLocalSheetWithPendingUpdates(local, siblings, item.sheetId);
        const list = await offlineGetSheetsList();
        const driver = (merged?.driver_name || "").trim().toLowerCase();
        const week = merged?.week_starting || "";
        const replacement =
          driver && week
            ? list.find(
                (s) =>
                  s.id !== item.sheetId &&
                  (s.driver_name || "").trim().toLowerCase() === driver &&
                  s.week_starting === week
              )
            : undefined;
        for (const s of siblings) {
          await offlineRemovePending(s.id);
          removedIds.add(s.id);
        }
        await offlineDeleteSheet(item.sheetId).catch(() => {});
        if (replacement && merged) {
          const payload = toSheetUpdatePayload(merged);
          const remapped: FatigueSheet = { ...merged, id: replacement.id };
          // Device confirm on the remapped id before any PATCH.
          await confirmDeviceSheetWrite(remapped);
          try {
            await api.sheets.update(replacement.id, payload);
            await confirmDeviceSheetWrite(await api.sheets.get(replacement.id));
            synced += siblings.length || 1;
          } catch {
            await offlineEnqueueSheetUpdate(replacement.id, payload);
          }
        }
        continue;
      }
      const msg = e instanceof Error ? e.message : "Sync failed";
      return { synced, error: msg, replacedTempId };
    }
  }
  if (synced > 0) {
    void writeDeviceSnapshot({ force: false }).catch(() => {});
  }
  return { synced, replacedTempId };
}

/**
 * Get sheet: network first when nothing is pending locally; otherwise prefer (and restore)
 * the local/pending merge so a stale GET cannot wipe driver work still waiting to sync.
 */
export async function getSheetOfflineFirst(id: string): Promise<FatigueSheet> {
  const isLocalTemp = id.startsWith("local-");
  if (isLocalTemp) {
    const cached = await offlineGetSheet(id);
    if (cached) return cached;
    throw new Error("Local sheet not found.");
  }

  const pending = await offlineGetPending();
  if (hasPendingUpdateForSheet(pending, id)) {
    const local = await offlineGetSheet(id);
    const merged = mergeLocalSheetWithPendingUpdates(local, pending, id);
    if (merged) {
      await confirmDeviceSheetWrite(merged);
      if (isOnline()) void runSync().catch(() => {});
      return merged;
    }
  }

  if (isOnline()) {
    try {
      const sheet = await api.sheets.get(id);
      // Re-check: a write may have enqueued while we were fetching.
      const pendingAfter = await offlineGetPending();
      if (hasPendingUpdateForSheet(pendingAfter, id)) {
        const local = await offlineGetSheet(id);
        const merged = mergeLocalSheetWithPendingUpdates(local, pendingAfter, id);
        if (merged) {
          await confirmDeviceSheetWrite(merged);
          return merged;
        }
      }
      // Device backup restore / wiped pending can leave richer local data than Neon.
      // Never replace that with a emptier server copy — push local instead.
      const local = await offlineGetSheet(id);
      if (local && shouldPreferLocalSheet(local, sheet)) {
        await offlineEnqueueSheetUpdate(id, toSheetUpdatePayload(local));
        void runSync().catch(() => {});
        return local;
      }
      await confirmDeviceSheetWrite(sheet);
      return sheet;
    } catch {
      const cached = await offlineGetSheet(id);
      if (cached) return cached;
      throw new Error("Sheet not found and not available offline.");
    }
  }
  const cached = await offlineGetSheet(id);
  if (cached) return cached;
  throw new Error("You're offline and this sheet isn't cached. Connect to load it.");
}

/** List sheets: network first, fallback to IndexedDB. */
export async function listSheetsOfflineFirst(): Promise<FatigueSheet[]> {
  if (isOnline()) {
    try {
      const sheets = await api.sheets.list();
      await offlineSetSheetsList(sheets);
      return sheets;
    } catch {
      return offlineGetSheetsList();
    }
  }
  return offlineGetSheetsList();
}

/**
 * Update sheet: device confirm (IndexedDB + pending) first; DB push only after that.
 * Local temp sheets (`local-*`) stay device-only until their create queue item syncs.
 */
export async function updateSheetOfflineFirst(
  sheetId: string,
  data: SheetUpdatePayload
): Promise<FatigueSheet> {
  const existing = await offlineGetSheet(sheetId).catch(() => null);
  const merged: FatigueSheet = existing
    ? { ...existing, ...data, id: sheetId }
    : ({ ...data, id: sheetId } as FatigueSheet);

  await confirmDeviceSheetWrite(merged);

  const isLocalTemp = sheetId.startsWith("local-");
  if (!isLocalTemp) {
    await offlineEnqueueSheetUpdate(sheetId, data);
    // Push only after device + queue confirm.
    await runSync().catch(() => {});
  }

  scheduleDeviceBackupAfterWrite();
  return merged;
}

/**
 * Critical driver actions: confirm device cache + pending immediately.
 * Does not call runSync (avoids blocking the tap); OfflineBar / useOfflineSync / later
 * updateSheetOfflineFirst will push only after this device confirm.
 */
export async function persistSheetLocalCritical(
  sheetId: string,
  data: SheetUpdatePayload
): Promise<FatigueSheet> {
  const existing = await offlineGetSheet(sheetId).catch(() => null);
  const merged: FatigueSheet = existing
    ? { ...existing, ...data, id: sheetId }
    : ({ ...data, id: sheetId } as FatigueSheet);

  await confirmDeviceSheetWrite(merged);

  if (!sheetId.startsWith("local-")) {
    await offlineEnqueueSheetUpdate(sheetId, data);
  }
  scheduleDeviceBackupAfterWrite();
  return merged;
}

/**
 * Create sheet: always device-first (temp id + IndexedDB + create queue).
 * DB POST happens only via runSync after device confirm — never POST-then-cache.
 */
export async function createSheetOfflineFirst(
  data: Omit<FatigueSheet, "id" | "created_date">
): Promise<FatigueSheet> {
  const tempId = newLocalSheetTempId();
  const local: FatigueSheet = {
    ...data,
    id: tempId,
  } as FatigueSheet;

  await confirmDeviceSheetWrite(local);
  const list = await offlineGetSheetsList();
  await offlineSetSheetsList([...list.filter((s) => s.id !== tempId), local]);
  await offlineEnqueue({ type: "create", tempId, data });
  scheduleDeviceBackupAfterWrite();

  const sync = await runSync().catch(() => ({ synced: 0 } as SyncResult));
  if (sync.replacedTempId?.tempId === tempId) {
    const real = await offlineGetSheet(sync.replacedTempId.realId).catch(() => null);
    if (real) return real;
    return { ...local, id: sync.replacedTempId.realId };
  }
  // Device has the week sheet; Neon create may still be pending.
  return local;
}

/** List regos: network first, fallback to IndexedDB. */
export async function listRegosOfflineFirst(): Promise<Rego[]> {
  if (isOnline()) {
    try {
      const regos = await api.regos.list();
      await offlineSetRegos(regos);
      return regos;
    } catch {
      return offlineGetRegos();
    }
  }
  return offlineGetRegos();
}

/** Number of pending writes (for UI). */
export async function getPendingCount(): Promise<number> {
  const pending = await offlineGetPending();
  return pending.length;
}

/** Inspect pending (debug / support). */
export async function getPendingWrites(): Promise<PendingWrite[]> {
  return offlineGetPending();
}
