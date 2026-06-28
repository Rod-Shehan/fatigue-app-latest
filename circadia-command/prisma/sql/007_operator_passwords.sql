-- Operator email + password login (replaces passkey-only access for pilot).
-- Idempotent: psql "$DATABASE_URL" -f prisma/sql/007_operator_passwords.sql

ALTER TABLE command_operators
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;
