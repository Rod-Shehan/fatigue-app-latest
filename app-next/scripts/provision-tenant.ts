/**
 * Create a named EWD client (tenant) + first owner.
 *
 * Usage (from app-next):
 *   npx tsx scripts/provision-tenant.ts --legal-name "Acme Haulage Pty Ltd" --slug acme --owner-email owner@acme.com --owner-name "Acme Owner" --password "set-once"
 *
 * Existing rows stay on tenant_default until you rename that tenant's legal name.
 */
import { PrismaClient } from "@prisma/client";
import { ensureDefaultTenant, provisionTenant } from "../src/lib/tenant-provision";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const legalName = arg("--legal-name");
  const ownerEmail = arg("--owner-email");
  if (!legalName || !ownerEmail) {
    console.error(
      'Required: --legal-name "Company Pty Ltd" --owner-email owner@company.com [--slug acme] [--owner-name Name] [--password secret] [--default-name "First client legal name"]'
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await ensureDefaultTenant(prisma, arg("--default-name"));
    const result = await provisionTenant(prisma, {
      legalName,
      slug: arg("--slug"),
      ownerEmail,
      ownerName: arg("--owner-name"),
      ownerPassword: arg("--password"),
    });
    console.log("Tenant created:");
    console.log("  id:        ", result.tenant.id);
    console.log("  legalName:", result.tenant.legalName);
    console.log("  slug:      ", result.tenant.slug);
    console.log("Owner:");
    console.log("  id:        ", result.owner.id);
    console.log("  email:     ", result.owner.email);
    console.log("Sign in as that owner to add managers and drivers. They will not see other clients.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
