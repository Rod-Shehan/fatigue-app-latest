import { getServerSession, type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import {
  tryDevBypassSecretLogin,
  tryLocalDevelopmentLogin,
  tryPasswordlessStagingLogin,
} from "./auth-dev-login";
import {
  finalizeCredentialsLogin,
  normalizeLoginEmail,
  resolveRosterDriverUserForLogin,
  ROSTER_LOGIN_ERROR,
} from "./driver-login-gate";
import { isFleetManagerRole, isOwnerRole } from "./roles";
import { getSystemPolicy, loginBlockedForRole } from "./system-policy";
import { ALPHA_RESTRICTED_ERROR, isEmailAllowedForAlphaAccess } from "./auth-alpha-allowlist";
import { assertProductionAuthConfig, isSharedLoginPasswordAllowed, useSecureAuthCookies } from "./auth-env";
import { logLoginAttempt, type LoginAuditOutcome } from "./auth-login-audit";

assertProductionAuthConfig();

const secureCookies = useSecureAuthCookies();

/**
 * Production sign-in:
 * - Field drivers must be on the Approved Drivers roster (active, matching email).
 * - Per-user bcrypt when manager set a password on add/edit driver.
 * - Fleet shared password (NEXTAUTH_CREDENTIALS_PASSWORD) when no per-user hash — does not
 *   create accounts for unknown emails; roster must exist first (manager adds driver).
 *
 * Dev / staging (opt-in via NEXTAUTH_ALLOW_DEV_LOGIN — see auth-dev-login.ts):
 * - Local/preview blank-password login only for roster emails without a passwordHash.
 * - NEXTAUTH_DEV_BYPASS_SECRET as password — still roster-gated for field drivers.
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" as const, maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/" },
  cookies: {
    sessionToken: {
      name: secureCookies ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
      },
    },
    callbackUrl: {
      name: secureCookies ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
      },
    },
    csrfToken: {
      name: secureCookies ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = normalizeLoginEmail(credentials?.email ?? "");
        const password = credentials?.password ?? "";

        function reject(outcome: LoginAuditOutcome, role?: string | null): null {
          logLoginAttempt({ outcome, email: email || undefined, role });
          return null;
        }

        const sharedPassRaw = process.env.NEXTAUTH_CREDENTIALS_PASSWORD;
        const sharedPass =
          isSharedLoginPasswordAllowed() &&
          typeof sharedPassRaw === "string" &&
          sharedPassRaw.trim().length > 0
            ? sharedPassRaw.trim()
            : "";
        const sharedPasswordPriority =
          process.env.NEXTAUTH_SHARED_PASSWORD_PRIORITY !== "false" &&
          process.env.NEXTAUTH_SHARED_PASSWORD_PRIORITY !== "0";

        async function completeLogin(user: {
          id: string;
          email: string | null;
          name: string | null;
          role: string | null;
          disabledAt: Date | null;
        }) {
          try {
            return await finalizeCredentialsLogin(user);
          } catch (err) {
            if (err instanceof Error && err.message === ROSTER_LOGIN_ERROR) {
              throw err;
            }
            if (err instanceof Error && err.message === ALPHA_RESTRICTED_ERROR) {
              throw err;
            }
            return null;
          }
        }

        const localDev = await tryLocalDevelopmentLogin(email, password);
        if (localDev) {
          const devUser = await prisma.user.findUnique({
            where: { id: localDev.id },
            select: { id: true, email: true, name: true, role: true, disabledAt: true },
          });
          if (!devUser) return null;
          return completeLogin(devUser);
        }

        const bypass = await tryDevBypassSecretLogin(email, password);
        if (bypass) {
          const bypassUser = await prisma.user.findUnique({
            where: { id: bypass.id },
            select: { id: true, email: true, name: true, role: true, disabledAt: true },
          });
          if (!bypassUser) return null;
          return completeLogin(bypassUser);
        }

        const passwordlessStaging = await tryPasswordlessStagingLogin(email, password);
        if (passwordlessStaging) {
          const stagingUser = await prisma.user.findUnique({
            where: { id: passwordlessStaging.id },
            select: { id: true, email: true, name: true, role: true, disabledAt: true },
          });
          if (!stagingUser) return null;
          return completeLogin(stagingUser);
        }

        if (!email) return reject("invalid_credentials");

        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true, role: true, disabledAt: true },
        });

        if (existing?.disabledAt) return reject("account_disabled", existing.role);

        const policy = await getSystemPolicy();
        if (loginBlockedForRole(policy, existing?.role)) {
          return reject("policy_blocked", existing?.role);
        }

        const sharedPasswordMatches = sharedPass.length > 0 && password.trim() === sharedPass;

        if (sharedPasswordPriority && sharedPasswordMatches) {
          const user = existing ?? (await resolveRosterDriverUserForLogin(email));
          if (!user) return null;
          if (loginBlockedForRole(policy, user.role)) return null;
          return completeLogin(user);
        }

        if (existing?.passwordHash) {
          if (!password) return reject("invalid_credentials", existing.role);
          const ok = await bcrypt.compare(password, existing.passwordHash);
          if (!ok) return reject("invalid_credentials", existing.role);
          return completeLogin(existing);
        }

        if (sharedPasswordMatches) {
          const user = existing ?? (await resolveRosterDriverUserForLogin(email));
          if (!user) return reject("invalid_credentials");
          if (loginBlockedForRole(policy, user.role)) {
            return reject("policy_blocked", user.role);
          }
          return completeLogin(user);
        }
        return reject("invalid_credentials", existing?.role);
      },
    }),
  ],
  callbacks: {
    async jwt({
      token,
      user,
    }: {
      token: Record<string, unknown> & { id?: string; email?: string | null; name?: string | null; role?: string | null };
      user?: { id: string; email?: string | null; name?: string | null };
    }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, disabledAt: true, email: true },
        });
        if (dbUser?.disabledAt) {
          return {};
        }
        const email = dbUser?.email ?? (token.email as string | undefined);
        if (email && !isEmailAllowedForAlphaAccess(email)) {
          return {};
        }
        token.role = dbUser?.role ?? null;
      }
      return token;
    },
    async session({
      session,
      token,
    }: {
      session: import("next-auth").Session;
      token: Record<string, unknown> & { id?: string; name?: string | null; email?: string | null; role?: string | null };
    }) {
      if (!token.id) return session;
      if (session.user) {
        (session.user as { id?: string; role?: string | null }).id = token.id as string;
        if ("name" in token) session.user.name = (token.name as string | null) ?? session.user.name ?? null;
        if ("email" in token) session.user.email = (token.email as string | null) ?? session.user.email ?? null;
        (session.user as { role?: string | null }).role = (token.role as string | null) ?? null;
      }
      return session;
    },
  },
};

export type SheetAccess = {
  session: { user?: { id?: string; email?: string | null; name?: string | null } };
  userId: string;
  isManager: boolean;
  isOwner: boolean;
};

export async function getSessionForSheetAccess(): Promise<SheetAccess | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? (session.user as { id: string }).id : undefined;
  if (!userId) return null;
  const role = (session?.user as { role?: string | null } | undefined)?.role;
  return {
    session: session!,
    userId,
    isManager: isFleetManagerRole(role),
    isOwner: isOwnerRole(role),
  };
}

export function canAccessSheet(
  sheet: { createdById: string | null },
  access: SheetAccess
): boolean {
  if (access.isManager) return true;
  return sheet.createdById === access.userId;
}

type AuthSessionResult = {
  session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>;
  user: { id: string; email: string | null; name: string | null; role: string | null };
};

export async function loadAuthUser(): Promise<AuthSessionResult | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id?: string }).id : undefined;
  if (!userId || !session) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return null;
  return { session, user };
}

/** Fleet manager or owner — manager-area pages and fleet APIs. */
export async function getManagerSession(): Promise<AuthSessionResult | null> {
  const loaded = await loadAuthUser();
  if (!loaded || !isFleetManagerRole(loaded.user.role)) return null;
  return loaded;
}

/** Organisation owner / IT admin — governance and security only. */
export async function getOwnerSession(): Promise<AuthSessionResult | null> {
  const loaded = await loadAuthUser();
  if (!loaded || !isOwnerRole(loaded.user.role)) return null;
  return loaded;
}

function getOwnerSeedEmail(): string | null {
  const raw = process.env.OWNER_SEED_EMAIL;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * First owner setup: signed-in user matches OWNER_SEED_EMAIL when no owner exists yet.
 * Use only for /admin/security and POST /api/admin/claim-owner.
 */
export async function getOwnerBootstrapSession(): Promise<AuthSessionResult | null> {
  const loaded = await loadAuthUser();
  if (!loaded) return null;
  if (isOwnerRole(loaded.user.role)) return loaded;
  const anyOwner = await prisma.user.findFirst({ where: { role: "owner" }, select: { id: true } });
  if (anyOwner) return null;
  const seedEmail = getOwnerSeedEmail();
  if (!seedEmail || loaded.user.email?.toLowerCase() !== seedEmail) return null;
  return loaded;
}

export async function getOwnerOrBootstrapSession(): Promise<AuthSessionResult | null> {
  return (await getOwnerSession()) ?? (await getOwnerBootstrapSession());
}

/**
 * Manager UI bootstrap when no owner and no manager exist (legacy greenfield only).
 * Once an owner exists, managers must be appointed by the owner.
 */
export async function getManagerBootstrapSession(): Promise<AuthSessionResult | null> {
  const loaded = await loadAuthUser();
  if (!loaded) return null;
  if (isFleetManagerRole(loaded.user.role)) return loaded;
  const anyOwner = await prisma.user.findFirst({ where: { role: "owner" }, select: { id: true } });
  if (anyOwner) return null;
  const anyManager = await prisma.user.findFirst({ where: { role: "manager" }, select: { id: true } });
  if (!anyManager) return loaded;
  return null;
}
