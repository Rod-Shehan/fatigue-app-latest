-- Additive only. Do not prisma db push the main schema onto Neon:
-- that would drop Circadia Command tables that live in the same database.
ALTER TABLE "TruckRego" ADD COLUMN IF NOT EXISTS "gvmTonnes" DOUBLE PRECISION;
ALTER TABLE "TruckRego" ADD COLUMN IF NOT EXISTS "gcmTonnes" DOUBLE PRECISION;
ALTER TABLE "TruckRego" ADD COLUMN IF NOT EXISTS "atmTonnes" DOUBLE PRECISION;
ALTER TABLE "TruckRego" ADD COLUMN IF NOT EXISTS "tareTonnes" DOUBLE PRECISION;
ALTER TABLE "TruckRego" ADD COLUMN IF NOT EXISTS "axleCount" INTEGER;

-- Best-effort copy of the old combined mass into GVM (GCM still needs a real value).
UPDATE "TruckRego"
SET "gvmTonnes" = "gvmGcmTonnes"
WHERE "gvmTonnes" IS NULL AND "gvmGcmTonnes" IS NOT NULL;

UPDATE "TruckRego"
SET "axleCount" = "axleGroups"
WHERE "axleCount" IS NULL AND "axleGroups" IS NOT NULL;
