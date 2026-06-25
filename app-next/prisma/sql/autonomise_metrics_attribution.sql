-- Autonomise metrics attribution (bridge to DriverRiskBlock).
-- Apply in Neon SQL editor if npm run db:push is not run locally.

CREATE TABLE IF NOT EXISTS "AutonomiseMetricsAttribution" (
    "ingestEventId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "blockStartMs" BIGINT NOT NULL,
    "attributedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutonomiseMetricsAttribution_pkey" PRIMARY KEY ("ingestEventId")
);

CREATE INDEX IF NOT EXISTS "AutonomiseMetricsAttribution_driverName_blockStartMs_idx"
    ON "AutonomiseMetricsAttribution"("driverName", "blockStartMs");

CREATE INDEX IF NOT EXISTS "AutonomiseMetricsAttribution_source_idx"
    ON "AutonomiseMetricsAttribution"("source");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AutonomiseMetricsAttribution_ingestEventId_fkey'
    ) THEN
        ALTER TABLE "AutonomiseMetricsAttribution"
            ADD CONSTRAINT "AutonomiseMetricsAttribution_ingestEventId_fkey"
            FOREIGN KEY ("ingestEventId") REFERENCES "AutonomiseWebhookIngest"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
