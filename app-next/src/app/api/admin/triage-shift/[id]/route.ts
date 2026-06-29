import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteTriageShift,
  normalizeAssigneesInput,
  parseAssignees,
  perthLocalInputToUtc,
  updateTriageShift,
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    const parsed = parseBody(await req.json());
    if (!parsed) {
      return NextResponse.json({ error: "Invalid shift payload" }, { status: 400 });
    }

    const shift = await updateTriageShift(prisma, id, {
      ...parsed,
      updatedByUserId: owner.user.id,
    });
    return NextResponse.json({ shift });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update shift";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    await deleteTriageShift(prisma, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete shift" }, { status: 400 });
  }
}
