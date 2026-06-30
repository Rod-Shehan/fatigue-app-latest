ALTER TABLE fatigue_incident_lifecycle
  ADD COLUMN IF NOT EXISTS claimed_by_user_id VARCHAR(30),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by_actor_type VARCHAR(50);
