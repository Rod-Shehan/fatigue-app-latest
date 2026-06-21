-- Autonomise webhook capture table (MTS pilot).
-- Apply in Neon SQL editor if npm run db:push is not run locally.
-- Idempotent for re-run.

CREATE TABLE IF NOT EXISTS "AutonomiseWebhookIngest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "vendorAlarmId" TEXT,
    "vendorEventId" TEXT,
    "vehicleRego" TEXT,
    "driverName" TEXT,
    "linkedEventId" TEXT,
    "mediaUrl" TEXT,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "rejectReason" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutonomiseWebhookIngest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutonomiseWebhookIngest_kind_idempotencyKey_key"
    ON "AutonomiseWebhookIngest"("kind", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "AutonomiseWebhookIngest_receivedAt_idx"
    ON "AutonomiseWebhookIngest"("receivedAt");

CREATE INDEX IF NOT EXISTS "AutonomiseWebhookIngest_kind_accepted_idx"
    ON "AutonomiseWebhookIngest"("kind", "accepted");

CREATE INDEX IF NOT EXISTS "AutonomiseWebhookIngest_vehicleRego_receivedAt_idx"
    ON "AutonomiseWebhookIngest"("vehicleRego", "receivedAt");
