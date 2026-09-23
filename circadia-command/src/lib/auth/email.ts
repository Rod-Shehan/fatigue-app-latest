const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Empty string clears email. Invalid shape is rejected. */
export function parseEmailInput(
  email: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (email === undefined || email === null) {
    return { ok: true, value: null };
  }
  if (typeof email !== "string") {
    return { ok: false, error: "Email must be a string." };
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > 255 || !EMAIL_PATTERN.test(normalized)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  return { ok: true, value: normalized };
}
