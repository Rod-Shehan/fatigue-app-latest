import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toSummary(t: {
  id: string;
  subject: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string | null; email: string | null };
  sheet: { id: string; weekStarting: string; driverName: string } | null;
  messages: { body: string; createdAt: Date; sender: { name: string | null } }[];
}) {
  const last = t.messages[0];
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    createdBy: t.createdBy,
    sheet: t.sheet
      ? { id: t.sheet.id, week_starting: t.sheet.weekStarting, driver_name: t.sheet.driverName }
      : null,
    lastMessage: last
      ? {
          body: last.body,
          createdAt: last.createdAt.toISOString(),
          senderName: last.sender?.name ?? null,
        }
      : null,
  };
}

/**
 * GET /api/messages/threads
 * Driver: only own threads. Manager: all threads.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? (session.user as { id: string }).id : undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const manager = await getManagerSession();
  const isManager = !!manager;

  const threads = await prisma.messageThread.findMany({
    where: isManager ? {} : { createdById: userId },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      sheet: { select: { id: true, weekStarting: true, driverName: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, sender: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({ threads: threads.map(toSummary) });
}

/**
 * POST /api/messages/threads
 * Driver-only: create a thread + first message.
 * Body: { subject, body, sheetId? }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? (session.user as { id: string }).id : undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const manager = await getManagerSession();
  if (manager) return NextResponse.json({ error: "Managers cannot create threads" }, { status: 403 });

  const json = (await req.json().catch(() => null)) as
    | { subject?: unknown; body?: unknown; sheetId?: unknown }
    | null;
  const subject = typeof json?.subject === "string" ? json.subject.trim() : "";
  const body = typeof json?.body === "string" ? json.body.trim() : "";
  const sheetId = typeof json?.sheetId === "string" ? json.sheetId.trim() : null;

  if (subject.length < 3) return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  if (body.length < 1) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  if (sheetId) {
    const sheet = await prisma.fatigueSheet.findUnique({
      where: { id: sheetId },
      select: { id: true, createdById: true },
    });
    if (!sheet) return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    if (sheet.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const thread = await prisma.messageThread.create({
    data: {
      subject,
      status: "open",
      createdById: userId,
      ...(sheetId ? { sheetId } : {}),
      messages: { create: { senderId: userId, body } },
    },
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      sheet: { select: { id: true, weekStarting: true, driverName: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, sender: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({ thread: toSummary(thread) }, { status: 201 });
}

