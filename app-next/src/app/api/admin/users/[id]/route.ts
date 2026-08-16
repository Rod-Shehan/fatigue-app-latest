import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  const { id } = await params;
  if (id === owner.user.id) {
    return NextResponse.json({ error: "Cannot modify your own account here" }, { status: 400 });
  }
  try {
    const body = (await req.json()) as { disabled?: unknown; role?: unknown };
    const data: { disabledAt?: Date | null; role?: string | null } = {};

    if (typeof body.disabled === "boolean") {
      data.disabledAt = body.disabled ? new Date() : null;
    }
    if (body.role === "driver") {
      data.role = null;
    } else if (body.role === "manager") {
      data.role = "manager";
    } else if (body.role === "owner") {
      return NextResponse.json({ error: "Cannot promote to owner via this endpoint" }, { status: 400 });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true, tenantId: true } });
    if (!target || target.tenantId !== owner.user.tenantId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json({ error: "Cannot modify another owner account" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, disabledAt: true },
    });
    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role ?? "driver",
        disabled: !!updated.disabledAt,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

  const { id } = await params;
  if (id === owner.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, email: true, tenantId: true },
    });
    if (!target || target.tenantId !== owner.user.tenantId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (target.role === "owner") {
      const ownerCount = await prisma.user.count({ where: { role: "owner", tenantId: owner.user.tenantId } });
      if (ownerCount <= 1) {
        return NextResponse.json({ error: "Cannot delete the last organisation owner" }, { status: 400 });
      }
    }

    await prisma.user.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
