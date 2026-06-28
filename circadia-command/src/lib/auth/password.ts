import bcrypt from "bcryptjs";

export const MIN_OPERATOR_PASSWORD_LENGTH = 6;

export function parsePasswordInput(
  password: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof password !== "string") {
    return { ok: false, error: "Password is required." };
  }
  const trimmed = password.trim();
  if (trimmed.length < MIN_OPERATOR_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_OPERATOR_PASSWORD_LENGTH} characters.`,
    };
  }
  return { ok: true, value: trimmed };
}

export async function hashOperatorPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyOperatorPassword(
  plain: string,
  passwordHash: string | null | undefined
): Promise<boolean> {
  if (!passwordHash) return false;
  return bcrypt.compare(plain, passwordHash);
}
