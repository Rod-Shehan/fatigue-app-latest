import { NextResponse } from "next/server";
import { getSessionForSheetAccess, getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { outboundEmailConfigured } from "@/lib/email/outbound";
import { ensureSystemPolicyRow, getSystemPolicy } from "@/lib/system-policy";
import {
  checklistPackFromPolicy,
  normalizeChecklistPackPatch,
} from "@/lib/checklist/checklist-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — any signed-in user (EWD send button reads the fleet pack list).
 * PATCH — Enterprise owner only.
 */

export async function GET() {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSystemPolicyRow();
  const pack = checklistPackFromPolicy(await getSystemPolicy());
  return NextResponse.json({
    pack,
    outboundEmailConfigured: outboundEmailConfigured(),
  });
}

export async function PATCH(req: Request) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    await ensureSystemPolicyRow();
    const packPatch = normalizeChecklistPackPatch(body);
    if ("error" in packPatch) {
      return NextResponse.json({ error: packPatch.error }, { status: 400 });
    }
    if (Object.keys(packPatch).length === 0) {
      return NextResponse.json(
        { error: "Provide pack email and/or spare emails" },
        { status: 400 }
      );
    }
    await prisma.systemPolicy.update({
      where: { id: "default" },
      data: {
        ...packPatch,
        updatedById: owner.user.id,
      },
    });
    const pack = checklistPackFromPolicy(await getSystemPolicy());
    return NextResponse.json({
      pack,
      outboundEmailConfigured: outboundEmailConfigured(),
    });
  } catch (e) {
    console.error("[settings/checklist-delivery]", e);
    return NextResponse.json({ error: "Failed to save checklist PDF pack emails" }, { status: 500 });
  }
}
