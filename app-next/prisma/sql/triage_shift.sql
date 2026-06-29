-- Triage shift windows — who may claim/confirm on manager + Command UIs (§3.5).
CREATE TABLE IF NOT EXISTS "TriageShift" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "assignees" JSONB NOT NULL,
    "handoffNote" TEXT,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TriageShift_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TriageShift_ends_after_starts" CHECK ("endsAt" > "startsAt")
);

CREATE INDEX IF NOT EXISTS "TriageShift_startsAt_endsAt_idx"
    ON "TriageShift" ("startsAt", "endsAt");
