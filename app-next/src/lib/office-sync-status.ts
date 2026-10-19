/** Last time this phone successfully compared with / wrote to the office copy (Neon). */

const LAST_OFFICE_SYNC_KEY = "fatigue-last-office-sync-at";

export function recordOfficeSyncAt(at = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_OFFICE_SYNC_KEY, at.toISOString());
  } catch {
    /* ignore quota / private mode */
  }
}

export function getLastOfficeSyncAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_OFFICE_SYNC_KEY);
  } catch {
    return null;
  }
}

export function formatLastOfficeSyncLabel(iso: string | null, prefix: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const when = d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${prefix} ${when}`;
}
