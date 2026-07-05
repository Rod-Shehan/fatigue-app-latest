# Live alert test desk

End-to-end drills for **Manager Live alerts** and **Command triage** (events, sound, mobile layout).

## Enable (both Vercel projects)

| Project | Variable | Value |
|---------|----------|--------|
| **app-next** | `TEST_INCIDENTS_ENABLED` | `true` |
| **app-next** | `TEST_INCIDENT_INTERNAL_SECRET` | Shared secret (`openssl rand -base64 32`) |
| **circadia-command** | `TEST_INCIDENT_INTERNAL_SECRET` | Same secret |
| **circadia-command** | `APP_NEXT_URL` | `https://www.circadia24.com` |

Also required for Command queue: `COMMAND_PILOT_TENANT_ID_UUID`, `DATABASE_URL_UNPOOLED` (SSE).

## UI entry points

| App | URL | Who |
|-----|-----|-----|
| Manager | `/manager/test-desk` | Signed-in manager or owner |
| Manager | Live alerts header → **Test** | Same |
| Command | `/admin/test-desk` | `command_owner` only |

## Drill checklist

1. **Phone A** — https://www.circadia24.com/manager/alerts → **Needs review** → **Enable sounds**
2. **Phone B** — https://command.circadia24.com/triage → **Enable sounds** → **SSE live**
3. Inject **fatigue** or **distraction** from either test desk
4. Confirm same `TEST*` rego on both desks within ~30s (Manager poll) / instantly (Command SSE)
5. Confirm desk alarms on both devices (foreground tab, sounds enabled)
6. **Purge test incidents** when done

## What inject does

- Creates an **Autonomise-shaped** event ingest (`drill-*` id, `TEST*` rego)
- Runs the same follow-up as production webhooks (media placeholder, **Command lifecycle bridge**)
- Appears on **Manager** (shared ingest) and **Command** (lifecycle queue)
- Does **not** use Command-only `SIM*` simulate-ingest

## API (automation)

```bash
# Status
curl -sS -H "x-test-incident-secret: $SECRET" \
  https://www.circadia24.com/api/internal/test-incident

# Inject fatigue
curl -sS -X POST -H "Content-Type: application/json" \
  -H "x-test-incident-secret: $SECRET" \
  -d '{"kind":"fatigue"}' \
  https://www.circadia24.com/api/internal/test-incident

# Purge
curl -sS -X POST -H "x-test-incident-secret: $SECRET" \
  https://www.circadia24.com/api/internal/test-incident/purge
```

Command owners can call the same routes on `command.circadia24.com` (server proxies to app-next).

## Sound limits (current)

- Browser tab must be open; user must click **Enable sounds** once per session/device
- Does not override system silent / DND
- Push notifications when backgrounded: **not implemented** (see `app-next/docs/architecture/manager-critical-alert-spec.md`)

## Optional clip URL

Set `TEST_INCIDENT_SAMPLE_CLIP_URL` on app-next to a short MP4/WebM for video playback during drills (default: `pending://test-incident/...`).
