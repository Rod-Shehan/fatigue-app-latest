# Circadia Command Center

Internal fatigue incident monitoring console. **Isolated from `app-next/`** — runs on port **3001** by default.

**Spec:** [docs/MASTER_SPEC.md](docs/MASTER_SPEC.md)

## Quick start

```bash
cd circadia-command
cp .env.example .env
# Set DATABASE_URL to Neon (shared with app-next)

npm install
npm run db:apply-sql
OPERATOR_USERNAME=your.name OPERATOR_PASSWORD='your-password' npm run bootstrap:owner
npm run dev
```

Open [http://localhost:3001/login](http://localhost:3001/login)

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js on :3001 |
| `npm test` | Vitest |
| `npm run simulate:ingest` | CLI edge event insert |
| `npm run db:apply-sql` | Apply SQL migrations to Neon |
| `npm run db:migrate-sql` | Print SQL apply order |
| `npm run bootstrap:owner` | Create/update first owner account |

## Database migrations

Applied via `npm run db:apply-sql` (idempotent):

1. `001_command_lifecycle.sql`
2. `003_edge_ingress_triggers.sql`
3. `004_lifecycle_transition_log.sql`
4. `005_identity_map_extensions.sql`
5. `007_operator_passwords.sql`
6. `008_operator_roles.sql`
7. `009_drop_passkeys.sql`

Optional: `002_section3_state_machine.sql` if upgrading an old `001` install.

## Authentication

| Role | Access |
|------|--------|
| `command_owner` | `/admin/users` + triage |
| `command_operator` | Triage only |

Sign in with **username + password** (bcrypt, min 6 characters). Owners create all accounts at `/admin/users`.

## Live updates (SSE)

Triage connects to `/api/v1/triage/stream` (Postgres `LISTEN`). Requires `DATABASE_URL_UNPOOLED`.

## Deploy

See [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md). Production: https://command.circadia24.com

## Safety boundaries

- Do **not** modify `app-next/` driver, manager, or tenant-owner routes.
- Never run `prisma db push` on shared Neon.
