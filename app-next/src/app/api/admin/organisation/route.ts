import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTenantLegalName } from "@/lib/tenant";

export async function GET() {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.user.tenantId },
    select: { legalName: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }
  return NextResponse.json({ legal_name: tenant.legalName });
}

export async function PATCH(req: Request) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  try {
    const body = (await req.json()) as { legal_name?: unknown };
    const legalName = parseTenantLegalName(body.legal_name);
    if (!legalName) {
      return NextResponse.json({ error: "Operator name must be 2–160 characters." }, { status: 400 });
    }
    const tenant = await prisma.tenant.update({
      where: { id: owner.user.tenantId },
      data: { legalName },
      select: { legalName: true },
    });
    return NextResponse.json({ legal_name: tenant.legalName });
  } catch {
    return NextResponse.json({ error: "Failed to update organisation" }, { status: 500 });
  }
}
