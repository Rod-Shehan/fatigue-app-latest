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
  offlineGetAllSheets,
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
  isAttestPending,
  isCreatePending,
  isPatchDaysPending,
  type PendingWrite,
} from "./offline";
import { recordOfficeSyncAt } from "./office-sync-status";
import { sheetIsUnsignedForDriver, sheetHasDriverAttestation } from "./sheet-record";
import { scheduleDeviceBackupAfterWrite, writeDeviceSnapshot } from "./device-backup";
import {
  coalesceLocalSheets,
  countSheetEvents,
  findRicherLocalSheet,
  findServerTwinForLocal,
  hasPendingUpdateForSheet,
  isLocalSheetTempId,
  isNotFoundError,
  mergeLocalSheetWithPendingUpdates,
  mergeNetworkSheetListWithLocal,
  overlayLocalSheetOnNetwork,
  pendingTouchesAttestation,
  pendingContentUpdatesForSheet,
  pendingUpdatesForSheet,
  shouldPreferLocalSheet,
  toSheetListIndex,
  toSheetUpdatePayload,
  weekDriverKey,
  withoutUnqueuedAttestation,
  hydrateSheetListRow,
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

async function loadCoalescedLocalSheets(): Promise<FatigueSheet[]> {
  const stored = await offlineGetAllSheets().catch(() => []);
  const listed = await offlineGetSheetsList().catch(() => []);
  return coalesceLocalSheets([stored, listed]);
}

/** Write the week list as an index only. Full days live in STORE_SHEETS. */
async function persistMergedSheetList(merged: FatigueSheet[]): Promise<void> {
  await offlineSetSheetsList(merged.map(toSheetListIndex));
  for (const sheet of merged) {
    if (countSheetEvents(sheet) === 0) continue;
    const existing = await offlineGetSheet(sheet.id).catch(() => null);
    if (!existing || shouldPreferLocalSheet(sheet, existing) || countSheetEvents(existing) === 0) {
      await offlineSetSheet(sheet);
    }
  }
}

async function hydrateMergedList(merged: FatigueSheet[]): Promise<FatigueSheet[]> {
  const stored = await offlineGetAllSheets().catch(() => []);
  const byId = new Map(stored.map((s) => [s.id, s]));
  return merged.map((row) => hydrateSheetListRow(row, byId.get(row.id)));
}

function sheetWithoutId(sheet: FatigueSheet): Omit<FatigueSheet, "id"> {
  const { id: _id, ...rest } = sheet;
  return rest;
}

/**
 * Local-only weeks must POST, or remap onto a server row for the same driver+week.
 * Pending create items are left in the queue when POST fails so the next sync retries.
 */
async function dropPendingCreatesForTempId(tempId: string): Promise<void> {
  const pending = await offlineGetPending().catch(() => []);
  for (const item of pending) {
    if (isCreatePending(item) && item.tempId === tempId) {
      await offlineRemovePending(item.id);
    }
  }
}

async function ensureLocalWeeksQueuedForSync(merged: FatigueSheet[]): Promise<FatigueSheet[]> {
  const known = coalesceLocalSheets([merged, await loadCoalescedLocalSheets()]);
  const pending = await offlineGetPending().catch(() => []);
  const createTempIds = new Set<string>();
  const createWeeks = new Set<string>();
  for (const item of pending) {
    if (!isCreatePending(item)) continue;
    createTempIds.add(item.tempId);
    const key = weekDriverKey({
      driver_name: item.data.driver_name ?? "",
      week_starting: item.data.week_starting ?? "",
    });
    if (!key.endsWith("|")) createWeeks.add(key);
  }

  const next = [...merged];
  for (let i = 0; i < next.length; i++) {
    const local = next[i]!;
    if (!isLocalSheetTempId(local.id)) continue;
    const key = weekDriverKey(local);
    const serverTwin = findServerTwinForLocal(local, known);
    if (serverTwin) {
      const kept = overlayLocalSheetOnNetwork(local, serverTwin);
      await confirmDeviceSheetWrite(kept);
      // Keep the open `local-*` row so the current page still loads until create remaps.
      await confirmDeviceSheetWrite({ ...kept, id: local.id });
      const twinIdx = next.findIndex((s) => s.id === serverTwin.id);
      if (twinIdx >= 0) next[twinIdx] = kept;
      else next.push(kept);
      await dropPendingCreatesForTempId(local.id);
      if (shouldPreferLocalSheet(kept, serverTwin) || countSheetEvents(kept) > countSheetEvents(serverTwin)) {
        await offlineEnqueueSheetUpdate(serverTwin.id, toSheetUpdatePayload(kept));
      }
      continue;
    }
    if (!createTempIds.has(local.id) && (key.endsWith("|") || !createWeeks.has(key))) {
      await offlineEnqueue({ type: "create_week", tempId: local.id, data: sheetWithoutId(local) });
      createTempIds.add(local.id);
      if (!key.endsWith("|")) createWeeks.add(key);
    }
  }
  return next.filter((s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx);
}

async function pendingAttestationIdSet(sheets: FatigueSheet[]): Promise<Set<string>> {
  const pending = await offlineGetPending().catch(() => []);
  const ids = new Set<string>();
  for (const sheet of sheets) {
    if (pendingTouchesAttestation(pending, sheet.id)) ids.add(sheet.id);
    const queuedCreate = pending.find((p) => isCreatePending(p) && p.tempId === sheet.id);
    if (queuedCreate && Boolean(queuedCreate.data.signature?.trim())) {
      ids.add(sheet.id);
    }
  }
  return ids;
}

async function mergeAndPersistNetworkSheetList(network: FatigueSheet[]): Promise<FatigueSheet[]> {
  const local = await loadCoalescedLocalSheets();
  const pendingAttestationIds = await pendingAttestationIdSet(local);
  let merged = mergeNetworkSheetListWithLocal(network, local, pendingAttestationIds);
  merged = await ensureLocalWeeksQueuedForSync(merged);
  await persistMergedSheetList(merged);
  await pullOfficeAttestation(network);
  recordOfficeSyncAt();
  return merged;
}

/** Drop a leftover on-device sign when the office week is still unsigned. */
async function pullOfficeAttestation(network: FatigueSheet[]): Promise<number> {
  const pending = await offlineGetPending().catch(() => []);
  let pulled = 0;
  for (const net of network) {
    if (pendingTouchesAttestation(pending, net.id)) continue;
    const stored = await offlineGetSheet(net.id).catch(() => null);
    if (!stored) continue;
    if (
      sheetHasDriverAttestation(stored.status, stored.signature) &&
      sheetIsUnsignedForDriver(net.status, net.signature)
    ) {
      await confirmDeviceSheetWrite({
        ...stored,
        status: net.status || "draft",
        signature: net.signature,
        signed_at: net.signed_at,
      });
      pulled += 1;
    }
  }
  return pulled;
}

/** Compare phone weeks to Neon: queue missing creates, pull unsigned office attestation. */
export async function reconcileSheetsWithOffice(): Promise<{
  queuedCreates: number;
  pulledAttestation: number;
}> {
  if (!isOnline()) return { queuedCreates: 0, pulledAttestation: 0 };
  try {
    const network = await api.sheets.list();
    const merged = await mergeAndPersistNetworkSheetList(network);
    const queuedCreates = merged.filter((s) => isLocalSheetTempId(s.id)).length;
    await runSync().catch(() => {});
    return { queuedCreates, pulledAttestation: 0 };
  } catch {
    return { queuedCreates: 0, pulledAttestation: 0 };
  }
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
  // Never replace the on-device list with meta-only `days: []` rows or drop a local-only week.
  if (isOnline()) {
    try {
      await mergeAndPersistNetworkSheetList(await api.sheets.list());
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
      if (isAttestPending(item)) {
        const payload = {
          status: item.data.status,
          signature: item.data.signature,
          signed_at: item.data.signed_at,
        };
        const existing = await offlineGetSheet(item.sheetId).catch(() => null);
        if (existing) {
          await confirmDeviceSheetWrite({
            ...existing,
            id: item.sheetId,
            status: payload.status ?? existing.status,
            signature: payload.signature ?? existing.signature,
            signed_at: payload.signed_at ?? existing.signed_at,
          });
        }
        await api.sheets.update(item.sheetId, payload);
        await confirmDeviceSheetWrite(await api.sheets.get(item.sheetId));
        await offlineRemovePending(item.id);
        removedIds.add(item.id);
        synced++;
      } else if (isPatchDaysPending(item)) {
        const siblings = pendingContentUpdatesForSheet(pending, item.sheetId).filter(
          (p) => !removedIds.has(p.id)
        );
        const local = await offlineGetSheet(item.sheetId);
        const merged = mergeLocalSheetWithPendingUpdates(local, siblings, item.sheetId);
        const payload = withoutUnqueuedAttestation(
          toSheetUpdatePayload(merged ?? item.data),
          siblings,
          item.sheetId
        );

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
          await offlineEnqueueSheetUpdate(
            item.sheetId,
            withoutUnqueuedAttestation(toSheetUpdatePayload(localNow), siblings, item.sheetId)
          );
        } else {
          await confirmDeviceSheetWrite(serverSheet);
        }
        for (const s of siblings) {
          await offlineRemovePending(s.id);
          removedIds.add(s.id);
        }
        synced += siblings.length;
      } else if (isCreatePending(item)) {
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
        const listBeforeCreate = await offlineGetSheetsList();
        const serverTwin = findServerTwinForLocal(
          deviceSheet,
          coalesceLocalSheets([listBeforeCreate, [deviceSheet]])
        );
        if (serverTwin) {
          const keptTwin = overlayLocalSheetOnNetwork(deviceSheet, serverTwin);
          await confirmDeviceSheetWrite(keptTwin);
          await offlineDeleteSheet(item.tempId);
          const remappedList = listBeforeCreate.filter((s) => s.id !== item.tempId && s.id !== serverTwin.id);
          remappedList.push(keptTwin);
          await persistMergedSheetList(remappedList);
          await offlineRemovePending(item.id);
          removedIds.add(item.id);
          replacedTempId = { tempId: item.tempId, realId: serverTwin.id };
          synced++;
          if (
            shouldPreferLocalSheet(keptTwin, serverTwin) ||
            countSheetEvents(keptTwin) > countSheetEvents(serverTwin)
          ) {
            await offlineEnqueueSheetUpdate(serverTwin.id, toSheetUpdatePayload(keptTwin));
          }
          continue;
        }

        const created = await api.sheets.create(payload as Omit<FatigueSheet, "id" | "created_date">);
        const kept = overlayLocalSheetOnNetwork(deviceSheet, { ...created, id: created.id });
        await confirmDeviceSheetWrite(kept);
        await offlineDeleteSheet(item.tempId);
        const list = await offlineGetSheetsList();
        const newList = list.filter((s) => s.id !== item.tempId && s.id !== created.id);
        newList.push(kept);
        await persistMergedSheetList(newList);
        await offlineRemovePending(item.id);
        removedIds.add(item.id);
        replacedTempId = { tempId: item.tempId, realId: created.id };
        synced++;
        if (shouldPreferLocalSheet(kept, created) || countSheetEvents(kept) > countSheetEvents(created)) {
          await offlineEnqueueSheetUpdate(created.id, toSheetUpdatePayload(kept));
        }
      }
    } catch (e) {
      // Orphaned writes after a server purge / deleted sheet: remap to the live sheet
      // for the same driver + week when we can, then drop the dead id.
      if ((isPatchDaysPending(item) || isAttestPending(item)) && isNotFoundError(e)) {
        const siblings = pendingUpdatesForSheet(pending, item.sheetId).filter(
          (p) => !removedIds.has(p.id)
        );
        const local = await offlineGetSheet(item.sheetId);
        const merged = mergeLocalSheetWithPendingUpdates(local, siblings, item.sheetId);
        const list = await offlineGetSheetsList();
        const replacement = merged
          ? list.find((s) => s.id !== item.sheetId && weekDriverKey(s) === weekDriverKey(merged))
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
    recordOfficeSyncAt();
    void writeDeviceSnapshot({ force: false }).catch(() => {});
  }
  return { synced, replacedTempId };
}

/**
 * Get sheet: network first when online so leftover device attestation cannot hide
 * an unsigned server week. Pending/local days still overlay; a queued signature
 * image is the only local sign that wins.
 */
export async function getSheetOfflineFirst(id: string): Promise<FatigueSheet> {
  const isLocalTemp = id.startsWith("local-");
  if (isLocalTemp) {
    const cached = await offlineGetSheet(id);
    if (cached) {
      if (isOnline()) {
        await ensureLocalWeeksQueuedForSync([cached]).catch(() => {});
        void runSync().catch(() => {});
      }
      return cached;
    }
    throw new Error("Local sheet not found.");
  }

  const pending = await offlineGetPending();
  const local = await offlineGetSheet(id).catch(() => null);
  const pendingMerged = mergeLocalSheetWithPendingUpdates(local, pending, id);

  if (isOnline()) {
    try {
      const sheet = await api.sheets.get(id);
      const pendingAfter = await offlineGetPending();
      const localAfter = await offlineGetSheet(id).catch(() => null);
      const mergedAfter = mergeLocalSheetWithPendingUpdates(localAfter, pendingAfter, id);
      const localSheets = await offlineGetAllSheets().catch(() => []);
      const candidates = [mergedAfter, localAfter, ...localSheets].filter(
        (s): s is FatigueSheet => Boolean(s)
      );
      const richer = findRicherLocalSheet(sheet, candidates);
      const base = richer ?? mergedAfter ?? localAfter ?? sheet;
      const kept = overlayLocalSheetOnNetwork(base, { ...sheet, id }, {
        keepLocalAttestation: pendingTouchesAttestation(pendingAfter, id),
      });
      await confirmDeviceSheetWrite(kept);
      if (hasPendingUpdateForSheet(pendingAfter, id) || shouldPreferLocalSheet(kept, sheet)) {
        await offlineEnqueueSheetUpdate(
          id,
          withoutUnqueuedAttestation(toSheetUpdatePayload(kept), pendingAfter, id)
        );
        void runSync().catch(() => {});
      }
      return kept;
    } catch {
      if (pendingMerged) return pendingMerged;
      const cached =
        localSheetsFallback(await offlineGetAllSheets().catch(() => []), id) ?? local;
      if (cached) return cached;
      throw new Error("Sheet not found and not available offline.");
    }
  }

  if (pendingMerged) return pendingMerged;
  if (local) return local;
  throw new Error("You're offline and this sheet isn't cached. Connect to load it.");
}

function localSheetsFallback(localSheets: FatigueSheet[], id: string): FatigueSheet | null {
  return localSheets.find((s) => s.id === id) ?? null;
}

/** List sheets: network first, fallback to IndexedDB. */
export async function listSheetsOfflineFirst(): Promise<FatigueSheet[]> {
  const localSheets = await loadCoalescedLocalSheets();
  if (isOnline()) {
    try {
      const merged = await mergeAndPersistNetworkSheetList(await api.sheets.list());
      if (merged.some((s) => isLocalSheetTempId(s.id))) {
        void runSync().catch(() => {});
      }
      return hydrateMergedList(merged);
    } catch {
      const cached = await offlineGetSheetsList();
      return hydrateMergedList(
        mergeNetworkSheetListWithLocal(
          cached,
          localSheets,
          await pendingAttestationIdSet(localSheets)
        )
      );
    }
  }
  const cached = await offlineGetSheetsList();
  return hydrateMergedList(
    mergeNetworkSheetListWithLocal(
      cached,
      localSheets,
      await pendingAttestationIdSet(localSheets)
    )
  );
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

  const isLocalTemp = isLocalSheetTempId(sheetId);
  if (isLocalTemp) {
    await ensureLocalWeeksQueuedForSync([merged]).catch(() => {});
  } else {
    await offlineEnqueueSheetUpdate(sheetId, data);
  }
  // Push only after device + queue confirm. Local-* weeks POST via the create queue.
  await runSync().catch(() => {});

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

  if (isLocalSheetTempId(sheetId)) {
    await ensureLocalWeeksQueuedForSync([merged]).catch(() => {});
  } else {
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
  await offlineSetSheetsList([...list.filter((s) => s.id !== tempId), toSheetListIndex(local)]);
  await offlineEnqueue({ type: "create_week", tempId, data });
  scheduleDeviceBackupAfterWrite();

  let sync = await runSync().catch(() => ({ synced: 0 } as SyncResult));
  if (sync.replacedTempId?.tempId !== tempId && isOnline()) {
    sync = await runSync().catch(() => sync);
  }
  if (sync.replacedTempId?.tempId === tempId) {
    const real = await offlineGetSheet(sync.replacedTempId.realId).catch(() => null);
    if (real) return real;
    return { ...local, id: sync.replacedTempId.realId };
  }
  // Device has the week sheet; Neon create stays queued for the next online sync.
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
