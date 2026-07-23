-- Absolute start/end for declared solo 24h non-work rests (Reg 184E(2)(b)).
-- Apply with targeted ALTER only (never full prisma db push on shared Neon).

ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest1Start" TIMESTAMP(3);
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest1End" TIMESTAMP(3);
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest2Start" TIMESTAMP(3);
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest2End" TIMESTAMP(3);
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest3Start" TIMESTAMP(3);
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest3End" TIMESTAMP(3);
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest4Start" TIMESTAMP(3);
ALTER TABLE "FatigueSheet" ADD COLUMN IF NOT EXISTS "last24hRest4End" TIMESTAMP(3);
