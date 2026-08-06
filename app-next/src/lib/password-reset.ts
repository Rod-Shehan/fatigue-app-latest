/**
 * Self-service password reset (forgot password on lobby sign-in).
 * Raw tokens are emailed once; only SHA-256 hashes are stored.
 */

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { outboundEmailConfigured, sendOutboundEmail } from "@/lib/email/outbound";
import { buildUserPasswordWriteFields, parseRequiredPasswordInput } from "@/lib/user-password";
import { PRODUCT_NAME } from "@/lib/branding";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashPasswordResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function publicAppOrigin(): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

function newRawResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Always returns a generic ok payload (no email enumeration).
 * Sends mail only when Resend is configured and a usable account exists.
 */
export async function requestPasswordReset(emailRaw: unknown): Promise<{
  ok: true;
  emailConfigured: boolean;
  message: string;
}> {
  const emailConfigured = outboundEmailConfigured();
  const generic = {
    ok: true as const,
    emailConfigured,
    message: emailConfigured
      ? "If an account exists for that email, we sent a reset link. Check your inbox (and spam)."
      : "Password reset email is not configured on this server. Ask your manager (drivers) or organisation owner (managers) to reset your password.",
  };

  if (typeof emailRaw !== "string") return generic;
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) return generic;
  if (!emailConfigured) return generic;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, disabledAt: true },
  });
  if (!user?.email || user.disabledAt) return generic;

  const rawToken = newRawResetToken();
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    }),
  ]);

  const resetUrl = `${publicAppOrigin()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const result = await sendOutboundEmail({
    to: user.email,
    subject: `${PRODUCT_NAME} — reset your password`,
    text: [
      `Hello${user.name ? ` ${user.name}` : ""},`,
      "",
      `Reset your ${PRODUCT_NAME} login password using this link (expires in 1 hour):`,
      resetUrl,
      "",
      "If you did not ask for this, you can ignore this email.",
    ].join("\n"),
  });

  if (!result.ok) {
    // Still return generic success to the client; ops see server logs.
    console.error("[password-reset] send failed", result.reason, result.message);
  }

  return generic;
}

export async function resetPasswordWithToken(input: {
  token: unknown;
  password: unknown;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (typeof input.token !== "string" || !input.token.trim()) {
    return { ok: false, error: "Reset link is missing or invalid.", status: 400 };
  }
  const parsed = parseRequiredPasswordInput(input.password);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const tokenHash = hashPasswordResetToken(input.token.trim());
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired. Request a new one from Sign in.",
      status: 400,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { id: true, disabledAt: true },
  });
  if (!user || user.disabledAt) {
    return { ok: false, error: "This account cannot reset its password.", status: 400 };
  }

  const passwordFields = await buildUserPasswordWriteFields(parsed.value, user.id);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: passwordFields,
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null, id: { not: row.id } },
    }),
  ]);

  return { ok: true };
}
