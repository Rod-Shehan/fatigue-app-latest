-- Command owner role + username login (idempotent).
-- psql "$DATABASE_URL" -f prisma/sql/008_operator_roles.sql

ALTER TABLE command_operators
    ADD COLUMN IF NOT EXISTS username VARCHAR(64),
    ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'command_operator';

UPDATE command_operators
SET username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g'))
WHERE username IS NULL AND email IS NOT NULL;

UPDATE command_operators
SET username = 'user_' || left(replace(operator_id::text, '-', ''), 8)
WHERE username IS NULL OR username = '';

-- De-dupe usernames before unique index
UPDATE command_operators o
SET username = o.username || '_' || left(replace(o.operator_id::text, '-', ''), 6)
FROM (
    SELECT operator_id,
           row_number() OVER (PARTITION BY username ORDER BY created_at) AS rn
    FROM command_operators
    WHERE username IS NOT NULL
) d
WHERE o.operator_id = d.operator_id AND d.rn > 1;

ALTER TABLE command_operators ALTER COLUMN email DROP NOT NULL;

DROP INDEX IF EXISTS idx_command_operators_username;
CREATE UNIQUE INDEX IF NOT EXISTS idx_command_operators_username
    ON command_operators (username);

ALTER TABLE command_operators DROP CONSTRAINT IF EXISTS command_operators_role_check;
ALTER TABLE command_operators
    ADD CONSTRAINT command_operators_role_check
    CHECK (role IN ('command_owner', 'command_operator'));
