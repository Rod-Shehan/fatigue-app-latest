/**
 * Optional alpha / production-test allow-list for driver + manager access.
 * When unset or empty, all roster-valid users may sign in (legacy behaviour).
 */

import { normalizeLoginEmail } from "@/lib/driver-login-gate";

/** NextAuth credentials error surfaced to the lobby sign-in form. */
export const ALPHA_RESTRICTED_ERROR = "alpha_restricted";

let cachedSet: Set<string> | null | undefined;

function parseAllowlist(): Set<string> | null {
  if (cachedSet !== undefined) return cachedSet;
  const raw = process.env.CIRCADIA_ALPHA_ALLOWLIST?.trim();
  if (!raw) {
    cachedSet = null;
    return cachedSet;
  }
  const emails = raw
    .split(/[,;\n]+/)
    .map((s) => normalizeLoginEmail(s))
    .filter(Boolean);
  cachedSet = emails.length > 0 ? new Set(emails) : null;
  return cachedSet;
}

export function isAlphaAllowlistEnabled(): boolean {
  return parseAllowlist() !== null;
}

export function isEmailAllowedForAlphaAccess(email: string | null | undefined): boolean {
  const set = parseAllowlist();
  if (!set) return true;
  const normalized = normalizeLoginEmail(email ?? "");
  if (!normalized) return false;
  return set.has(normalized);
}

/** Test helper — reset memoized env parse. */
export function resetAlphaAllowlistCacheForTests(): void {
  cachedSet = undefined;
}
