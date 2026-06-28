import bcrypt from "bcryptjs";

export const MIN_USER_PASSWORD_LENGTH = 6;

export function parseOptionalPasswordInput(
  password: unknown
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (password === undefined) return { ok: true, value: undefined };
  if (typeof password !== "string") return { ok: false, error: "Password must be a string" };
  const trimmed = password.trim();
  if (trimmed.length === 0) return { ok: true, value: undefined };
  if (trimmed.length < MIN_USER_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_USER_PASSWORD_LENGTH} characters` };
  }
  return { ok: true, value: trimmed };
}

export function parseRequiredPasswordInput(
  password: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  const parsed = parseOptionalPasswordInput(password);
  if (!parsed.ok) return parsed;
  if (!parsed.value) return { ok: false, error: "Password is required" };
  return { ok: true, value: parsed.value };
}

export async function hashUserPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyUserPassword(plain: string, passwordHash: string | null | undefined): Promise<boolean> {
  if (!passwordHash) return false;
  return bcrypt.compare(plain, passwordHash);
}

export type UserPasswordWriteFields = {
  passwordHash: string;
  passwordSetAt: Date;
  passwordSetById: string;
};

export async function buildUserPasswordWriteFields(
  plain: string,
  setByUserId: string
): Promise<UserPasswordWriteFields> {
  return {
    passwordHash: await hashUserPassword(plain),
    passwordSetAt: new Date(),
    passwordSetById: setByUserId,
  };
}
