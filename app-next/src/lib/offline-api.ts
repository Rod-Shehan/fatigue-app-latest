/**
 * Offline-first API layer for sheets and regos.
 * - GET: try network first; on failure or when offline, read from IndexedDB.
 *   Never overwrite a local sheet that still has pending updates with a network GET.
 * - UPDATE: write to IndexedDB immediately (optimistic), coalesce enqueue; sync when online.
 * - CREATE: when offline, create local sheet with temp id and enqueue; when online, POST and replace temp with server id.
 */

import { api, type FatigueSheet, type Rego } from "./api";
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

        // Keep cache aligned with what we intend to push (recover wiped IDB from pending).
        if (merged) await offlineSetSheet(merged);

        await api.sheets.update(item.sheetId, payload);
        await offlineSetSheet(await api.sheets.get(item.sheetId));
        for (const s of siblings) {
          await offlineRemovePending(s.id);
          removedIds.add(s.id);
        }
        synced += siblings.length;
      } else if (item.type === "create") {
        const latest = await offlineGetSheet(item.tempId);
        const payload = latest
          ? {
              jurisdiction_code: latest.jurisdiction_code,
              driver_name: latest.driver_name,
              second_driver: latest.second_driver,
              driver_type: latest.driver_type,
              last_24h_break: latest.last_24h_break,
              last_24h_rest_1: latest.last_24h_rest_1,
              last_24h_rest_2: latest.last_24h_rest_2,
              last_24h_rest_3: latest.last_24h_rest_3,
              last_24h_rest_4: latest.last_24h_rest_4,
              week_starting: latest.week_starting,
              days: latest.days,
              status: latest.status,
              signature: latest.signature,
              signed_at: latest.signed_at,
            }
          : item.data;
        const created = await api.sheets.create(payload as Omit<FatigueSheet, "id" | "created_date">);
        await offlineSetSheet(created);
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
          await offlineSetSheet(remapped);
          try {
            await api.sheets.update(replacement.id, payload);
            await offlineSetSheet(await api.sheets.get(replacement.id));
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
      await offlineSetSheet(merged);
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
          await offlineSetSheet(merged);
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
      await offlineSetSheet(sheet);
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

/** Update sheet: write to IndexedDB immediately, then coalesce-enqueue and try sync if online. */
export async function updateSheetOfflineFirst(sheetId: string, data: Partial<FatigueSheet>): Promise<FatigueSheet> {
  const existing = await offlineGetSheet(sheetId).catch(() => null);
  const merged: FatigueSheet = existing
    ? { ...existing, ...data, id: sheetId }
    : ({ ...data, id: sheetId } as FatigueSheet);
  await offlineSetSheet(merged);
  const isLocalTemp = sheetId.startsWith("local-");
  if (!isLocalTemp) await offlineEnqueueSheetUpdate(sheetId, data);

  // Try sync opportunistically; some devices misreport navigator.onLine.
  if (!isLocalTemp) await runSync().catch(() => {});
  scheduleDeviceBackupAfterWrite();
  return merged;
}

/** Create sheet: when online POST; when offline create local with temp id and enqueue. */
export async function createSheetOfflineFirst(data: Omit<FatigueSheet, "id" | "created_date">): Promise<FatigueSheet> {
  if (isOnline()) {
    const created = await api.sheets.create(data);
    await offlineSetSheet(created);
    const list = await offlineGetSheetsList();
    await offlineSetSheetsList([...list, created]);
    scheduleDeviceBackupAfterWrite();
    return created;
  }
  const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const local: FatigueSheet = {
    ...data,
    id: tempId,
  } as FatigueSheet;
  await offlineSetSheet(local);
  const list = await offlineGetSheetsList();
  await offlineSetSheetsList([...list, local]);
  await offlineEnqueue({ type: "create", tempId, data });
  scheduleDeviceBackupAfterWrite();
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
