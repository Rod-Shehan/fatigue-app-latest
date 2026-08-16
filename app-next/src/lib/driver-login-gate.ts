/**
 * Field drivers must appear on the manager Approved Drivers roster (active, matching email).
 * Managers and owners are not roster-gated.
 */

import { prisma } from "@/lib/prisma";
import { isFleetManagerRole } from "@/lib/roles";
import { getSystemPolicy, loginBlockedForRole } from "@/lib/system-policy";
import {
  ALPHA_RESTRICTED_ERROR,
  isEmailAllowedForAlphaAccess,
} from "@/lib/auth-alpha-allowlist";
import { logLoginAttempt } from "@/lib/auth-login-audit";
import { assertClientLoginAllowed, CLIENT_PAUSED_ERROR } from "@/lib/tenant";

/** NextAuth credentials error code surfaced to the lobby sign-in form. */
export const ROSTER_LOGIN_ERROR = "not_on_roster";

export const ROSTER_LOGIN_MESSAGE =
  "This email is not on the approved driver list (or the driver is inactive). Ask your manager to add you under Approved Drivers.";

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function requiresApprovedDriverRoster(role: string | null | undefined): boolean {
  return !isFleetManagerRole(role);
}

export async function findActiveDriverRosterByEmail(email: string) {
  const normalized = normalizeLoginEmail(email);
  if (!normalized) return null;
  return prisma.driver.findFirst({
    where: { email: normalized, isActive: true },
    select: { id: true, name: true, email: true, tenantId: true },
  });
}

export type CredentialsUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  disabledAt: Date | null;
  tenantId: string;
  platformAdmin?: boolean;
};

export async function ensureLoginUserForRosterDriver(
  email: string,
  rosterName: string,
  tenantId: string
): Promise<CredentialsUserRow> {
  const normalized = normalizeLoginEmail(email);
  return prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, name: rosterName, role: null, tenantId },
    update: { name: rosterName },
    select: { id: true, email: true, name: true, role: true, disabledAt: true, tenantId: true, platformAdmin: true },
  });
}

/**
 * Final gate after password checks: policy, disabled accounts, and roster for field drivers.
 * Throws Error(ROSTER_LOGIN_ERROR) when a field driver is not on the active roster.
 */
export async function finalizeCredentialsLogin(
  user: CredentialsUserRow
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (!user.email || user.disabledAt) {
    logLoginAttempt({
      outcome: "account_disabled",
      email: user.email ?? undefined,
      role: user.role,
    });
    return null;
  }

  const policy = await getSystemPolicy();
  if (loginBlockedForRole(policy, user.role)) {
    logLoginAttempt({
      outcome: "policy_blocked",
      email: user.email,
      role: user.role,
    });
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { status: true },
  });
  try {
    assertClientLoginAllowed({ tenantStatus: tenant?.status, user });
  } catch (err) {
    if (err instanceof Error && err.message === CLIENT_PAUSED_ERROR) {
      logLoginAttempt({
        outcome: "client_paused",
        email: user.email,
        role: user.role,
      });
      throw err;
    }
    throw err;
  }

  if (!isEmailAllowedForAlphaAccess(user.email)) {
    logLoginAttempt({
      outcome: "alpha_restricted",
      email: user.email,
      role: user.role,
    });
    throw new Error(ALPHA_RESTRICTED_ERROR);
  }

  if (!requiresApprovedDriverRoster(user.role)) {
    logLoginAttempt({
      outcome: "success",
      email: user.email,
      role: user.role,
    });
    return { id: user.id, email: user.email, name: user.name };
  }

  const roster = await findActiveDriverRosterByEmail(user.email);
  if (!roster || roster.tenantId !== user.tenantId) {
    logLoginAttempt({
      outcome: "roster_rejected",
      email: user.email,
      role: user.role,
    });
    throw new Error(ROSTER_LOGIN_ERROR);
  }

  let name = user.name;
  if (roster.name !== user.name) {
    await prisma.user.update({ where: { id: user.id }, data: { name: roster.name } });
    name = roster.name;
  }

  logLoginAttempt({
    outcome: "success",
    email: user.email,
    role: user.role,
  });
  return { id: user.id, email: user.email, name };
}

/** Resolve a field-driver login user from roster when no User row exists yet (shared password path). */
export async function resolveRosterDriverUserForLogin(
  email: string
): Promise<CredentialsUserRow | null> {
  const roster = await findActiveDriverRosterByEmail(email);
  if (!roster) return null;
  const existing = await prisma.user.findUnique({
    where: { email: normalizeLoginEmail(email) },
    select: { id: true, email: true, name: true, role: true, disabledAt: true, tenantId: true, platformAdmin: true },
  });
  if (existing) return existing;
  return ensureLoginUserForRosterDriver(email, roster.name, roster.tenantId);
}
