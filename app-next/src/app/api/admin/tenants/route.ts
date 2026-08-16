import { NextResponse } from "next/server";
import { getPlatformAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseClientEntitlements } from "@/lib/tenant";
import { ensureDefaultTenant, provisionTenant } from "@/lib/tenant-provision";

export async function GET() {
  const staff = await getPlatformAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }
  await ensureDefaultTenant(prisma);
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      legalName: true,
      slug: true,
      status: true,
      createdAt: true,
      _count: { select: { users: true, drivers: true, fatigueSheets: true } },
    },
  });
  return NextResponse.json({
    tenants: tenants.map((t) => ({
      id: t.id,
      legal_name: t.legalName,
      slug: t.slug,
      status: t.status,
      created_at: t.createdAt.toISOString(),
      users: t._count.users,
      drivers: t._count.drivers,
      sheets: t._count.fatigueSheets,
    })),
  });
}

export async function POST(req: Request) {
  const staff = await getPlatformAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }
  try {
    const body = (await req.json()) as {
      legal_name?: unknown;
      slug?: unknown;
      owner_email?: unknown;
      owner_name?: unknown;
      owner_password?: unknown;
    };
    const result = await provisionTenant(prisma, {
      legalName: typeof body.legal_name === "string" ? body.legal_name : "",
      slug: typeof body.slug === "string" ? body.slug : undefined,
      ownerEmail: typeof body.owner_email === "string" ? body.owner_email : "",
      ownerName: typeof body.owner_name === "string" ? body.owner_name : undefined,
      ownerPassword: typeof body.owner_password === "string" ? body.owner_password : undefined,
    });
    return NextResponse.json({
      tenant: {
        id: result.tenant.id,
        legal_name: result.tenant.legalName,
        slug: result.tenant.slug,
        status: result.tenant.status,
        entitlements: parseClientEntitlements(result.tenant.entitlements),
      },
      owner: {
        id: result.owner.id,
        email: result.owner.email,
        name: result.owner.name,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create tenant";
    const status = /already|required|Legal name|Slug|email/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
