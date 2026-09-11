import { NextResponse } from "next/server";
import { getPlatformAdminSession } from "@/lib/auth";
import { dropSignedWeekTripSheets, parseWeekStarting } from "@/lib/pdf-drop/drop-week";
import { dropStatusForClient, inviteClientToDrop } from "@/lib/pdf-drop";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

async function loadClient(id: string) {
  return prisma.tenant.findUnique({
    where: { id },
    select: { id: true, slug: true, legalName: true, recordsInbox: true },
  });
}

function asDropClient(t: { id: string; slug: string; legalName: string; recordsInbox: string | null }) {
  return {
    tenantId: t.id,
    slug: t.slug,
    legalName: t.legalName,
    shareEmail: t.recordsInbox,
  };
}

export async function GET(_req: Request, context: RouteContext) {
  const staff = await getPlatformAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }
  const { id } = await context.params;
  const tenant = await loadClient(id);
  if (!tenant) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json({ drop: dropStatusForClient(asDropClient(tenant)) });
}

export async function POST(req: Request, context: RouteContext) {
  const staff = await getPlatformAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }
  const { id } = await context.params;
  const tenant = await loadClient(id);
  if (!tenant) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const client = asDropClient(tenant);

  try {
    const body = (await req.json()) as { action?: unknown; week_starting?: unknown };
    if (body.action === "invite") {
      const result = await inviteClientToDrop(client);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "drop_week") {
      const weekStarting = parseWeekStarting(body.week_starting);
      if (!weekStarting) {
        return NextResponse.json({ error: "week_starting must be YYYY-MM-DD." }, { status: 400 });
      }
      const result = await dropSignedWeekTripSheets(prisma, client, weekStarting);
      return NextResponse.json({ ok: true, week_starting: weekStarting, ...result });
    }
    return NextResponse.json({ error: "action must be invite or drop_week." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF drop failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
