/**
 * Offline-first API layer for sheets and regos.
 * - GET: try network first; on failure or when offline, read from IndexedDB.
 * - UPDATE: write to IndexedDB immediately (optimistic), enqueue for sync; when online, sync runs.
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
  offlineRemovePending,
  offlineDeleteSheet,
  type PendingWrite,
} from "./offline";

export { isOnline };

/** Try to run sync (process pending queue). Call when online. Returns list of synced ids and any error. */
export async function runSync(): Promise<{ synced: number; error?: string; replacedTempId?: { tempId: string; realId: string } }> {
  if (!isOnline()) return { synced: 0 };
  const pending = await offlineGetPending();
  let synced = 0;
  let replacedTempId: { tempId: string; realId: string } | undefined;
  for (const item of pending) {
    const id = item.id;
    try {
      if (item.type === "update") {
        await api.sheets.update(item.sheetId, item.data);
        await offlineSetSheet(await api.sheets.get(item.sheetId));
        await offlineRemovePending(id);
        synced++;
      } else if (item.type === "create") {
        const latest = await offlineGetSheet(item.tempId);
        const payload = latest
          ? {
              driver_name: latest.driver_name,
              second_driver: latest.second_driver,
              driver_type: latest.driver_type,
              destination: latest.destination,
              last_24h_break: latest.last_24h_break,
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
        await offlineRemovePending(id);
        replacedTempId = { tempId: item.tempId, realId: created.id };
        synced++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      return { synced, error: msg, replacedTempId };
    }
  }
  return { synced, replacedTempId };
}

/** Get sheet: network first, fallback to IndexedDB when offline or request fails. Local temp ids are cache-only. */
export async function getSheetOfflineFirst(id: string): Promise<FatigueSheet> {
  const isLocalTemp = id.startsWith("local-");
  if (isLocalTemp) {
    const cached = await offlineGetSheet(id);
    if (cached) return cached;
    throw new Error("Local sheet not found.");
  }
  if (isOnline()) {
    try {
      const sheet = await api.sheets.get(id);
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

/** Update sheet: write to IndexedDB immediately, then enqueue (unless local temp) and try sync if online. */
export async function updateSheetOfflineFirst(sheetId: string, data: Partial<FatigueSheet>): Promise<FatigueSheet> {
  const existing = await offlineGetSheet(sheetId).catch(() => null);
  const merged: FatigueSheet = existing
    ? { ...existing, ...data, id: sheetId }
    : { ...data, id: sheetId } as FatigueSheet;
  await offlineSetSheet(merged);
  const isLocalTemp = sheetId.startsWith("local-");
  if (!isLocalTemp) await offlineEnqueue({ type: "update", sheetId, data });

  if (isOnline() && !isLocalTemp) {
    const result = await runSync();
    if (result.synced > 0) {
      const updated = await offlineGetSheet(sheetId);
      if (updated) return updated;
    }
  }
  return merged;
}

/** Create sheet: when online POST; when offline create local with temp id and enqueue. */
export async function createSheetOfflineFirst(data: Omit<FatigueSheet, "id" | "created_date">): Promise<FatigueSheet> {
  if (isOnline()) {
    const created = await api.sheets.create(data);
    await offlineSetSheet(created);
    const list = await offlineGetSheetsList();
    await offlineSetSheetsList([...list, created]);
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
