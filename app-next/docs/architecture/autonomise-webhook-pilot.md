# MTS Autonomise webhook pilot

**Purpose:** Connect Miocevich Transport Services (Autonomise.ai) Event + Media webhooks to Circadia for capture and fatigue filtering.

**Production base:** `https://fatigue-app-latest.vercel.app`

## Circadia endpoints

| Hook | URL |
|------|-----|
| **Event** | `https://fatigue-app-latest.vercel.app/api/integrations/autonomise/events` |
| **Media** | `https://fatigue-app-latest.vercel.app/api/integrations/autonomise/media` |

`GET` on each URL returns `{ configured, preset }` for a quick health check (no secret required).

## Vercel environment variables

Set in Vercel → Project → Settings → Environment Variables:

```text
AUTONOMISE_WEBHOOK_SECRET=<same value as Autonomise x-webhook-secret header>
AUTONOMISE_EVENT_PRESET=core_plus_adas
```

Optional:

```text
AUTONOMISE_TENANT_GUID=2bd17364-739f-f011-8e62-6045bdfcbf17
AUTONOMISE_FATIGUE_EVENT_TYPE_CODES=18,48,50
```

`AUTONOMISE_FATIGUE_EVENT_TYPE_CODES` — optional extra numeric `eventTypes` treated as DSM Fatigue. Autonomise enum **18** = Fatigue; **2** = Speed (do not include 2).

Optional tenant override when Autonomise renumbers types:

```text
AUTONOMISE_EVENT_TYPE_CODE_MAP={"22":"VT3600AI_ALARM_ADAS_LaneDeparture"}
```

### Autonomise `eventTypes` → Circadia alarms (VT3600 / MTS)

From Autonomise API `EventTypeDto` (swagger). Circadia maps these before the fatigue catalogue gate runs.

| Code | Autonomise name | VT3600 alarm | `core_plus_adas` |
|------|-----------------|--------------|------------------|
| 2 | *(legacy MTS fatigue)* | DSM Fatigue | On |
| 18 | Fatigue | DSM Fatigue | On |
| 20 | Distraction | DSM Distracted | On |
| 22 | Lane Departure | ADAS Lane Departure | On |
| 23 | Forward Collision Warning | ADAS FCW | On |
| 28 | Following Distance Warning | ADAS Following Distance | On |
| 27 | Mobile Phone Warning | DSM Phonecall | Off (optional) |
| 48 | Drowsy Eyes Detected | DSM Fatigue | On |
| 50 | Physiological Fatigue | DSM Fatigue | On |
| 19 | Smoking | — | Excluded |
| 29 | Seatbelt Unfastened | — | Excluded |

Telematics codes (Speed, Brake, etc.) are not mapped — ingest stores them as `missing_alarm_id` / filtered.

**Video fetch** (required for clips when media webhooks have no URL):

```text
AUTONOMISE_PRIMARY_KEY=<Primary API key from Autonomise → API Settings>
AUTONOMISE_CLIENT_ID=5e5A9Zq2e7
```

Optional: `AUTONOMISE_SECONDARY_KEY`, `AUTONOMISE_API_BASE_URL`.

