-- Link edge events to Autonomise webhook ingest rows (manager Live alerts source).
-- Idempotent: psql "$DATABASE_URL" -f prisma/sql/010_edge_autonomise_source.sql

ALTER TABLE edge_fatigue_events
    ADD COLUMN IF NOT EXISTS source_ingest_id VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_events_source_ingest
    ON edge_fatigue_events (source_ingest_id)
    WHERE source_ingest_id IS NOT NULL;
