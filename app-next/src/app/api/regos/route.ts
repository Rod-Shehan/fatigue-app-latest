import { NextResponse } from "next/server";
import { getManagerSession, getSessionForSheetAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTruckRegoCreate, serializeTruckRego } from "@/lib/truck-rego";

export async function GET() {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const list = await prisma.truckRego.findMany({
      where: { tenantId: access.tenantId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    return NextResponse.json(list.map(serializeTruckRego));
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseTruckRegoCreate(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const maxOrder = await prisma.truckRego
      .aggregate({ where: { tenantId: manager.user.tenantId }, _max: { sortOrder: true } })
      .then((r) => r._max.sortOrder ?? -1);
    const rego = await prisma.truckRego.create({
      data: {
        label: parsed.label,
        sortOrder: parsed.sortOrder ?? maxOrder + 1,
        vehicleType: parsed.vehicleType,
        gvmTonnes: parsed.gvmTonnes,
        gcmTonnes: parsed.gcmTonnes,
        atmTonnes: parsed.atmTonnes,
        tareTonnes: parsed.tareTonnes,
        axleCount: parsed.axleCount,
        wahvaAccredited: parsed.wahvaAccredited,
        tenantId: manager.user.tenantId,
      },
    });
    return NextResponse.json(serializeTruckRego(rego));
  } catch {
    return NextResponse.json({ error: "Failed to create rego" }, { status: 500 });
  }
}
