/**
 * Rolling on-device backup snapshots (JSON only — no PDFs).
 * Survives partial cache loss when the snapshots store remains intact.
 */

import type { FatigueSheet, Rego } from "./api";
import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  STORE_SNAPSHOTS,
  type PendingWriteEnqueue,
  offlineGetAllSheets,
  offlineGetPending,
  offlineGetRegos,
  offlineGetSheetsList,
  offlineReplacePending,
  offlineSetRegos,
  offlineSetSheet,
  offlineSetSheetsList,
} from "./offline";
import { getOfflineAuth, saveOfflineAuth, type OfflineAuthSnapshot } from "./offline-auth";

export const DEVICE_BACKUP_SCHEMA_VERSION = 1;
export const MAX_DEVICE_SNAPSHOTS = 5;
const WRITE_DEBOUNCE_MS = 3000;
const HIDDEN_DEBOUNCE_MS = 5 * 60 * 1000;

export type DeviceBackupPayload = {
  schemaVersion: typeof DEVICE_BACKUP_SCHEMA_VERSION;
  at: number;
  driverEmail: string;
  sheetsList: FatigueSheet[];
  sheets: FatigueSheet[];
  pending: PendingWriteEnqueue[];
  regos: Rego[];
  offlineAuth: OfflineAuthSnapshot | null;
};

export type DeviceBackupRecord = DeviceBackupPayload & { id: number };

let writeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastBackupAt = 0;
let lastHiddenBackupAt = 0;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB only in browser"));
      return;
    }
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("sheets")) db.createObjectStore("sheets", { keyPath: "id" });
      if (!db.objectStoreNames.contains("sheetsList")) db.createObjectStore("sheetsList", { keyPath: "key" });
      if (!db.objectStoreNames.contains("regos")) db.createObjectStore("regos", { keyPath: "key" });
      if (!db.objectStoreNames.contains("pending")) {
        db.createObjectStore("pending", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

function getSnapshotStore(db: IDBDatabase, mode: IDBTransactionMode = "readonly") {
  return db.transaction(STORE_SNAPSHOTS, mode).objectStore(STORE_SNAPSHOTS);
}

async function listAllSnapshots(): Promise<DeviceBackupRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getSnapshotStore(db).getAll();
    req.onsuccess = () => {
      const rows = (req.result as DeviceBackupRecord[]) ?? [];
      resolve(rows.sort((a, b) => b.at - a.at));
    };
    req.onerror = () => reject(req.error);
  });
}