**Media API** (when webhooks have no clip URL) — per [Autonomise API docs](https://api.autonomise.ai/docs/index.html):

```text
GET /device/{hardwareId}/event/{eventId}/media
```

Auth is **OAuth2 client credentials** (not the raw Primary key on the request):

```text
POST https://login.autonomise.ai/connect/token
  grant_type=client_credentials
  client_id=<AUTONOMISE_CLIENT_ID>
  client_secret=<AUTONOMISE_PRIMARY_KEY>
  scope=vt.api
```

Then `Authorization: Bearer <access_token>` on the media GET. Circadia does this automatically when `AUTONOMISE_PRIMARY_KEY` and `AUTONOMISE_CLIENT_ID` are set.

```text
AUTONOMISE_MEDIA_PATH_TEMPLATE=/device/{deviceId}/event/{eventId}/media
```

Do **not** use the old `/event/{eventId}/media?clientId=…` template unless Autonomise support confirms it.

After adding env vars, **redeploy** production.

## Metrics bridge (Autonomise → risk timeline) — pilot

**Off by default.** When enabled, accepted **Fatigue** and **Distraction** events may update `DriverRiskBlock` (15-min assurance scores). This is separate from Live alerts triage.

### Enable

```text
AUTONOMISE_BLOCK_BRIDGE_ENABLED=true
```

Apply DB migration: `prisma/sql/autonomise_metrics_attribution.sql` (or `npm run db:push`).

### Attribution policy

1. **Auto (sheet-duty only)** — VRN on day card + work minutes in the 15-min block at `triggerTime`. No Autonomise driver name required. Skips when ambiguous or sheet not caught up.
2. **Manual backfill** — manager assigns events to a driver when auto-match missed:

```bash
curl -X POST "https://fatigue-app-latest.vercel.app/api/manager/autonomise-block-bridge/attribute" \
  -H "Cookie: …" \
  -H "Content-Type: application/json" \
  -d '{"driverName":"Pat Driver","ingestIds":["clxxx"]}'
```

Driver must have a login user (email on Approved Drivers).

### Rollback / undo

1. **Stop new writes** — remove `AUTONOMISE_BLOCK_BRIDGE_ENABLED` or set `false`; redeploy.
2. **Remove metrics data** (Live alert rows unchanged):

```text
AUTONOMISE_BLOCK_BRIDGE_ALLOW_PURGE=true
```

Then `POST /api/manager/autonomise-block-bridge/purge` (manager session). Deletes `DriverRiskBlock` rows with `fusionSources` containing `autonomise` and all `AutonomiseMetricsAttribution` rows.

### Future — parallel Autonomise fleet risk (not built)

A separate **vehicle/rego-keyed** assurance timeline on `/manager` — independent of sheet duty and TPMA — is specified in [autonomise-fleet-risk-stream.md](./autonomise-fleet-risk-stream.md). Potential product path for Autonomise-native fleets. Do not conflate with the metrics bridge above.

## Database

Run once after deploy (local or CI):

```bash
cd app-next
npm run db:push
```

Creates `AutonomiseWebhookIngest` table for raw payload capture.

## Autonomise configuration (MTS admin)

1. **User → Organisation → API**
2. Set **Header Key** `x-webhook-secret` and **Header Value** = `AUTONOMISE_WEBHOOK_SECRET`
3. Enable **Event webhook** → paste Event URL above
4. Enable **Media webhook** → paste Media URL above
5. **Update settings**
6. **Device alarms** — Raise Event on DSM Fatigue, Distraction, and ADAS fatigue-proxy alarms only (see `fatigue-event-catalogue.ts`)

## Test with curl

```bash
curl -sS -X POST "https://fatigue-app-latest.vercel.app/api/integrations/autonomise/events" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{"eventId":"test-1","alarmId":"VT3600AI_ALARM_DSM_Fatigue","vehicleRegistration":"1TST001"}'
```

Expected: `200` with `"accepted": true` and an `ingestId`.

Seatbelt test (should reject):

```bash
curl -sS -X POST "https://fatigue-app-latest.vercel.app/api/integrations/autonomise/events" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{"eventId":"test-2","alarmId":"VT3600AI_ALARM_DSM_SeatbeltUnfastened"}'
```

Expected: `200` with `"accepted": false`, `"rejectReason": "excluded_alarm"`.

## What happens next

1. Real Autonomise payloads arrive → stored in `AutonomiseWebhookIngest`
2. Refine `autonomise-payload.ts` field mapping from real JSON
3. Wire accepted events → incident lifecycle + `/manager/alerts` + evidence retention — see [incident-evidence-retention.md](./incident-evidence-retention.md)

See [incident-routing-assembly.md](./incident-routing-assembly.md) §5d.
