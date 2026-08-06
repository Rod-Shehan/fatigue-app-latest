import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { email } — request a password reset email.
 * Response is always a generic success (no account enumeration).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown };
    const result = await requestPasswordReset(body.email);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[auth/forgot-password]", e);
    return NextResponse.json(
      {
        ok: true,
        emailConfigured: false,
        message:
          "Could not process the request right now. Try again, or ask your manager/owner to reset your password.",
      },
      { status: 200 }
    );
  }
}
