# Circadia Command Center

Internal fatigue incident monitoring console. **Isolated from `app-next/`** — runs on port **3001** by default.

**Spec:** [docs/MASTER_SPEC.md](docs/MASTER_SPEC.md)

## Quick start (MVP)

```bash
cd circadia-command
cp .env.example .env
# Set DATABASE_URL to Neon (or local Postgres)

npm install
cp .env.example .env   # or copy DATABASE_URL from app-next/.env.local

# Shared Neon: SQL only (NEVER prisma db push — it would drop app-next tables)
npm run db:apply-sql

npm run dev
```

Open [http://localhost:3001/triage](http://localhost:3001/triage)

1. Click **Simulate edge ingest (dev)** — creates a `PENDING_TRIAGE` row (if trigger `003` applied)
2. Select incident · **F1** false positive · **F2** verified fatigue

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js on :3001 |
| `npm test` | Vitest |
| `npm run simulate:ingest` | CLI edge event insert |
| `npm run db:migrate-sql` | Print SQL apply order |

## Database migrations

Apply in order on Neon:

1. `prisma/sql/001_command_lifecycle.sql`
2. `prisma/sql/003_edge_ingress_triggers.sql`
3. `prisma/sql/004_lifecycle_transition_log.sql`
4. `prisma/sql/005_identity_map_extensions.sql`

## Authentication

**Local dev (`npm run dev`):** passkey is **off** by default. Open **http://localhost:3001/login**, enter email, click **Sign in**.

**Production:** passkey required at `/login`. Set `COMMAND_SKIP_WEBAUTHN=false` to test WebAuthn locally.

## Live updates (SSE)

Triage page connects to `/api/v1/triage/stream` (Postgres `LISTEN` on `channel_live_fatigue_events`).

- Green **SSE live** = real-time; amber **Polling** = fallback every 5s
- Requires `DATABASE_URL_UNPOOLED` (Neon direct, not pooler)

## Deploy to Vercel

See [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md).

## Roadmap

| Done | Next |
|------|------|
| SSE + Vercel config | Railway SSE worker (multi-instance Redis) if ops scale |
| WebAuthn + dev sign-in | Corporate OIDC (Auth0) |
| MVP triage | Manager gate API, identity sync worker |

## Safety boundaries

- Do **not** import from or modify `app-next/` driver, manager, or tenant-owner routes.
- Command tables extend shared Neon without altering core customer tables.
