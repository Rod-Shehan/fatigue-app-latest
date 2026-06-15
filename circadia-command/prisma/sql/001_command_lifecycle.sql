-- Circadia Command Center — Neon Postgres schema (Section 2).
-- Idempotent apply: psql "$DATABASE_URL" -f prisma/sql/001_command_lifecycle.sql
-- Does not alter core customer app tables (Driver, User, FatigueSheet, etc.).

-- A. THE IDENTITY CONDUIT MAP
-- Unifies the core application string-based cuids with hardware-native UUIDs
CREATE TABLE IF NOT EXISTS identity_uuid_map (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_cuid VARCHAR(30) NOT NULL,
    tenant_id_uuid UUID UNIQUE NOT NULL,
    driver_cuid VARCHAR(30) NOT NULL,
    driver_id_uuid UUID UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_uuid_map_lookup ON identity_uuid_map (tenant_cuid, driver_cuid);

-- B. EDGE AI INGRESS PIPELINE SOURCE
-- High-throughput table feeding raw telemetry logs directly from Raspberry Pi 5 / YOLO devices
CREATE TABLE IF NOT EXISTS edge_fatigue_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id_uuid UUID NOT NULL,
    driver_id_uuid UUID NOT NULL,
    vehicle_registration VARCHAR(20) NOT NULL,
    hardware_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    speed_kmh NUMERIC(5,2) NOT NULL,
    heading_degrees INT NOT NULL,
    lane_deviation_index NUMERIC(3,2) NOT NULL,
    braking_pressure_psi INT DEFAULT 0,
    ai_model_version VARCHAR(50) NOT NULL,
    fatigue_metric_type VARCHAR(50) NOT NULL,
    confidence_score NUMERIC(3,2) NOT NULL,
    video_snippet_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_edge_events_triage ON edge_fatigue_events (driver_id_uuid, hardware_timestamp DESC);

-- D. INTERNAL OPERATOR DIRECTORY (before lifecycle FK)
CREATE TABLE IF NOT EXISTS command_operators (
    operator_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    hardware_mfa_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- C. COMPLIANCE ENGINE LIFECYCLE LEDGER
CREATE TABLE IF NOT EXISTS fatigue_incident_lifecycle (
    lifecycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES edge_fatigue_events(event_id),
    tenant_id_uuid UUID NOT NULL,
    driver_id_uuid UUID NOT NULL,
    operator_id UUID REFERENCES command_operators(operator_id),
    event_status VARCHAR(50) NOT NULL,
    operator_notes TEXT,
    telemetry_snapshot_json JSONB NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    triaged_at TIMESTAMP WITH TIME ZONE,
    intervention_triggered_at TIMESTAMP WITH TIME ZONE,
    driver_responded_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_perf ON fatigue_incident_lifecycle (event_status, detected_at DESC);

-- F. TENANT COMPLIANCE POLICY (Section 3 — optional manager gate)
CREATE TABLE IF NOT EXISTS tenant_compliance_policy_overrides (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id_uuid UUID UNIQUE NOT NULL,
    enforce_manager_gate BOOLEAN DEFAULT FALSE,
    allow_manager_override_dismissal BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- State constraints (Section 3 state machine)
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

-- E. BYPASS ROW-LEVEL SECURITY FOR OPERATORS
ALTER TABLE fatigue_incident_lifecycle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS command_operator_global_access ON fatigue_incident_lifecycle;
CREATE POLICY command_operator_global_access ON fatigue_incident_lifecycle
    FOR ALL USING (current_setting('request.jwt.claim.role', true) = 'command_operator');
