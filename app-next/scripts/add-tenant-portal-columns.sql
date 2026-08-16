-- Additive only. Do not drop Command / lifecycle tables that live in the same Neon.
-- Tenant row must already exist.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "recordsInbox" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "entitlements" JSONB;

CREATE INDEX IF NOT EXISTS "Tenant_status_idx" ON "Tenant"("status");
