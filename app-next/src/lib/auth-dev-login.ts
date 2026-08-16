/**
 * Optional dev / staging login paths (off by default on production).
 *
 * All paths still require an active Approved Drivers roster row for field-driver emails.
 * Enable on Vercel while building: NEXTAUTH_ALLOW_DEV_LOGIN=true
 * Use a long random NEXTAUTH_DEV_BYPASS_SECRET as the password at login.
 */

import { prisma } from "./prisma";
import {
  ensureLoginUserForRosterDriver,
  findActiveDriverRosterByEmail,
  normalizeLoginEmail,
} from "./driver-login-gate";

export function isDevLoginEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXTAUTH_ALLOW_DEV_LOGIN === "true";
}

export function getDevBypassSecret(): string {
  const raw = process.env.NEXTAUTH_DEV_BYPASS_SECRET;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Preview deployments or local dev — allow email + blank password when no manager hash. */
export function allowsPasswordlessEmailLogin(): boolean {
  if (!isDevLoginEnabled()) return false;
  if (process.env.NODE_ENV === "development") return true;
  return process.env.VERCEL_ENV === "preview";
}

async function resolvePasswordlessRosterUser(
  email: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  const normalized = normalizeLoginEmail(email);
  if (!normalized) return null;

  const roster = await findActiveDriverRosterByEmail(normalized);
  if (!roster) return null;

  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, name: true, passwordHash: true, role: true },
  });
  if (existing?.passwordHash) return null;
  if (existing?.role === "manager" || existing?.role === "owner") {
    return { id: existing.id, email: existing.email!, name: existing.name };
  }

  const user = existing ?? (await ensureLoginUserForRosterDriver(normalized, roster.name, roster.tenantId));
  return { id: user.id, email: user.email!, name: user.name };
}

/** Local NODE_ENV=development: email + blank password when no per-user hash and on roster. */
export async function tryLocalDevelopmentLogin(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (process.env.NODE_ENV !== "development") return null;
  if (email === "" || password !== "") return null;
  return resolvePasswordlessRosterUser(email);
}

/**
 * Staging bypass: password must equal NEXTAUTH_DEV_BYPASS_SECRET.
 * Field drivers must still be on the active roster.
 */
export async function tryDevBypassSecretLogin(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (!isDevLoginEnabled() || !email) return null;
  const secret = getDevBypassSecret();
  if (!secret || password !== secret) return null;

  const normalized = normalizeLoginEmail(email);
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, name: true, role: true },
  });
  if (existing?.role === "manager" || existing?.role === "owner") {
    return { id: existing.id, email: existing.email!, name: existing.name };
  }

  return resolvePasswordlessRosterUser(normalized);
}

/** Preview + ALLOW_DEV_LOGIN: email with blank password if no per-user hash and on roster. */
export async function tryPasswordlessStagingLogin(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (!allowsPasswordlessEmailLogin() || !email || password !== "") return null;
  return resolvePasswordlessRosterUser(email);
}
