import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse, CommandApiError } from "@/lib/errors";

type SubscribeBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      throw new CommandApiError("ERR_TOKEN_EXPIRED", "Session expired.", 401);
    }

    const body = (await request.json()) as SubscribeBody;
    const endpoint = body.endpoint?.trim();
    const p256dh = body.keys?.p256dh?.trim();
    const auth = body.keys?.auth?.trim();
    if (!endpoint || !p256dh || !auth) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Invalid push subscription.", 400);
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;

    await prisma.operatorPushSubscription.upsert({
      where: { endpoint },
      create: {
        operatorId: session.sub,
        endpoint,
        p256dh,
        auth,
        userAgent,
      },
      update: {
        operatorId: session.sub,
        p256dh,
        auth,
        userAgent,
      },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      throw new CommandApiError("ERR_TOKEN_EXPIRED", "Session expired.", 401);
    }

    const body = (await request.json()) as { endpoint?: string };
    const endpoint = body.endpoint?.trim();
    if (!endpoint) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "endpoint is required.", 400);
    }

    await prisma.operatorPushSubscription.deleteMany({
      where: { endpoint, operatorId: session.sub },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
