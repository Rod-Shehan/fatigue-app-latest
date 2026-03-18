import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
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
    select: { id: true, createdById: true, status: true },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isManager && thread.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if ((thread.status ?? "").toLowerCase() === "closed") {
    return NextResponse.json({ error: "Thread is closed" }, { status: 400 });
  }

  const json = (await req.json().catch(() => null)) as { body?: unknown } | null;
  const body = typeof json?.body === "string" ? json.body.trim() : "";
  if (body.length < 1) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  const message = await prisma.message.create({
    data: { threadId: id, senderId: userId, body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      sender: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // Bump thread updatedAt (not strictly necessary, but makes sorting stable).
  await prisma.messageThread.update({ where: { id }, data: { updatedAt: new Date() } });

  return NextResponse.json(
    {
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        sender: message.sender,
      },
    },
    { status: 201 }
  );
}

