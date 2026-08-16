CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX IF NOT EXISTS "Tenant_legalName_idx" ON "Tenant"("legalName");
INSERT INTO "Tenant" ("id", "legalName", "slug", "createdAt", "updatedAt")
VALUES ('tenant_default', 'Default operator', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
