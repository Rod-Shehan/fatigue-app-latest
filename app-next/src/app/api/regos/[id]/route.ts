import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTruckRegoPatch, serializeTruckRego } from "@/lib/truck-rego";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseTruckRegoPatch(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const existing = await prisma.truckRego.findFirst({
      where: { id, tenantId: manager.user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const rego = await prisma.truckRego.update({
      where: { id },
      data: parsed,
    });
    return NextResponse.json(serializeTruckRego(rego));
  } catch {
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
    const existing = await prisma.truckRego.findFirst({
      where: { id, tenantId: manager.user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.truckRego.delete({ where: { id } });
    return new NextResponse(undefined, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Failed to delete rego" }, { status: 500 });
  }
}
