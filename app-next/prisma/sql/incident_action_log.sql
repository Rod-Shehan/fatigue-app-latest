-- Append-only operational actions after verified fatigue (§3.5.4).
CREATE TABLE IF NOT EXISTS "IncidentActionLog" (
    "id" TEXT NOT NULL,
    "lifecycleId" UUID,
    "ingestEventId" TEXT,
    "actionType" TEXT NOT NULL,
    "resolutionNotes" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentActionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IncidentActionLog_lifecycleId_idx"
    ON "IncidentActionLog" ("lifecycleId");

CREATE INDEX IF NOT EXISTS "IncidentActionLog_ingestEventId_idx"
    ON "IncidentActionLog" ("ingestEventId");
