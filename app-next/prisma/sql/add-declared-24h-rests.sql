-- Add declared solo 24h non-work rest dates (Reg 184E(2)(b) cold-start / attestation).
-- Apply with prisma db push or run against Neon when approved.

ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest1" TEXT;
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest2" TEXT;
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest3" TEXT;
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest4" TEXT;
