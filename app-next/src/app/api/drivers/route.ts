import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getManagerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const drivers = await prisma.driver.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(
      drivers.map((d) => ({
        id: d.id,
        name: d.name,
        licence_number: d.licenceNumber,
        is_active: d.isActive,
      }))
    );
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const body = await req.json();
    const { name, licence_number, is_active } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const driver = await prisma.driver.create({
      data: {
        name: name.trim(),
        licenceNumber: licence_number?.trim() ?? null,
        isActive: is_active ?? true,
      },
    });
    return NextResponse.json({
      id: driver.id,
      name: driver.name,
      licence_number: driver.licenceNumber,
      is_active: driver.isActive,
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
