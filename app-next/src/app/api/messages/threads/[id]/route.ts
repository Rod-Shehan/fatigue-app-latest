import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? (session.user as { id: string }).id : undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const manager = await getManagerSession();
  const isManager = !!manager;

  const thread = await prisma.messageThread.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      createdBy: { select: { id: true, name: true, email: true } },
      sheet: { select: { id: true, weekStarting: true, driverName: true } },
    },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isManager && thread.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const messages = await prisma.message.findMany({
    where: { threadId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      body: true,
      createdAt: true,
      sender: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json({
    thread: {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      createdBy: thread.createdBy,
      sheet: thread.sheet
        ? { id: thread.sheet.id, week_starting: thread.sheet.weekStarting, driver_name: thread.sheet.driverName }
        : null,
      lastMessage: null,
    },
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender,
    })),
  });
}

