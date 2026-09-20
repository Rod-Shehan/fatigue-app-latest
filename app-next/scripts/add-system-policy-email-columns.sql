-- Additive only. Do not prisma db push the main schema onto Neon:
-- that would drop Circadia Command tables that live in the same database.
ALTER TABLE "SystemPolicy" ADD COLUMN IF NOT EXISTS "maintenanceSpareEmail1" TEXT;
ALTER TABLE "SystemPolicy" ADD COLUMN IF NOT EXISTS "maintenanceSpareEmail2" TEXT;
ALTER TABLE "SystemPolicy" ADD COLUMN IF NOT EXISTS "checklistPackEmail" TEXT;
ALTER TABLE "SystemPolicy" ADD COLUMN IF NOT EXISTS "checklistPackSpareEmail1" TEXT;
ALTER TABLE "SystemPolicy" ADD COLUMN IF NOT EXISTS "checklistPackSpareEmail2" TEXT;
