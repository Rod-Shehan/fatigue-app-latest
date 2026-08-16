-- EWD diary reset only. Keep people, names, Command, camera ingest.
-- Driver records starting point: 2026-08-16 (Australia/Perth).
-- Do not drop Command / lifecycle tables.

BEGIN;

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "recordsInbox" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "entitlements" JSONB;
CREATE INDEX IF NOT EXISTS "Tenant_status_idx" ON "Tenant"("status");

UPDATE "Tenant"
SET "entitlements" = '{
  "ewd": true,
  "enterprise": true,
  "gpsTrail": false,
  "checklists": true,
  "camera": false,
  "command": false,
  "frms": false,
  "photoRetain": false
}'::jsonb
WHERE "entitlements" IS NULL;

DELETE FROM "FrmsRiskSnapshot";
DELETE FROM "FrmsProfileRun";
DELETE FROM "DriverRiskBlock";
DELETE FROM "Message";
DELETE FROM "MessageThread";
DELETE FROM "AuditEvent";
DELETE FROM "FatigueSheet";

COMMIT;
