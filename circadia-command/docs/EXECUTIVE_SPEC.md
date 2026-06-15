# Executive technical specification: Circadia Command Center

Canonical Sections 1–2 from architecture review. **Sections 3+ are not yet defined** — see [SPEC_GAPS.md](./SPEC_GAPS.md).

**Implemented in repo:** `prisma/sql/001_command_lifecycle.sql`, `prisma/schema.prisma`

## 1. System boundaries & engine architecture

Circadia Command is a secure, decoupled internal ops platform for in-house monitoring specialists.

### Core developer restraints

1. **Zero component leakage** — no changes to customer Driver, Manager, or Tenant Owner routes (`app-next/`).
2. **Independent frontend** — `circadia-command/` deploys to Vercel (`command.circadia24.com`).
3. **Privileged access routing** — global triage bypasses per-tenant scoping; talks only to a whitelisted API gateway.
4. **Infrastructure** — Next.js (Vercel), Neon Postgres, SSE on Railway.

## 2. Database schemas & identity maps (Neon Postgres)

Tables (apply via `prisma/sql/001_command_lifecycle.sql`):

| Id | Table | Purpose |
|----|-------|---------|
| A | `identity_uuid_map` | `tenant_cuid` / `driver_cuid` ↔ UUID |
| B | `edge_fatigue_events` | Pi / YOLO ingress telemetry |
| C | `fatigue_incident_lifecycle` | WAHVA/NHVR audit ledger + RLS |
| D | `command_operators` | Internal operator directory |
| E | RLS policy | `command_operator_global_access` on lifecycle |

### Lifecycle `event_status` values (CHECK constraint)

`PENDING_TRIAGE` · `VERIFIED_FALSE_POSITIVE` · `VERIFIED_TRUE_FATIGUE` · `INTERVENTION_SENT` · `DRIVER_ACKNOWLEDGED` · `DRIVER_DISPUTED` · `CLOSED`

`closed_at` is NULL until final resolution.

### Repo additions beyond Gemini SQL

- `IF NOT EXISTS` / `DROP POLICY IF EXISTS` for idempotent apply
- `operator_id` FK → `command_operators`
- `chk_lifecycle_event_status` CHECK on `event_status`
