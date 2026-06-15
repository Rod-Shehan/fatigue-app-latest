import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "command_session";
export const CHALLENGE_COOKIE = "command_webauthn_challenge";
const ISSUER = "https://auth.circadia24.internal";
const MAX_AGE_SEC = 4 * 60 * 60;

export type CommandSession = {
  sub: string;
  name: string;
  role: "command_operator";
  hardware_mfa_verified: boolean;
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

export async function signSession(payload: {
  operatorId: string;
  name: string;
  hardwareMfaVerified: boolean;
}): Promise<string> {
  return new SignJWT({
    name: payload.name,
    role: "command_operator",
    hardware_mfa_verified: payload.hardwareMfaVerified,
    permissions: ["triage:global", "intervention:trigger", "audit:read"],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.operatorId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<CommandSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER });
    if (payload.sub == null || typeof payload.name !== "string") return null;
    return {
      sub: payload.sub,
      name: payload.name,
      role: "command_operator",
      hardware_mfa_verified: payload.hardware_mfa_verified === true,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<CommandSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session?.hardware_mfa_verified) return null;
  return session;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export type ChallengePayload = {
  operatorId: string;
  challenge: string;
  flow: "register" | "login";
};

export async function signChallenge(payload: ChallengePayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(getSecret());
}

export async function verifyChallenge(token: string): Promise<ChallengePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.operatorId !== "string" ||
      typeof payload.challenge !== "string" ||
      (payload.flow !== "register" && payload.flow !== "login")
    ) {
      return null;
    }
    return {
      operatorId: payload.operatorId,
      challenge: payload.challenge,
      flow: payload.flow,
    };
  } catch {
    return null;
  }
}

export async function setChallengeCookie(token: string) {
  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
}

export async function readChallengeCookie(): Promise<ChallengePayload | null> {
  const jar = await cookies();
  const token = jar.get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  return verifyChallenge(token);
}

export async function clearChallengeCookie() {
  const jar = await cookies();
  jar.delete(CHALLENGE_COOKIE);
}
