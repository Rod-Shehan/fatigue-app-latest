-- Additive only. Do not prisma db push the main schema onto Neon:
-- that would drop Circadia Command tables that live in the same database.
ALTER TABLE "TruckRego" ADD COLUMN IF NOT EXISTS "vehicleType" TEXT;
ALTER TABLE "TruckRego" ADD COLUMN IF NOT EXISTS "gvmGcmTonnes" DOUBLE PRECISION;
ALTER TABLE "TruckRego" ADD COLUMN IF NOT EXISTS "axleGroups" INTEGER;
ALTER TABLE "TruckRego" ADD COLUMN IF NOT EXISTS "wahvaAccredited" BOOLEAN NOT NULL DEFAULT false;
