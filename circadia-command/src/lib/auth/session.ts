import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { type CommandRole, isCommandRole } from "@/lib/auth/roles";

export const SESSION_COOKIE = "command_session";
const ISSUER = "https://auth.circadia24.internal";
/** Desk sessions stay open until explicit logout (not idle timeout). */
export const PERSISTENT_SESSION_MAX_AGE_SEC = 10 * 365 * 24 * 60 * 60;

export type CommandSession = {
  sub: string;
  name: string;
  username: string | null;
  role: CommandRole;
};

function getSecret(): Uint8Array {
  const raw = process.env.COMMAND_SESSION_SECRET;
  if (!raw || raw.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("COMMAND_SESSION_SECRET must be set in production");
    }
    return new TextEncoder().encode("dev-command-session-secret-change-me");
  }
  return new TextEncoder().encode(raw);
}

function permissionsForRole(role: CommandRole): string[] {
  const base = ["triage:global", "intervention:trigger", "audit:read"];
  if (role === "command_owner") {
    return [...base, "operators:read", "operators:write"];
  }
  return base;
}

export async function signSession(payload: {
  operatorId: string;
  name: string;
  username: string | null;
  role: CommandRole;
}): Promise<string> {
  return new SignJWT({
    name: payload.name,
    username: payload.username,
    role: payload.role,
    authenticated: true,
    permissions: permissionsForRole(payload.role),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.operatorId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<CommandSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER });
    if (payload.sub == null || typeof payload.name !== "string") return null;
    const authenticated = payload.authenticated === true;
    if (!authenticated) return null;

    const roleRaw = typeof payload.role === "string" ? payload.role : "command_operator";
    const role: CommandRole = isCommandRole(roleRaw) ? roleRaw : "command_operator";

    return {
      sub: payload.sub,
      name: payload.name,
      username: typeof payload.username === "string" ? payload.username : null,
      role,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<CommandSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PERSISTENT_SESSION_MAX_AGE_SEC,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
