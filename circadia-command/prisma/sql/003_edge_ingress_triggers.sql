-- Section 6 — auto-create lifecycle row on edge event insert + SSE notify (Section 8).
-- Idempotent: psql "$DATABASE_URL" -f prisma/sql/003_edge_ingress_triggers.sql

CREATE OR REPLACE FUNCTION generate_incident_lifecycle_row()
RETURNS TRIGGER AS $$
DECLARE
    new_lifecycle_id UUID;
BEGIN
    INSERT INTO fatigue_incident_lifecycle (
        event_id,
        tenant_id_uuid,
        driver_id_uuid,
        event_status,
        detected_at,
        telemetry_snapshot_json
    ) VALUES (
        NEW.event_id,
        NEW.tenant_id_uuid,
        NEW.driver_id_uuid,
        'PENDING_TRIAGE',
        NEW.hardware_timestamp,
        jsonb_build_object(
            'speed_kmh', NEW.speed_kmh,
            'heading_degrees', NEW.heading_degrees,
            'lane_deviation_index', NEW.lane_deviation_index,
            'braking_pressure_psi', NEW.braking_pressure_psi,
            'vehicle_registration', NEW.vehicle_registration,
            'fatigue_metric_type', NEW.fatigue_metric_type,
            'confidence_score', NEW.confidence_score,
            'ai_model_version', NEW.ai_model_version
        )
    )
    RETURNING lifecycle_id INTO new_lifecycle_id;

    PERFORM pg_notify(
        'channel_live_fatigue_events',
        json_build_object(
            'event', 'INCIDENT_NEW',
            'lifecycle_id', new_lifecycle_id
        )::text
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_edge_event_ingress ON edge_fatigue_events;
CREATE TRIGGER trg_edge_event_ingress
    AFTER INSERT ON edge_fatigue_events
    FOR EACH ROW EXECUTE FUNCTION generate_incident_lifecycle_row();

-- Notify on claim / status changes for SSE consumers
CREATE OR REPLACE FUNCTION notify_lifecycle_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.operator_id IS DISTINCT FROM NEW.operator_id AND NEW.operator_id IS NOT NULL THEN
        PERFORM pg_notify(
            'channel_live_fatigue_events',
            json_build_object(
                'event', 'INCIDENT_CLAIMED',
                'lifecycle_id', NEW.lifecycle_id,
                'operator_id', NEW.operator_id
            )::text
        );
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.event_status IS DISTINCT FROM NEW.event_status
       AND NEW.event_status IN ('DRIVER_ACKNOWLEDGED', 'DRIVER_DISPUTED') THEN
        PERFORM pg_notify(
            'channel_live_fatigue_events',
            json_build_object(
                'event', 'DRIVER_RESPONSE',
                'lifecycle_id', NEW.lifecycle_id,
                'event_status', NEW.event_status
            )::text
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lifecycle_sse_notify ON fatigue_incident_lifecycle;
CREATE TRIGGER trg_lifecycle_sse_notify
    AFTER UPDATE ON fatigue_incident_lifecycle
    FOR EACH ROW EXECUTE FUNCTION notify_lifecycle_change();
