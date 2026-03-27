import NextAuth, { getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const authOptions = {
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
        // Dev only: allow blank credentials to sign in as a dev user (login page stays, fields can be empty)
        if (process.env.NODE_ENV === "development" && email === "" && password === "") {
          const devEmail = "dev@localhost";
          let user = await prisma.user.findUnique({ where: { email: devEmail } });
          if (!user) {
            user = await prisma.user.create({
              data: { email: devEmail, name: "Dev User" },
            });
          }
          return { id: user.id, email: user.email, name: user.name };
        }
        if (!email) return null;

        // If the user has a manager-set password, require it (no passwordless/shared bypass).
        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true },
        });
        if (existing?.passwordHash) {
          if (!password) return null;
          const ok = await bcrypt.compare(password, existing.passwordHash);
          if (!ok) return null;
          return { id: existing.id, email: existing.email, name: existing.name };
        }

        // Dev only: email + empty password (no manager-set password). Never in production.
        if (process.env.NODE_ENV === "development" && password === "") {
          let user = existing;
          if (!user) {
            user = await prisma.user.create({
              data: { email, name: email.split("@")[0] },
              select: { id: true, email: true, name: true, passwordHash: true },
            });
          }
          return { id: user.id, email: user.email, name: user.name };
        }

        // Allow signing in with a shared password (NEXTAUTH_CREDENTIALS_PASSWORD)
        // in all environments. User records are created on first sign-in.
        const sharedPass = process.env.NEXTAUTH_CREDENTIALS_PASSWORD;
        if (sharedPass && password === sharedPass) {
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

/** Returns session and DB user if the current user has manager role (was added by a manager). Otherwise null. */
export async function getManagerSession() {
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id?: string }).id : undefined;
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return null;
  if (user.role === "manager") return { session, user };
  // Bootstrap: if no manager exists yet, allow this user to access manager area to add the first manager
  const anyManager = await prisma.user.findFirst({ where: { role: "manager" }, select: { id: true } });
  if (!anyManager) return { session, user };
  return null;
}
