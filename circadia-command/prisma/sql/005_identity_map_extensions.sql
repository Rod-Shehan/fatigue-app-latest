-- Category E — identity map extensions for sync worker + deactivation.
-- Idempotent: psql "$DATABASE_URL" -f prisma/sql/005_identity_map_extensions.sql

ALTER TABLE identity_uuid_map
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_uuid_map_driver_cuid
    ON identity_uuid_map (driver_cuid);
