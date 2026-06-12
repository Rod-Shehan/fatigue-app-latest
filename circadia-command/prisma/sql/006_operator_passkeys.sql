-- Section 4 — WebAuthn passkey storage for command operators.
CREATE TABLE IF NOT EXISTS command_operator_passkeys (
    credential_id TEXT PRIMARY KEY,
    operator_id UUID NOT NULL REFERENCES command_operators(operator_id) ON DELETE CASCADE,
    public_key BYTEA NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    transports TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_passkeys_operator ON command_operator_passkeys (operator_id);
