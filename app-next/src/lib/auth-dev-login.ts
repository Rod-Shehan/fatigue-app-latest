/**
 * Optional dev / staging login paths (off by default on production).
 *
 * Enable on Vercel while building: NEXTAUTH_ALLOW_DEV_LOGIN=true
 * Use a long random NEXTAUTH_DEV_BYPASS_SECRET as the password at login.
 * Remove both before public launch.
 */

import { prisma } from "./prisma";

export function isDevLoginEnabled(): boolean {
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

type UserRow = { id: string; email: string; name: string | null; passwordHash: string | null };

async function provisionUser(email: string): Promise<UserRow> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (existing) return existing;
  return prisma.user.create({
    data: { email, name: email.split("@")[0] },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
}

/** Local NODE_ENV=development blank-password flows (unchanged behaviour). */
export async function tryLocalDevelopmentLogin(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (process.env.NODE_ENV !== "development") return null;

  if (email === "" && password === "") {
    const devEmail = "dev@localhost";
    const user = await provisionUser(devEmail);
    return { id: user.id, email: user.email, name: user.name };
  }

  if (email !== "" && password === "") {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
    if (existing?.passwordHash) return null;
    const user = await provisionUser(email);
    return { id: user.id, email: user.email, name: user.name };
  }

  return null;
}

/**
 * Staging bypass: password must equal NEXTAUTH_DEV_BYPASS_SECRET.
 * Works even when the user has a manager-set passwordHash.
 */
export async function tryDevBypassSecretLogin(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (!isDevLoginEnabled() || !email) return null;
  const secret = getDevBypassSecret();
  if (!secret || password !== secret) return null;
  const user = await provisionUser(email);
  return { id: user.id, email: user.email, name: user.name };
}

/** Preview + ALLOW_DEV_LOGIN: email with blank password if no per-user hash. */
export async function tryPasswordlessStagingLogin(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (!allowsPasswordlessEmailLogin() || !email || password !== "") return null;
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (existing?.passwordHash) return null;
  const user = await provisionUser(email);
  return { id: user.id, email: user.email, name: user.name };
}
