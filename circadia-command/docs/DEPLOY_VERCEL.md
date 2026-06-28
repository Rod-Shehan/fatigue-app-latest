# Deploy Circadia Command to Vercel

Target: **command.circadia24.com** (separate Vercel project from `app-next`).

Production URL: **https://command.circadia24.com** (Vercel alias: https://circadia-command.vercel.app)

## 1. Vercel project

- GitHub repo: `fatigue-app-latest`
- **Root Directory:** `circadia-command`

## 2. Environment variables

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon **pooled** connection string |
| `DATABASE_URL_UNPOOLED` | Neon **direct** host (no `-pooler`) — required for SSE |
| `COMMAND_SESSION_SECRET` | `openssl rand -base64 32` |
| `COMMAND_PILOT_TENANT_ID_UUID` | Pilot tenant UUID |
| `COMMAND_OPERATOR_IP_WHITELIST` | Office IPs (comma-separated), optional |
| `COMMAND_ALLOW_SIMULATE` | `false` in production |

Remove obsolete vars if present: `WEBAUTHN_*`, `COMMAND_SKIP_WEBAUTHN`, `COMMAND_ALLOW_DEV_LOGIN`.

## 3. Bootstrap owner (once per Neon)

```bash
OPERATOR_USERNAME=rod OPERATOR_PASSWORD='…' npm run bootstrap:owner
```

## 4. Deploy

```bash
cd circadia-command
npx vercel --prod
```

Or push to `main` if Git integration is enabled.

## 5. Post-deploy checks

- `/api/health` → `{ "ok": true }`
- `/login` → username + password
- `/triage` → **SSE live** when stream connected

## SQL migrations

Run once locally against Neon (not on every deploy):

```bash
npm run db:apply-sql
```

Includes `010_edge_autonomise_source.sql` (links `edge_fatigue_events` to Autonomise ingest ids).

## Manager ingest bridge (`app-next`)

Command triage receives the **same accepted Autonomise webhook events** as manager Live alerts. On the **app-next** Vercel project, set:

| Variable | Value |
|----------|--------|
| `COMMAND_PILOT_TENANT_ID_UUID` | Same UUID as Command (`circadia-command`) |
| `COMMAND_LIFECYCLE_BRIDGE_ENABLED` | `true` (optional if tenant UUID is set) |

Redeploy **app-next** after adding env vars. Optional one-time backfill of existing accepted events:

```bash
cd app-next
COMMAND_PILOT_TENANT_ID_UUID=… npx tsx scripts/backfill-command-lifecycle.ts
```

Dev simulate ingests (`SIM*`) can be cleared from the queue with:

```bash
cd circadia-command
npm run purge:simulated
```
