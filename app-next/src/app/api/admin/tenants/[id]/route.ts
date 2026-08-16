import { NextResponse } from "next/server";
import { getPlatformAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  normalizeTenantSlug,
  parseClientEntitlements,
  parseRecordsInbox,
  parseTenantLegalName,
  parseTenantStatus,
} from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

function tenantPayload(t: {
  id: string;
  legalName: string;
  slug: string;
  status: string;
  recordsInbox: string | null;
  entitlements: unknown;
  createdAt: Date;
  updatedAt: Date;
  _count: { users: number; drivers: number; fatigueSheets: number };
}) {
  return {
    id: t.id,
    legal_name: t.legalName,
    slug: t.slug,
    status: t.status,
    records_inbox: t.recordsInbox,
    entitlements: parseClientEntitlements(t.entitlements),
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
    users: t._count.users,
    drivers: t._count.drivers,
    sheets: t._count.fatigueSheets,
  };
}

const tenantSelect = {
  id: true,
  legalName: true,
  slug: true,
  status: true,
  recordsInbox: true,
  entitlements: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, drivers: true, fatigueSheets: true } },
} as const;

export async function GET(_req: Request, context: RouteContext) {
  const staff = await getPlatformAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }
  const { id } = await context.params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: tenantSelect });
  if (!tenant) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  return NextResponse.json({ tenant: tenantPayload(tenant) });
}

export async function PATCH(req: Request, context: RouteContext) {
  const staff = await getPlatformAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }
  const { id } = await context.params;
  const existing = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, slug: true, entitlements: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    const body = (await req.json()) as {
      legal_name?: unknown;
      slug?: unknown;
      status?: unknown;
      records_inbox?: unknown;
      entitlements?: unknown;
    };

    const data: {
      legalName?: string;
      slug?: string;
      status?: string;
      recordsInbox?: string | null;
      entitlements?: ReturnType<typeof parseClientEntitlements>;
    } = {};

    if (body.legal_name !== undefined) {
      const legalName = parseTenantLegalName(body.legal_name);
      if (!legalName) {
        return NextResponse.json({ error: "Legal name must be 2–160 characters." }, { status: 400 });
      }
      data.legalName = legalName;
    }

    if (body.slug !== undefined) {
      if (typeof body.slug !== "string") {
        return NextResponse.json({ error: "Slug must be a string." }, { status: 400 });
      }
      const slug = normalizeTenantSlug(body.slug);
      if (slug.length < 2) {
        return NextResponse.json({ error: "Slug must contain at least two letters or numbers." }, { status: 400 });
      }
      if (slug !== existing.slug) {
        const clash = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
        if (clash) {
          return NextResponse.json({ error: `Slug "${slug}" is already in use.` }, { status: 400 });
        }
      }
      data.slug = slug;
    }

    if (body.status !== undefined) {
      const status = parseTenantStatus(body.status);
      if (!status) {
        return NextResponse.json({ error: "Status must be active or paused." }, { status: 400 });
      }
      data.status = status;
    }

    if (body.records_inbox !== undefined) {
      if (body.records_inbox === null || (typeof body.records_inbox === "string" && !body.records_inbox.trim())) {
        data.recordsInbox = null;
      } else {
        const inbox = parseRecordsInbox(body.records_inbox);
        if (!inbox) {
          return NextResponse.json({ error: "Valid records inbox email required." }, { status: 400 });
        }
        data.recordsInbox = inbox;
      }
    }

    if (body.entitlements !== undefined) {
      const incoming =
        body.entitlements && typeof body.entitlements === "object" && !Array.isArray(body.entitlements)
          ? (body.entitlements as Record<string, unknown>)
          : null;
      if (!incoming) {
        return NextResponse.json({ error: "Entitlements must be an object." }, { status: 400 });
      }
      data.entitlements = parseClientEntitlements({
        ...parseClientEntitlements(existing.entitlements),
        ...incoming,
      });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes submitted." }, { status: 400 });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data,
      select: tenantSelect,
    });
    return NextResponse.json({ tenant: tenantPayload(tenant) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update client";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
