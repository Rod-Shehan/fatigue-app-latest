-- Additive only. Do not drop Command / lifecycle tables that live in the same Neon.
-- Tenant row must already exist (ensure-default-tenant.sql).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "platformAdmin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "TruckRego" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "RoutePreset" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';

CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX IF NOT EXISTS "Driver_tenantId_idx" ON "Driver"("tenantId");
CREATE INDEX IF NOT EXISTS "TruckRego_tenantId_idx" ON "TruckRego"("tenantId");
CREATE INDEX IF NOT EXISTS "RoutePreset_tenantId_idx" ON "RoutePreset"("tenantId");
CREATE INDEX IF NOT EXISTS "FatigueSheet_tenantId_idx" ON "FatigueSheet"("tenantId");
CREATE INDEX IF NOT EXISTS "FatigueSheet_tenantId_driverName_weekStarting_idx"
  ON "FatigueSheet"("tenantId", "driverName", "weekStarting");

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Driver" ADD CONSTRAINT "Driver_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TruckRego" ADD CONSTRAINT "TruckRego_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoutePreset" ADD CONSTRAINT "RoutePreset_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FatigueSheet" ADD CONSTRAINT "FatigueSheet_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
