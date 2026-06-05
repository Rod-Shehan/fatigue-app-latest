/**
 * Device-bound driver session for use when the network or NextAuth is unavailable.
 * Saved after a successful online sign-in; not a substitute for server authentication.
 */

export type OfflineAuthSnapshot = {
  userId: string;
  email: string;
  name: string | null;
  role: string | null;
  savedAt: number;
  expiresAt: number;
};

/** Align with NextAuth JWT maxAge (30 days). */
export const OFFLINE_AUTH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const SNAPSHOT_KEY = "fatigue-offline-auth";
const ACTIVE_KEY = "fatigue-offline-auth-active";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function saveOfflineAuth(user: {
  id?: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
}): void {
  if (!canUseStorage() || !user.id || !user.email) return;
  const now = Date.now();
  const snapshot: OfflineAuthSnapshot = {
    userId: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role ?? null,
    savedAt: now,
    expiresAt: now + OFFLINE_AUTH_MAX_AGE_MS,
  };
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function getOfflineAuth(): OfflineAuthSnapshot | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineAuthSnapshot;
    if (!parsed.userId || !parsed.email || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) {
      clearOfflineAuth();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isDriverOfflineSnapshot(snapshot: OfflineAuthSnapshot | null): boolean {
  return !!snapshot && snapshot.role !== "manager";
}

export function activateOfflineSession(): void {
  if (!canUseStorage()) return;
  localStorage.setItem(ACTIVE_KEY, "1");
}

export function deactivateOfflineSession(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(ACTIVE_KEY);
}

export function isOfflineSessionActive(): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(ACTIVE_KEY) === "1" && isDriverOfflineSnapshot(getOfflineAuth());
}

export function clearOfflineAuth(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(SNAPSHOT_KEY);
  localStorage.removeItem(ACTIVE_KEY);
}
