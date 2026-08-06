import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { token, password } — set a new password from an emailed reset link. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      token?: unknown;
      password?: unknown;
    };
    const result = await resetPasswordWithToken({
      token: body.token,
      password: body.password,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth/reset-password]", e);
    return NextResponse.json({ error: "Could not reset password" }, { status: 500 });
  }
}
