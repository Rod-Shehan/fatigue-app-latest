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

/**
 * Production sign-in:
 * - Default: fleet shared password (NEXTAUTH_CREDENTIALS_PASSWORD) is checked before bcrypt when it matches
 *   (NEXTAUTH_SHARED_PASSWORD_PRIORITY defaults to on). Set NEXTAUTH_SHARED_PASSWORD_PRIORITY=false to require
 *   per-user password when passwordHash exists.
 * - User without passwordHash: NEXTAUTH_CREDENTIALS_PASSWORD must be set; password field must match (trimmed).
 *
 * Dev / staging (opt-in via NEXTAUTH_ALLOW_DEV_LOGIN — see auth-dev-login.ts and .env.example):
 * - Local: blank fields → dev@localhost; email + blank password if no passwordHash.
 * - Vercel preview: same blank-password rule when ALLOW_DEV_LOGIN=true.
 * - Any deploy with ALLOW_DEV_LOGIN + NEXTAUTH_DEV_BYPASS_SECRET: use that secret as the password.
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" as const, maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email ?? "").trim().toLowerCase();
        const password = credentials?.password ?? "";
        const sharedPassRaw = process.env.NEXTAUTH_CREDENTIALS_PASSWORD;
        const sharedPass =
          typeof sharedPassRaw === "string" && sharedPassRaw.trim().length > 0 ? sharedPassRaw.trim() : "";
        // Default true (fleet password first). Opt out with NEXTAUTH_SHARED_PASSWORD_PRIORITY=false or 0.
        const sharedPasswordPriority =
          process.env.NEXTAUTH_SHARED_PASSWORD_PRIORITY !== "false" &&
          process.env.NEXTAUTH_SHARED_PASSWORD_PRIORITY !== "0";

        const localDev = await tryLocalDevelopmentLogin(email, password);
        if (localDev) return localDev;

        const bypass = await tryDevBypassSecretLogin(email, password);
        if (bypass) return bypass;

        const passwordlessStaging = await tryPasswordlessStagingLogin(email, password);
        if (passwordlessStaging) return passwordlessStaging;

        if (!email) return null;

        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true },
        });

        const sharedPasswordMatches = sharedPass.length > 0 && password.trim() === sharedPass;

        // Optional: fleet shared password wins over per-user hash (forgotten passwords, rotated shared secret).
        if (sharedPasswordPriority && sharedPasswordMatches) {
          let user = existing;
          if (!user) {
            user = await prisma.user.create({
              data: { email, name: email.split("@")[0] },
              select: { id: true, email: true, name: true, passwordHash: true },
            });
          }
          return { id: user.id, email: user.email, name: user.name };
        }

        // If the user has a manager-set password, require it (unless shared priority handled above).
        if (existing?.passwordHash) {
          if (!password) return null;
          const ok = await bcrypt.compare(password, existing.passwordHash);
          if (!ok) return null;
          return { id: existing.id, email: existing.email, name: existing.name };
        }

        // (Dev blank-password handling is done above, before shared/passwordHash logic.)

        // Shared password when user has no passwordHash (or hash path skipped). Trimmed match.
        if (sharedPasswordMatches) {
          let user = existing;
          if (!user) {
            user = await prisma.user.create({
              data: { email, name: email.split("@")[0] },
            });
          }
          return { id: user.id, email: user.email, name: user.name };
        }
        return null;
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
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = dbUser?.role ?? null;
      }
      if (token.role === undefined && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true },
        });
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
};

/**
 * Returns session and sheet-access context: drivers can only access their own sheets
 * (createdById === userId); managers can access all. Use with canAccessSheet.
 */
export async function getSessionForSheetAccess(): Promise<SheetAccess | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? (session.user as { id: string }).id : undefined;
  if (!userId) return null;
  const manager = await getManagerSession();
  return {
    session: session!,
    userId,
    isManager: !!manager,
  };
}

/**
 * True if the given access can read/update this sheet. Drivers: only own sheets (createdById match).
 * Managers: all sheets.
 */
export function canAccessSheet(
  sheet: { createdById: string | null },
  access: SheetAccess
): boolean {
  if (access.isManager) return true;
  return sheet.createdById === access.userId;
}

type ManagerSessionResult = {
  session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>;
  user: { id: string; email: string | null; name: string | null; role: string | null };
};

async function loadManagerSessionUser(): Promise<ManagerSessionResult | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id?: string }).id : undefined;
  if (!userId || !session) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return null;
  return { session, user };
}

/** Strict manager role from DB — use for API data access and manager-only pages. */
export async function getManagerSession(): Promise<ManagerSessionResult | null> {
  const loaded = await loadManagerSessionUser();
  if (!loaded || loaded.user.role !== "manager") return null;
  return loaded;
}

/**
 * Manager UI bootstrap: allows any signed-in user when no manager exists yet.
 * Use only for /manager pages and POST /api/users (first manager). Never for sheet/driver APIs.
 */
export async function getManagerBootstrapSession(): Promise<ManagerSessionResult | null> {
  const loaded = await loadManagerSessionUser();
  if (!loaded) return null;
  if (loaded.user.role === "manager") return loaded;
  const anyManager = await prisma.user.findFirst({ where: { role: "manager" }, select: { id: true } });
  if (!anyManager) return loaded;
  return null;
}

/** Manager session or bootstrap — for creating the first manager account only. */
export async function getManagerOrBootstrapSession(): Promise<ManagerSessionResult | null> {
  return (await getManagerSession()) ?? (await getManagerBootstrapSession());
}
