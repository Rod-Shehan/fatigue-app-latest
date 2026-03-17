/**
 * Offline-first storage and sync queue.
 * - Read: try network, on failure or when offline use IndexedDB cache.
 * - Write: save to IndexedDB immediately, queue for sync; when online, push to server.
 */

import type { FatigueSheet } from "./api";
import type { Rego } from "./api";

const DB_NAME = "fatigue-offline";
const DB_VERSION = 1;
const STORE_SHEETS = "sheets";
const STORE_LIST = "sheetsList";
const STORE_REGOS = "regos";
const STORE_PENDING = "pending";

export type PendingWrite =
  | { id: number; type: "update"; sheetId: string; data: Partial<FatigueSheet>; at: number }
  | { id: number; type: "create"; tempId: string; data: Omit<FatigueSheet, "id">; at: number };

/** Argument for offlineEnqueue (same shape as PendingWrite but without `at`). */
export type PendingWriteEnqueue =
  | { type: "update"; sheetId: string; data: Partial<FatigueSheet> }
  | { type: "create"; tempId: string; data: Omit<FatigueSheet, "id"> };

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
    };
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
