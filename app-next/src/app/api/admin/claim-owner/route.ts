import { NextResponse } from "next/server";
import { getOwnerBootstrapSession } from "@/lib/auth";
import { ensureSystemPolicyRow } from "@/lib/system-policy";
import { prisma } from "@/lib/prisma";

/** Promote OWNER_SEED_EMAIL user to owner when no owner exists yet. */
export async function POST() {
  const bootstrap = await getOwnerBootstrapSession();
  if (!bootstrap) {
    return NextResponse.json({ error: "Owner claim not permitted" }, { status: 403 });
  }
  if (bootstrap.user.role === "owner") {
    return NextResponse.json({ ok: true, alreadyOwner: true });
  }
  try {
    await prisma.user.update({
      where: { id: bootstrap.user.id },
      data: { role: "owner" },
    });
    await ensureSystemPolicyRow();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to claim owner role" }, { status: 500 });
  }
}
