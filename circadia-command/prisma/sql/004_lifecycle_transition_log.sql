-- Category B — append-only lifecycle audit ledger.
-- Idempotent: psql "$DATABASE_URL" -f prisma/sql/004_lifecycle_transition_log.sql

CREATE TABLE IF NOT EXISTS lifecycle_transition_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lifecycle_id UUID NOT NULL REFERENCES fatigue_incident_lifecycle(lifecycle_id),
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    triggered_by_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(50) NOT NULL,
    transition_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    transition_payload_snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transition_audit_trail
    ON lifecycle_transition_log (lifecycle_id, transition_timestamp ASC);

CREATE OR REPLACE FUNCTION freeze_transition_audit_records()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ERR_AUDIT_LOG_IMMUTABLE: Modification of compliance history is strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_transition_history ON lifecycle_transition_log;
CREATE TRIGGER trg_protect_transition_history
    BEFORE UPDATE OR DELETE ON lifecycle_transition_log
    FOR EACH ROW EXECUTE FUNCTION freeze_transition_audit_records();
