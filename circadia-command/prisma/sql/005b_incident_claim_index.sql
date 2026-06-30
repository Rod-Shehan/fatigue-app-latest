CREATE INDEX IF NOT EXISTS idx_lifecycle_claimed_at
  ON fatigue_incident_lifecycle (claimed_at)
  WHERE claimed_at IS NOT NULL;
