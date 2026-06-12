import { clearChallengeCookie, clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  await clearChallengeCookie();
  return Response.json({ ok: true });
}
