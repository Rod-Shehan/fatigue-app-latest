export const DEVICE_SETUP_COMPLETE_KEY = "fatigue-device-setup-complete";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function isDeviceSetupComplete(): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(DEVICE_SETUP_COMPLETE_KEY) === "1";
}

export function setDeviceSetupComplete(): void {
  if (!canUseStorage()) return;
  localStorage.setItem(DEVICE_SETUP_COMPLETE_KEY, "1");
}

export function clearDeviceSetupComplete(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(DEVICE_SETUP_COMPLETE_KEY);
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  // iOS: navigator.standalone
  const nav = navigator as unknown as { standalone?: boolean };
  if (typeof nav.standalone === "boolean") return nav.standalone;
  // Android/modern: matchMedia display-mode
  return window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
}

export type PersistStorageResult =
  | { supported: false; persisted: false }
  | { supported: true; persisted: boolean };

/**
 * Ask the browser to mark this origin's storage as persistent to reduce eviction.
 * This may show a one-time prompt on some browsers.
 */
export async function requestPersistentStorage(): Promise<PersistStorageResult> {
  if (typeof navigator === "undefined" || typeof (navigator as unknown as { storage?: unknown }).storage !== "object") {
    return { supported: false, persisted: false };
  }
  const storage = (navigator as unknown as { storage: { persist?: () => Promise<boolean> } }).storage;
  if (typeof storage.persist !== "function") return { supported: false, persisted: false };
  const persisted = await storage.persist().catch(() => false);
  return { supported: true, persisted };
}

export function isiOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(ua);
}

