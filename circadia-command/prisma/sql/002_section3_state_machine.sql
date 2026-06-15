-- Section 3 upgrade — apply if 001 was run before manager-gate statuses existed.
-- Idempotent: psql "$DATABASE_URL" -f prisma/sql/002_section3_state_machine.sql

CREATE TABLE IF NOT EXISTS tenant_compliance_policy_overrides (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id_uuid UUID UNIQUE NOT NULL,
    enforce_manager_gate BOOLEAN DEFAULT FALSE,
    allow_manager_override_dismissal BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE fatigue_incident_lifecycle DROP CONSTRAINT IF EXISTS chk_lifecycle_event_status;
ALTER TABLE fatigue_incident_lifecycle DROP CONSTRAINT IF EXISTS chk_event_status;
ALTER TABLE fatigue_incident_lifecycle ADD CONSTRAINT chk_lifecycle_event_status CHECK (
    event_status IN (
        'PENDING_TRIAGE',
        'VERIFIED_FALSE_POSITIVE',
        'VERIFIED_TRUE_FATIGUE',
        'MANAGER_VALIDATION_PENDING',
        'INTERVENTION_SENT',
        'DRIVER_ACKNOWLEDGED',
        'DRIVER_DISPUTED',
        'CLOSED'
    )
);
