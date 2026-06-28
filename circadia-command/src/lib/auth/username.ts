const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function parseUsernameInput(
  username: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof username !== "string") {
    return { ok: false, error: "Username is required." };
  }
  const normalized = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      ok: false,
      error: "Username must be 3–32 characters (letters, numbers, . _ -).",
    };
  }
  return { ok: true, value: normalized };
}
