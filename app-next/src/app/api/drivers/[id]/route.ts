import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getManagerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const { id } = await params;
    const body = await _req.json();
    const { is_active, email, name } = body;

    const normalizedEmail =
      email === undefined
        ? undefined
        : typeof email === "string"
          ? email.trim().toLowerCase() || null
          : null;
    if (email !== undefined) {
      if (normalizedEmail === null) {
        return NextResponse.json({ error: "Valid email required" }, { status: 400 });
      }
      if (normalizedEmail !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return NextResponse.json({ error: "Valid email required" }, { status: 400 });
      }
    }
    const trimmedName = typeof name === "string" ? name.trim() : undefined;
    if (name !== undefined && (!trimmedName || trimmedName.length < 2)) {
      return NextResponse.json({ error: "Valid name required" }, { status: 400 });
    }

    const data: Parameters<typeof prisma.driver.update>[0]["data"] = {
      ...(is_active !== undefined ? { isActive: is_active } : null),
      ...(normalizedEmail !== undefined ? { email: normalizedEmail } : null),
      ...(trimmedName !== undefined ? { name: trimmedName } : null),
    } as Parameters<typeof prisma.driver.update>[0]["data"];

    const driver = await prisma.driver.update({
      where: { id },
      data,
    });

    // Keep the login user record in sync when the roster email/name changes.
    if (driver.email) {
      await prisma.user.upsert({
        where: { email: driver.email },
        create: { email: driver.email, name: driver.name },
        update: { name: driver.name },
      });
    }

    return NextResponse.json({
      id: driver.id,
      name: driver.name,
      email: driver.email,
      licence_number: driver.licenceNumber,
      is_active: driver.isActive,
    });
  } catch (e) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const { id } = await params;
    await prisma.driver.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }
}
