# Deploy Circadia Command to Vercel

Target: **command.circadia24.com** (separate Vercel project from customer `app-next`).

## 1. Create Vercel project

1. [vercel.com](https://vercel.com) → **Add New Project**
2. Import the same GitHub repo as `fatigue-app-latest`
3. Set **Root Directory** → `circadia-command`
4. Framework: **Next.js** (auto-detected)

## 2. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon **pooled** connection string (Prisma / API routes) |
| `DATABASE_URL_UNPOOLED` | Neon **direct** host (no `-pooler`) — required for SSE `LISTEN` |
| `COMMAND_SESSION_SECRET` | `openssl rand -base64 32` |
| `WEBAUTHN_RP_ID` | `command.circadia24.com` |
| `WEBAUTHN_ORIGIN` | `https://command.circadia24.com` |
| `COMMAND_SKIP_WEBAUTHN` | `false` |
| `NEXT_PUBLIC_COMMAND_SKIP_WEBAUTHN` | `false` |
| `COMMAND_OPERATOR_IP_WHITELIST` | Office static IPs (comma-separated) |
| `COMMAND_PILOT_TENANT_ID_UUID` | Pilot tenant UUID |

**Do not set** `COMMAND_ALLOW_DEV_LOGIN` in production.

### Neon direct URL

Copy pooled URL from Neon dashboard, then:

- Replace `-pooler` in hostname with nothing  
  e.g. `ep-xxx-pooler.region.aws.neon.tech` → `ep-xxx.region.aws.neon.tech`

## 3. Custom domain

Vercel → Project → **Domains** → add `command.circadia24.com`  
Add DNS CNAME per Vercel instructions.

## 4. Deploy

Push to `main` (or run `vercel --cwd circadia-command` locally).

```bash
cd circadia-command
npx vercel --prod
```

## 5. Post-deploy checks

- `https://command.circadia24.com/api/health` → `{ "ok": true }`
- `/login` → passkey sign-in works with `WEBAUTHN_RP_ID` matching domain
- `/triage` → header shows **SSE live** (green) when stream connected
- Simulate ingest (dev/staging only) updates queue within ~2s without manual refresh

## SSE notes

- Stream route: `/api/v1/triage/stream` (same origin — session cookie auth)
- Uses Postgres `LISTEN channel_live_fatigue_events` (migration `003`)
- `maxDuration: 300` in `vercel.json` — requires **Vercel Pro** for 5-minute streams; Hobby plan falls back to **Polling** badge when SSE disconnects
- Client auto-reconnects every 3s with `lastEventId` catchup

## SQL migrations

Run once against Neon (not on every deploy):

```bash
npm run db:apply-sql
```
