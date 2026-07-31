import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureSystemPolicyRow, getSystemPolicy } from "@/lib/system-policy";
import {
  maintenanceContactFromPolicy,
  normalizeMaintenanceContactPatch,
} from "@/lib/maintenance-contact";
import { outboundEmailConfigured } from "@/lib/email/outbound";
import { prisma } from "@/lib/prisma";

/**
 * GET/PATCH /api/settings/maintenance-contact
 * Any signed-in user (driver / manager / owner) — EWD Settings demo + WAHVA destination.
 */

async function requireSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id?.trim() || null;
}

export async function GET() {
  const userId = await requireSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSystemPolicyRow();
  const policy = await getSystemPolicy();
  return NextResponse.json({
    contact: maintenanceContactFromPolicy(policy),
    outboundEmailConfigured: outboundEmailConfigured(),
  });
}

export async function PATCH(req: Request) {
  const userId = await requireSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    await ensureSystemPolicyRow();
    const contactPatch = normalizeMaintenanceContactPatch(body);
    if ("error" in contactPatch) {
      return NextResponse.json({ error: contactPatch.error }, { status: 400 });
    }
    if (Object.keys(contactPatch).length === 0) {
      return NextResponse.json(
        {
          error:
            "Provide maintenanceContactName, maintenanceContactCompany, maintenanceContactEmail, and/or maintenanceContactPhone",
        },
        { status: 400 }
      );
    }
    await prisma.systemPolicy.update({
      where: { id: "default" },
      data: {
        ...contactPatch,
        updatedById: userId,
      },
    });
    const policy = await getSystemPolicy();
    return NextResponse.json({
      contact: maintenanceContactFromPolicy(policy),
      outboundEmailConfigured: outboundEmailConfigured(),
    });
  } catch (e) {
    console.error("Settings maintenance-contact PATCH error:", e);
    return NextResponse.json({ error: "Failed to update maintenance contact" }, { status: 500 });
  }
}
