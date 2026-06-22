-- Manager triage decisions on Autonomise fatigue events (pipeline C pilot).
CREATE TABLE IF NOT EXISTS "CameraAlertTriage" (
    "id" TEXT NOT NULL,
    "ingestEventId" TEXT NOT NULL,
    "vendorEventId" TEXT,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "decidedByUserId" TEXT NOT NULL,
    "decidedByEmail" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CameraAlertTriage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CameraAlertTriage_ingestEventId_key"
    ON "CameraAlertTriage"("ingestEventId");

CREATE INDEX IF NOT EXISTS "CameraAlertTriage_decidedAt_idx"
    ON "CameraAlertTriage"("decidedAt");

CREATE INDEX IF NOT EXISTS "CameraAlertTriage_decision_idx"
    ON "CameraAlertTriage"("decision");
