-- Remove unused WebAuthn passkey table (superseded by password auth in 007).
-- Idempotent: psql "$DATABASE_URL" -f prisma/sql/009_drop_passkeys.sql

DROP TABLE IF EXISTS command_operator_passkeys CASCADE;
