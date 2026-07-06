import { getSession } from "@/lib/auth/session";
import { getVapidPublicKey } from "@/lib/push-notifications";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "ERR_TOKEN_EXPIRED" }, { status: 401 });
  }

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return Response.json({ error: "ERR_PUSH_NOT_CONFIGURED" }, { status: 503 });
  }

  return Response.json({ publicKey });
}
