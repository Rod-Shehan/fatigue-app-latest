-- Optional GPS movement trail addon (SystemPolicy).
-- Apply on Neon when enabling this feature in an environment.
-- Do not run against production unless explicitly approved.

ALTER TABLE "SystemPolicy"
  ADD COLUMN IF NOT EXISTS "gpsMovementTrailEnabled" BOOLEAN NOT NULL DEFAULT false;
