import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from")?.trim() ?? "";
  const to = searchParams.get("to")?.trim() ?? "";
  const takeRaw = Number(searchParams.get("limit") ?? "5000");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 10000) : 5000;

  const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
  if (from && ISO_DAY.test(from)) {
    where.createdAt = { ...where.createdAt, gte: new Date(`${from}T00:00:00.000Z`) };
  }
  if (to && ISO_DAY.test(to)) {
    where.createdAt = { ...where.createdAt, lte: new Date(`${to}T23:59:59.999Z`) };
  }

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      sheetId: true,
      action: true,
      payload: true,
      createdAt: true,
      actor: { select: { id: true, email: true, name: true, role: true } },
      sheet: { select: { driverName: true, weekStarting: true } },
    },
  });

  return NextResponse.json(
    {
      exported_at: new Date().toISOString(),
      count: events.length,
      events: events.map((e) => ({
        id: e.id,
        sheet_id: e.sheetId,
        driver_name: e.sheet.driverName,
        week_starting: e.sheet.weekStarting,
        action: e.action,
        payload: e.payload,
        created_at: e.createdAt.toISOString(),
        actor: e.actor
          ? { id: e.actor.id, email: e.actor.email, name: e.actor.name, role: e.actor.role }
          : null,
      })),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="audit-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    }
  );
}
