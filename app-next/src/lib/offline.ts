/**
 * Offline-first storage and sync queue.
 * - Read: try network, on failure or when offline use IndexedDB cache.
 * - Write: save to IndexedDB immediately, queue for sync; when online, push to server.
 */

import type { FatigueSheet, SheetUpdatePayload } from "./api";
import type { Rego } from "./api";
import { patchIsAttestationOnly, type SheetPatchBody } from "./sheet-record";

export const OFFLINE_DB_NAME = "fatigue-offline";
export const OFFLINE_DB_VERSION = 2;
const DB_NAME = OFFLINE_DB_NAME;
const DB_VERSION = OFFLINE_DB_VERSION;
const STORE_SHEETS = "sheets";
const STORE_LIST = "sheetsList";
const STORE_REGOS = "regos";
const STORE_PENDING = "pending";
export const STORE_SNAPSHOTS = "snapshots";

export type PendingWrite =
  | { id: number; type: "update" | "patch_days"; sheetId: string; data: SheetUpdatePayload; at: number }
  | { id: number; type: "attest"; sheetId: string; data: SheetUpdatePayload; at: number }
  | { id: number; type: "create" | "create_week"; tempId: string; data: Omit<FatigueSheet, "id">; at: number };

/** Argument for offlineEnqueue (same shape as PendingWrite but without `at`). */
export type PendingWriteEnqueue =
  | { type: "update" | "patch_days"; sheetId: string; data: SheetUpdatePayload }
  | { type: "attest"; sheetId: string; data: SheetUpdatePayload }
  | { type: "create" | "create_week"; tempId: string; data: Omit<FatigueSheet, "id"> };

export function isCreatePending<T extends PendingWrite | PendingWriteEnqueue>(
  p: T
): p is Extract<T, { type: "create" | "create_week" }> {
  return p.type === "create" || p.type === "create_week";
}

export function isPatchDaysPending<T extends PendingWrite | PendingWriteEnqueue>(
  p: T
): p is Extract<T, { type: "update" | "patch_days" }> {
  return p.type === "update" || p.type === "patch_days";
}

export function isAttestPending<T extends PendingWrite | PendingWriteEnqueue>(
  p: T
): p is Extract<T, { type: "attest" }> {
  return p.type === "attest";
}

export function toPendingWriteEnqueue(p: PendingWrite): PendingWriteEnqueue {
  if (isCreatePending(p)) {
    return { type: "create_week", tempId: p.tempId, data: p.data };
  }
  if (isAttestPending(p)) {
    return { type: "attest", sheetId: p.sheetId, data: p.data };
  }
  return { type: "patch_days", sheetId: p.sheetId, data: p.data };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB only in browser"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SHEETS)) db.createObjectStore(STORE_SHEETS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_LIST)) db.createObjectStore(STORE_LIST, { keyPath: "key" });
      if (!db.objectStoreNames.contains(STORE_REGOS)) db.createObjectStore(STORE_REGOS, { keyPath: "key" });
      if (!db.objectStoreNames.contains(STORE_PENDING)) db.createObjectStore(STORE_PENDING, { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

/** All cached sheets (by id). */
export async function offlineGetAllSheets(): Promise<FatigueSheet[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, STORE_SHEETS).getAll();
    req.onsuccess = () => resolve((req.result as FatigueSheet[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Replace the full pending sync queue (used when restoring a snapshot). */
export async function offlineReplacePending(items: PendingWriteEnqueue[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, "readwrite");
    const store = tx.objectStore(STORE_PENDING);
    const clearReq = store.clear();
    clearReq.onerror = () => reject(clearReq.error);
    clearReq.onsuccess = () => {
      for (const item of items) {
        store.add({ ...item, at: Date.now() } as Omit<PendingWrite, "id">);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getStore(db: IDBDatabase, store: string, mode: IDBTransactionMode = "readonly") {
  return db.transaction(store, mode).objectStore(store);
}

export async function offlineGetSheet(id: string): Promise<FatigueSheet | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, STORE_SHEETS).get(id);
    req.onsuccess = () => resolve((req.result as FatigueSheet) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function offlineSetSheet(sheet: FatigueSheet): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, STORE_SHEETS, "readwrite").put(sheet);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function offlineDeleteSheet(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, STORE_SHEETS, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function offlineGetSheetsList(): Promise<FatigueSheet[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, STORE_LIST).get("list");
    req.onsuccess = () => resolve((req.result?.value as FatigueSheet[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function offlineSetSheetsList(sheets: FatigueSheet[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, STORE_LIST, "readwrite").put({ key: "list", value: sheets });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function offlineGetRegos(): Promise<Rego[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, STORE_REGOS).get("regos");
    req.onsuccess = () => resolve((req.result?.value as Rego[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function offlineSetRegos(regos: Rego[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, STORE_REGOS, "readwrite").put({ key: "regos", value: regos });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function offlineGetPending(): Promise<PendingWrite[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORE_PENDING);
    const valuesReq = store.getAll();
    const keysReq = store.getAllKeys();
    valuesReq.onerror = () => reject(valuesReq.error);
    keysReq.onerror = () => reject(keysReq.error);
    valuesReq.onsuccess = () => {
      if (keysReq.readyState !== "done") return;
      const values = (valuesReq.result as Omit<PendingWrite, "id">[]) ?? [];
      const keys = (keysReq.result as IDBValidKey[]) ?? [];
      const combined = values
        .map((v, idx) => {
          const key = keys[idx];
          return typeof key === "number" ? ({ ...v, id: key } as PendingWrite) : null;
        })
        .filter(Boolean) as PendingWrite[];
      resolve(combined);
    };
    keysReq.onsuccess = () => {
      if (valuesReq.readyState !== "done") return;
      const values = (valuesReq.result as Omit<PendingWrite, "id">[]) ?? [];
      const keys = (keysReq.result as IDBValidKey[]) ?? [];
      const combined = values
        .map((v, idx) => {
          const key = keys[idx];
          return typeof key === "number" ? ({ ...v, id: key } as PendingWrite) : null;
        })
        .filter(Boolean) as PendingWrite[];
      resolve(combined);
    };
  });
}

export async function offlineEnqueue(write: PendingWriteEnqueue): Promise<void> {
  const db = await openDB();
  const withAt = { ...write, at: Date.now() } as Omit<PendingWrite, "id">;
  return new Promise((resolve, reject) => {
    const req = getStore(db, STORE_PENDING, "readwrite").add(withAt);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Queue a content patch or a week signature as separate named operations. */
export async function offlineEnqueueSheetUpdate(
  sheetId: string,
  data: SheetUpdatePayload
): Promise<void> {
  const pending = await offlineGetPending();
  if (patchIsAttestationOnly(data as SheetPatchBody)) {
    for (const item of pending) {
      if (isAttestPending(item) && item.sheetId === sheetId) {
        await offlineRemovePending(item.id);
      }
    }
    await offlineEnqueue({
      type: "attest",
      sheetId,
      data: {
        status: data.status,
        signature: data.signature,
        signed_at: data.signed_at,
      },
    });
    return;
  }
  for (const item of pending) {
    if (isPatchDaysPending(item) && item.sheetId === sheetId) {
      await offlineRemovePending(item.id);
    }
  }
  const content: SheetUpdatePayload = { ...data };
  delete content.signature;
  delete content.signed_at;
  if (content.status === "completed") delete content.status;
  await offlineEnqueue({ type: "patch_days", sheetId, data: content });
}

/** Remove a single pending write by id (IDB key). */
export async function offlineRemovePending(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, STORE_PENDING, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}
