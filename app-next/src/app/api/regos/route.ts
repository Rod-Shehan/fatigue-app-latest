import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getManagerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const list = await prisma.truckRego.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    return NextResponse.json(
      list.map((r) => ({ id: r.id, label: r.label, sort_order: r.sortOrder }))
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const body = await req.json();
    const { label, sort_order } = body;
    if (!label || typeof label !== "string" || !label.trim()) {
      return NextResponse.json({ error: "label required" }, { status: 400 });
    }
    const maxOrder = await prisma.truckRego
      .aggregate({ _max: { sortOrder: true } })
      .then((r) => r._max.sortOrder ?? -1);
    const rego = await prisma.truckRego.create({
      data: {
        label: label.trim(),
        sortOrder: typeof sort_order === "number" ? sort_order : maxOrder + 1,
      },
    });
    return NextResponse.json({
      id: rego.id,
      label: rego.label,
      sort_order: rego.sortOrder,
    });
  } catch {
    return NextResponse.json({ error: "Failed to create rego" }, { status: 500 });
  }
}
