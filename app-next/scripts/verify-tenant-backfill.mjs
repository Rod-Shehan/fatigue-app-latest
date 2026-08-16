import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const [tenants, users, drivers, sheets, usersOnDefault, tenantRows] = await Promise.all([
  prisma.tenant.count(),
  prisma.user.count(),
  prisma.driver.count(),
  prisma.fatigueSheet.count(),
  prisma.user.count({ where: { tenantId: "tenant_default" } }),
  prisma.tenant.findMany({ select: { id: true, slug: true, legalName: true } }),
]);
console.log(
  JSON.stringify({ tenants, users, drivers, sheets, usersOnDefault, tenantRows }, null, 2)
);
await prisma.$disconnect();
