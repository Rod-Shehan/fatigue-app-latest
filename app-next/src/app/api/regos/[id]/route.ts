import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const { id } = await params;
    const body = await req.json();
    const { label, sort_order } = body;
    const data: { label?: string; sortOrder?: number } = {};
    if (typeof label === "string" && label.trim()) data.label = label.trim();
    if (typeof sort_order === "number") data.sortOrder = sort_order;
    const rego = await prisma.truckRego.update({
      where: { id },
      data,
    });
    return NextResponse.json({
      id: rego.id,
      label: rego.label,
      sort_order: rego.sortOrder,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to update rego" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const { id } = await params;
    await prisma.truckRego.delete({ where: { id } });
    return new NextResponse(undefined, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete rego" }, { status: 500 });
  }
}
