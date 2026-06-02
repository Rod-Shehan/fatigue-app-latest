import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DayRow = {
  truck_rego?: string;
  start_kms?: number | null;
  end_kms?: number | null;
};

/**
 * GET /api/rego-kms?rego=XXX&excludeSheetId=…&beforeWeekStarting=YYYY-MM-DD
 * Returns the maximum end_kms for this rego from historical sheets only.
 * - excludeSheetId: omit the sheet being edited (avoids later days in the same week counting as "fleet").
 * - beforeWeekStarting: only sheets with weekStarting strictly before that date (omit future weeks).
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rego = searchParams.get("rego")?.trim();
  const excludeSheetId = searchParams.get("excludeSheetId")?.trim() || null;
  const beforeWeekStarting = searchParams.get("beforeWeekStarting")?.trim() || null;
  if (!rego) {
    return NextResponse.json({ error: "Missing rego" }, { status: 400 });
  }

  try {
    const sheets = await prisma.fatigueSheet.findMany({
      select: { id: true, weekStarting: true, days: true },
    });

    let maxEndKms: number | null = null;
    const regoLower = rego.toLowerCase();

    for (const sheet of sheets) {
      if (excludeSheetId && sheet.id === excludeSheetId) continue;
      if (beforeWeekStarting && sheet.weekStarting >= beforeWeekStarting) continue;
      const days = JSON.parse(sheet.days) as DayRow[];
      if (!Array.isArray(days)) continue;
      for (const day of days) {
        const dayRego = (day.truck_rego ?? "").trim();
        if (dayRego.toLowerCase() !== regoLower) continue;
        const end = day.end_kms;
        if (end != null && typeof end === "number" && !Number.isNaN(end)) {
          if (maxEndKms === null || end > maxEndKms) maxEndKms = end;
        }
      }
    }

    return NextResponse.json({ maxEndKms });
  } catch (e) {
    console.error("rego-kms", e);
    return NextResponse.json({ error: "Failed to get rego kms" }, { status: 500 });
  }
}
