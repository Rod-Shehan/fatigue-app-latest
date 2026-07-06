# Live alert test desk

End-to-end drills for **Manager Live alerts** and **Command triage** (events, sound, mobile layout).

## Enable (both Vercel projects)

| Project | Variable | Value |
|---------|----------|--------|
| **app-next** | `TEST_INCIDENTS_ENABLED` | `true` |
| **app-next** | `TEST_INCIDENT_INTERNAL_SECRET` | Shared secret (`openssl rand -base64 32`) |
| **app-next** | `COMMAND_APP_URL` | `https://command.circadia24.com` (for background push dispatch) |
| **circadia-command** | `TEST_INCIDENT_INTERNAL_SECRET` | Same secret |
| **circadia-command** | `APP_NEXT_URL` | `https://www.circadia24.com` |
| **circadia-command** | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |
| **circadia-command** | `VAPID_SUBJECT` | `mailto:command@circadia24.com` |

Also required for Command queue: `COMMAND_PILOT_TENANT_ID_UUID`, `DATABASE_URL_UNPOOLED` (SSE).

Apply SQL migration `011_operator_push_subscriptions.sql` on shared Neon (`npm run db:apply-sql` from `circadia-command`).

## UI entry points

| App | URL | Who |
|-----|-----|-----|
| Manager | `/manager/test-desk` | Signed-in manager or owner |
| Manager | Live alerts header → **Test** | Same |
| Command | `/admin/test-desk` | `command_owner` only |

## Drill checklist

1. **Phone B** — https://command.circadia24.com/triage → tap **speaker icon** → allow notifications when prompted → confirm **SSE live**
2. Optional: overflow menu (⋮) → **Keep screen on** for overnight foreground desk use
3. Inject **fatigue** or **distraction** from Command or Manager test desk
4. **Foreground:** desk alarm plays; status in ⋮ menu shows Sounds: On, Last alarm: time
5. **Background:** lock phone → inject again → notification appears (iOS: install PWA to home screen first)
6. Wake phone → tap notification → opens triage with incident selected
7. **Purge test incidents** when done

## What inject does

- Creates an **Autonomise-shaped** event ingest (`drill-*` id, `TEST*` rego)
- Runs the same follow-up as production webhooks (media placeholder, **Command lifecycle bridge**)
- Appears on **Manager** (shared ingest) and **Command** (lifecycle queue)
- Dispatches Web Push to subscribed Command operators (deduped per lifecycle id)
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

## Sound and notification behaviour

| Scenario | Expected |
|----------|----------|
| Triage tab open, sounds enabled | Desk alarm WAV on every new lifecycle id |
| iOS suspended audio after hours | Amber “resume sounds” banner; tap speaker icon |
| Screen off / app backgrounded | Web Push notification (if subscribed + VAPID configured) |
| View only shift | Queue updates but no sound (by design) |

Limits:

- Does not override iPhone silent switch or DND
- iOS push requires PWA installed to home screen (iOS 16.4+)
- Foreground alarms require operator to enable sounds once per device (persisted in localStorage)

## Optional clip URL

Set `TEST_INCIDENT_SAMPLE_CLIP_URL` on app-next to a short MP4/WebM for video playback during drills (default: `pending://test-incident/...`).
