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
    const { is_active } = body;
    const driver = await prisma.driver.update({
      where: { id },
      data: { isActive: is_active },
    });
    return NextResponse.json({
      id: driver.id,
      name: driver.name,
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
