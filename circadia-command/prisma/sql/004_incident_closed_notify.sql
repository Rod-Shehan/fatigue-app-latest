-- Notify Command SSE when an incident leaves PENDING_TRIAGE (manager or operator triage).
-- Idempotent: psql "$DATABASE_URL" -f prisma/sql/004_incident_closed_notify.sql

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
       AND OLD.event_status = 'PENDING_TRIAGE'
       AND NEW.event_status IS DISTINCT FROM 'PENDING_TRIAGE' THEN
        PERFORM pg_notify(
            'channel_live_fatigue_events',
            json_build_object(
                'event', 'INCIDENT_CLOSED',
                'lifecycle_id', NEW.lifecycle_id,
                'event_status', NEW.event_status
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
