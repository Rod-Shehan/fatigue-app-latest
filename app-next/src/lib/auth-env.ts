/**
 * Production auth environment helpers (driver + manager app).
 */

export function getNextAuthUrl(): string {
  const raw = process.env.NEXTAUTH_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return "";
  return "http://localhost:3000";
}

/** True when session cookies must use Secure + __Secure- prefix (HTTPS deployment). */
export function useSecureAuthCookies(): boolean {
  const url = getNextAuthUrl();
  if (url.startsWith("https://")) return true;
  return process.env.NODE_ENV === "production";
}

/**
 * Shared fleet password (NEXTAUTH_CREDENTIALS_PASSWORD) is for local dev only unless
 * explicitly opted in for a controlled pilot.
 */
export function isSharedLoginPasswordAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const raw = process.env.CIRCADIA_ALLOW_SHARED_LOGIN_PASSWORD?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function assertProductionAuthConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.NEXTAUTH_SECRET?.trim()) {
    console.error("[auth] NEXTAUTH_SECRET is required in production");
  }
  const url = getNextAuthUrl();
  if (!url.startsWith("https://")) {
    console.error("[auth] NEXTAUTH_URL must be https:// in production");
  }
}
