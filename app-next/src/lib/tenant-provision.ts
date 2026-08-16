import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_LEGAL_NAME,
  DEFAULT_TENANT_SLUG,
  EMAIL_OTHER_TENANT_ERROR,
  normalizeTenantSlug,
  parseTenantLegalName,
} from "@/lib/tenant";

export async function ensureDefaultTenant(
  prisma: PrismaClient,
  legalName = process.env.CIRCADIA_DEFAULT_TENANT_LEGAL_NAME?.trim() || DEFAULT_TENANT_LEGAL_NAME
) {
  return prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    create: {
      id: DEFAULT_TENANT_ID,
      legalName,
      slug: DEFAULT_TENANT_SLUG,
    },
    update: {},
  });
}

export async function provisionTenant(
  prisma: PrismaClient,
  args: {
    legalName: string;
    slug?: string;
    ownerEmail: string;
    ownerName?: string;
    ownerPassword?: string;
    platformAdmin?: boolean;
  }
) {
  const legalName = parseTenantLegalName(args.legalName);
  if (!legalName) {
    throw new Error("Legal name must be 2–160 characters.");
  }
  const slug = normalizeTenantSlug(args.slug || legalName);
  if (slug.length < 2) {
    throw new Error("Slug must contain at least two letters or numbers.");
  }
  const ownerEmail = args.ownerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new Error("Valid owner email required.");
  }

  const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
  if (existingSlug) {
    throw new Error(`Slug "${slug}" is already in use.`);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { tenantId: true },
  });
  if (existingUser) {
    throw new Error(EMAIL_OTHER_TENANT_ERROR);
  }

  const passwordHash = args.ownerPassword
    ? await bcrypt.hash(args.ownerPassword, 10)
    : undefined;

  const tenant = await prisma.tenant.create({
    data: { legalName, slug },
  });

  const owner = await prisma.user.create({
    data: {
      email: ownerEmail,
      name: args.ownerName?.trim() || legalName,
      role: "owner",
      tenantId: tenant.id,
      platformAdmin: Boolean(args.platformAdmin),
      ...(passwordHash
        ? { passwordHash, passwordSetAt: new Date() }
        : {}),
    },
    select: { id: true, email: true, name: true, role: true, tenantId: true },
  });

  return { tenant, owner };
}
