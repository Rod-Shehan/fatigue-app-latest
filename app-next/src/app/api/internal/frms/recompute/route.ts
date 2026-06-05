import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loadDriverWeekMap,
  runFrmsAndPersist,
} from "@/lib/frms/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: NextRequest): boolean {
  const secret = process.env.FRMS_INTERNAL_SECRET;
  if (!secret) return false;
  return (req.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { driverName?: string; weekStarting?: string; userId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const driverName = body.driverName?.trim();
  const weekStarting = body.weekStarting?.trim();
  if (!driverName || !weekStarting) {
    return NextResponse.json(
      { error: "driverName and weekStarting required" },
      { status: 400 }
    );
  }

  try {
    const driverSheets = await prisma.fatigueSheet.findMany({
      where: { driverName },
      select: {
        weekStarting: true,
        days: true,
        jurisdictionCode: true,
        driverType: true,
        createdById: true,
      },
    });

    if (driverSheets.length === 0) {
      return NextResponse.json({ error: "No sheets for driver" }, { status: 404 });
    }

    const weekMap = await loadDriverWeekMap(prisma, driverName);
    const focus =
      driverSheets.find((s) => s.weekStarting === weekStarting) ?? driverSheets[0];

    const result = await runFrmsAndPersist(prisma, {
      driverName,
      weekStarting,
      weekMap,
      jurisdictionCode: focus.jurisdictionCode,
      driverType: focus.driverType,
      userId: body.userId ?? focus.createdById ?? undefined,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("FRMS recompute error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recompute failed" },
      { status: 500 }
    );
  }
}