async function addSnapshot(payload: DeviceBackupPayload): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getSnapshotStore(db, "readwrite").add(payload);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deleteSnapshot(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getSnapshotStore(db, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function resolveDriverEmail(explicit?: string | null): string | null {
  const trimmed = explicit?.trim().toLowerCase();
  if (trimmed) return trimmed;
  const auth = getOfflineAuth();
  return auth?.email?.trim().toLowerCase() ?? null;
}

function uniqueSheets(list: FatigueSheet[], byId: FatigueSheet[]): FatigueSheet[] {
  const map = new Map<string, FatigueSheet>();
  for (const s of [...list, ...byId]) {
    if (s?.id) map.set(s.id, s);
  }
  return [...map.values()];
}

export async function collectDeviceBackupPayload(driverEmail?: string | null): Promise<DeviceBackupPayload | null> {
  const email = resolveDriverEmail(driverEmail);
  if (!email) return null;

  const [sheetsList, sheets, pendingRaw, regos] = await Promise.all([
    offlineGetSheetsList(),
    offlineGetAllSheets(),
    offlineGetPending(),
    offlineGetRegos(),
  ]);

  const sheetsForDriver = uniqueSheets(sheetsList, sheets);
  if (sheetsForDriver.length === 0 && pendingRaw.length === 0) return null;

  const pending: PendingWriteEnqueue[] = pendingRaw.map((p) =>
    p.type === "update"
      ? { type: "update", sheetId: p.sheetId, data: p.data }
      : { type: "create", tempId: p.tempId, data: p.data }
  );

  return {
    schemaVersion: DEVICE_BACKUP_SCHEMA_VERSION,
    at: Date.now(),
    driverEmail: email,
    sheetsList: sheetsForDriver,
    sheets: sheetsForDriver,
    pending,
    regos,
    offlineAuth: getOfflineAuth(),
  };
}

async function pruneSnapshotsForDriver(driverEmail: string): Promise<void> {
  const all = await listAllSnapshots();
  const mine = all.filter((s) => s.driverEmail === driverEmail);
  const excess = mine.slice(MAX_DEVICE_SNAPSHOTS);
  for (const row of excess) {
    if (row.id != null) await deleteSnapshot(row.id);
  }
}

/** Write a rolling snapshot now. Skips empty payloads unless `force`. */
export async function writeDeviceSnapshot(opts?: {
  driverEmail?: string | null;
  force?: boolean;
}): Promise<{ ok: boolean; at?: number }> {
  const payload = await collectDeviceBackupPayload(opts?.driverEmail);
  if (!payload) return { ok: false };
  await addSnapshot(payload);
  await pruneSnapshotsForDriver(payload.driverEmail);
  lastBackupAt = payload.at;
  return { ok: true, at: payload.at };
}

export function scheduleDeviceBackupAfterWrite(driverEmail?: string | null): void {
  if (typeof window === "undefined") return;
  if (writeDebounceTimer) clearTimeout(writeDebounceTimer);
  writeDebounceTimer = setTimeout(() => {
    writeDebounceTimer = null;
    void writeDeviceSnapshot({ driverEmail, force: false });
  }, WRITE_DEBOUNCE_MS);
}

/** Register background snapshot when the app is hidden (debounced). Returns cleanup. */
export function registerDeviceBackupOnHidden(driverEmail?: string | null): () => void {
  if (typeof document === "undefined") return () => {};
  const handler = () => {
    if (document.visibilityState !== "hidden") return;
    const now = Date.now();
    if (now - lastHiddenBackupAt < HIDDEN_DEBOUNCE_MS) return;
    lastHiddenBackupAt = now;
    void writeDeviceSnapshot({ driverEmail, force: false });
  };
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

export async function getLatestDeviceBackup(driverEmail?: string | null): Promise<DeviceBackupRecord | null> {
  const email = resolveDriverEmail(driverEmail);
  if (!email) return null;
  const all = await listAllSnapshots();
  return all.find((s) => s.driverEmail === email) ?? null;
}

export async function getDeviceBackupStatus(driverEmail?: string | null): Promise<{
  snapshotCount: number;
  lastBackupAt: number | null;
  weekCount: number;
}> {
  const email = resolveDriverEmail(driverEmail);
  const all = await listAllSnapshots();
  const mine = email ? all.filter((s) => s.driverEmail === email) : all;
  const latest = mine[0] ?? null;
  return {
    snapshotCount: mine.length,
    lastBackupAt: latest?.at ?? null,
    weekCount: latest?.sheetsList.length ?? 0,
  };
}

export async function restoreDeviceBackup(
  snapshot: DeviceBackupPayload | DeviceBackupRecord
): Promise<{ weekCount: number }> {
  for (const sheet of snapshot.sheets) {
    await offlineSetSheet(sheet);
  }
  await offlineSetSheetsList(snapshot.sheetsList);
  await offlineSetRegos(snapshot.regos);
  await offlineReplacePending(snapshot.pending);
  if (snapshot.offlineAuth) {
    saveOfflineAuth({
      id: snapshot.offlineAuth.userId,
      email: snapshot.offlineAuth.email,
      name: snapshot.offlineAuth.name,
      role: snapshot.offlineAuth.role,
    });
  }
  return { weekCount: snapshot.sheetsList.length };
}

/**
 * If live cache is empty but a snapshot exists, restore the latest for this driver.
 */
export async function tryAutoRestoreDeviceBackup(driverEmail?: string | null): Promise<{
  restored: boolean;
  weekCount: number;
} | null> {
  const list = await offlineGetSheetsList();
  if (list.length > 0) return null;

  const latest = await getLatestDeviceBackup(driverEmail);
  if (!latest || latest.sheetsList.length === 0) return null;

  const { weekCount } = await restoreDeviceBackup(latest);
  return { restored: true, weekCount };
}

export function formatBackupTime(at: number | null): string {
  if (!at) return "Never";
  return new Date(at).toLocaleString("en-AU", {
    timeZone: "Australia/Perth",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
