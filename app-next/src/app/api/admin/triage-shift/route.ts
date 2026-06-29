import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createTriageShift,
  listActiveCommandOperators,
  listUpcomingTriageShifts,
  normalizeAssigneesInput,
  parseAssignees,
  perthLocalInputToUtc,
  type TriageShiftAssignees,
} from "@/lib/triage-shift";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBody(body: unknown): {
  startsAt: Date;
  endsAt: Date;
  assignees: TriageShiftAssignees;
  handoffNote: string | null;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.startsAtLocal !== "string" || typeof b.endsAtLocal !== "string") return null;
  try {
    return {
      startsAt: perthLocalInputToUtc(b.startsAtLocal),
      endsAt: perthLocalInputToUtc(b.endsAtLocal),
      assignees: normalizeAssigneesInput(parseAssignees(b.assignees)),
      handoffNote: typeof b.handoffNote === "string" ? b.handoffNote : null,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

  const [shifts, commandOperators, managerUsers] = await Promise.all([
    listUpcomingTriageShifts(prisma),
    listActiveCommandOperators(prisma),
    prisma.user.findMany({
      where: { role: { in: ["manager", "owner"] }, disabledAt: null },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    shifts,
    managerUsers,
    commandOperators,
  });
}

export async function POST(req: Request) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

  try {
    const parsed = parseBody(await req.json());
    if (!parsed) {
      return NextResponse.json({ error: "Invalid shift payload" }, { status: 400 });
    }

    const shift = await createTriageShift(prisma, {
      ...parsed,
      updatedByUserId: owner.user.id,
    });
    return NextResponse.json({ shift });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create shift";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
