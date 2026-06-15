# Circadia Command Center — Master specification

> Paste Gemini into [inbox/GEMINI_PASTE_HERE.md](./inbox/GEMINI_PASTE_HERE.md) → **Process the Gemini inbox** in Cursor.

| Field | Value |
|-------|-------|
| Last updated | 2026-06-11 |
| Spec completeness | **A–I merged** (see [SCHEMA_ADAPTATIONS.md](./SCHEMA_ADAPTATIONS.md)) |
| Implementation | Schema/SQL/OpenAPI only — app code not scaffolded |

---

## Status dashboard

| Section | Topic | Spec | Code |
|---------|-------|------|------|
| 1 | Boundaries | Done | — |
| 2 | Database core | Done | `001`–`005` SQL |
| 3 | State machine + audit log | Done | `004_lifecycle_transition_log.sql` |
| 4 | Operator auth | Done | — (implement in app) |
| 5 | API gateway | Done | `openapi/command-api-v1.yaml` |
| 6 | Edge ingress | Done | `003` + presign route |
| 7 | Identity sync | Done | `005` + Railway worker spec |
| 8 | Railway SSE | Done | `003` NOTIFY + Redis fan-out spec |
| 9 | Frontend | Done | Page map + hooks spec |
| 10 | Driver intervention | Done | WebSocket + HUD spec |
| 11 | Product defaults | Done | Recommendations below |

**Migrations apply order:** `001` → `002` (if needed) → `003` → `004` → `005`

---

## Section 1 — Boundaries

- Isolated `circadia-command/` — no changes to existing customer UI routes.
- Vercel `command.circadia24.com` · API `api-command.circadia24.com/v1` · SSE `stream-command.circadia24.com`.
- Neon Postgres shared instance; operators use global triage (RLS bypass via JWT claim).

---

## Section 2 — Database

| Table | Purpose |
|-------|---------|
| `identity_uuid_map` | cuid ↔ UUID (+ `is_active`) |
| `edge_fatigue_events` | Pi ingress |
| `fatigue_incident_lifecycle` | Incident ledger (RLS) |
| `lifecycle_transition_log` | Append-only audit (immutable trigger) |
| `command_operators` | Operators + `hardware_mfa_verified` |
| `tenant_compliance_policy_overrides` | Manager gate per tenant |

---

## Section 3 — State machine

### Transitions + timestamps

| From | To | Actor | Timestamps |
|------|-----|-------|------------|
| `PENDING_TRIAGE` | `VERIFIED_FALSE_POSITIVE` | OPERATOR | `triaged_at`, `closed_at` |
| `PENDING_TRIAGE` | `VERIFIED_TRUE_FATIGUE` | OPERATOR | `triaged_at` |
| `VERIFIED_TRUE_FATIGUE` | `MANAGER_VALIDATION_PENDING` | SYSTEM | — |
| `VERIFIED_TRUE_FATIGUE` | `INTERVENTION_SENT` | SYSTEM | `intervention_triggered_at` |
| `MANAGER_VALIDATION_PENDING` | `INTERVENTION_SENT` | FLEET_MANAGER | `intervention_triggered_at` |
| `MANAGER_VALIDATION_PENDING` | `VERIFIED_FALSE_POSITIVE` | FLEET_MANAGER | `triaged_at`, `closed_at` |
| `INTERVENTION_SENT` | `DRIVER_ACKNOWLEDGED` / `DRIVER_DISPUTED` | DRIVER | `driver_responded_at` |
| `DRIVER_ACKNOWLEDGED` | `CLOSED` | SYSTEM (timer) | `closed_at` |
| `DRIVER_DISPUTED` | `CLOSED` | FLEET_MANAGER | `closed_at` |

### Idempotency

- `UPDATE … WHERE lifecycle_id = ? AND event_status = expected`
- `rowCount === 0` → `409 ERR_STATE_CONCURRENCY_VIOLATION`
- Append row to `lifecycle_transition_log` on success

---

## Section 4 — Operator authentication

**Stack:** `@simplewebauthn/server` — **not** NextAuth.

### Flow

1. OIDC corporate login (Auth0 Enterprise) → session with `hardware_mfa_verified = false`
2. Force `/auth/register-hardware` → WebAuthn register (`cross-platform`, `userVerification: required`)
3. Every login: `login-options` → passkey → `login-verify` (signature counter anti-clone)

### JWT (`CommandOperatorSessionJWT`)

| Claim | Value |
|-------|-------|
| `sub` | `command_operators.operator_id` |
| `role` | `command_operator` (Neon RLS) |
| `permissions` | `triage:global`, `intervention:trigger`, `audit:read` |
| `hardware_mfa_verified` | must be `true` for API |
| `network_whitelisted` | set at runtime |
| `exp` | 4 hours max |

### Neon transaction wrapper

```typescript
await client.query("SELECT set_config('request.jwt.claim.role', $1, true), set_config('request.jwt.claim.sub', $2, true)", ['command_operator', operatorId]);
```

### IP whitelist middleware

`COMMAND_OPERATOR_IP_WHITELIST` — production 403 `ERR_IP_OUT_OF_BOUNDS` on `/triage` and `/api/v1`.

### Auth routes

| Route | Purpose |
|-------|---------|
| `POST /api/auth/login` | OIDC → intermediate token |
| `GET /api/auth/mfa-challenge` | WebAuthn options |
| `POST /api/auth/mfa-verify` | Passkey verify → HTTP-only session JWT |
| `GET /api/auth/register-options` | Hardware MFA enrollment |
| `POST /api/auth/verify-register` | Set `hardware_mfa_verified = true` |

---

## Section 5 — API gateway

**OpenAPI:** [openapi/command-api-v1.yaml](../openapi/command-api-v1.yaml)

### Pagination

Cursor = base64 `{ last_time, last_id }` on `(detected_at, lifecycle_id)`.

### Claim concurrency

```sql
UPDATE fatigue_incident_lifecycle SET operator_id = $1
WHERE lifecycle_id = $2 AND operator_id IS NULL;
-- rowCount 0 → 409 ERR_INCIDENT_ALREADY_CLAIMED
```

### Mutate + manager gate

- `VERIFIED_TRUE_FATIGUE` + gate off → `200` `INTERVENTION_SENT`
- Gate on → `202` `MANAGER_VALIDATION_PENDING`

### Manager validate

`manager_user_cuid` validated against `User` with `role = 'manager'` (not `FLEET_MANAGER` — see adaptations doc).

### Driver token

```typescript
const driverToken = crypto.createHmac('sha256', process.env.DRIVER_SECRET_SALT)
  .update(`${driverCuid}:${shiftDate}`).digest('hex');
```

### Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `ERR_MALFORMED_PAYLOAD` | 400 | Invalid JSON |
| `ERR_TOKEN_EXPIRED` | 401 | Session expired |
| `ERR_SCOPE_VIOLATION` | 403 | Wrong tenant/role |
| `ERR_IP_OUT_OF_BOUNDS` | 403 | IP not whitelisted |
| `ERR_MFA_CRYPTO_FAILURE` | 400 | WebAuthn failed |
| `ERR_STATE_CONCURRENCY_VIOLATION` | 409 | Status mismatch |
| `ERR_INCIDENT_ALREADY_CLAIMED` | 409 | Claim race |
| `ERR_INVALID_TRANSITION` | 409 | Closed incident |
| `ERR_AUDIT_LOG_IMMUTABLE` | 500 | Audit tamper attempt |

---

## Section 6 — Edge ingress

- DB role `circadia_edge_ingress` — `INSERT` only on `edge_fatigue_events`
- Pi payload: see `EdgeFatigueIngressPayload` in inbox merge
- Video: `POST /ingress/media-token` → presigned R2 URL (120s) → Pi uploads → sets `video_snippet_url`
- Rate limit: max 3 events per `vehicle_registration` per 60s rolling window
- Stationary suppression: `speed_kmh = 0` → no alert (product default I.4)

---

## Section 7 — Identity sync

**Railway worker** (no customer DB triggers):

```sql
SELECT d.id AS driver_cuid FROM "Driver" d
LEFT JOIN identity_uuid_map m ON d.id = m.driver_cuid
WHERE m.mapping_id IS NULL LIMIT 100;
```

Pilot: `PILOT_TENANT_CUID` + `PILOT_TENANT_ID_UUID` env vars (Driver has no `tenant_id`).

**Edge provision:** `GET /hardware/provision?driver_cuid=&vehicle_reg=` → `{ driver_id_uuid, tenant_id_uuid, frms_policy_toggle_manager_gate }`

Deactivation: sync sets `identity_uuid_map.is_active = false`.

---

## Section 8 — SSE (operators)

- `GET stream-command.circadia24.com/v1/triage/stream?token=JWT`
- Headers: `text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
- Reconnect: `Last-Event-ID` → catchup query for missed `PENDING_TRIAGE`
- Scale: Neon `NOTIFY` → primary Railway node → **Redis Pub/Sub** → all SSE nodes
- Env: `PORT`, `NEON_DATABASE_URL`, `REDIS_URL`, `ENGINE_HEARTBEAT_INTERVAL_MS=15000`

---

## Section 9 — Frontend

| Path | Purpose |
|------|---------|
| `/` | WebAuthn login |
| `/triage` | 3-zone monitoring UI |
| `QueuePanel` | Zone 1 — queue |
| `MediaViewport` | Zone 2 — 3s video loop + graphs |
| `ActionPanel` | Zone 3 — SOP + actions |

Hooks: `useCommandSSE`, `useKeyboardTriage` (F1 dismiss / F2 escalate).

States: skeleton loading · amber reconnect banner · green “ALL ASSETS CLEAR” empty.

---

## Section 10 — Driver intervention

- Driver app: **WebSocket** `INTERVENTION_SIGNAL` when status → `INTERVENTION_SENT`
- HUD: fullscreen lockout, amber warning, Ack / Dispute touch zones
- Audio: 850 Hz square wave @ 120 BPM, max volume; Twilio WebRTC for operator voice
- FFW: 15-min non-bypassable rest screen; persists across app kill/reboot
- `POST /driver/respond` with HMAC `driver_auth_token`

### Proposed app-next touchpoints (needs approval)

| Route | Purpose |
|-------|---------|
| `GET /api/frms/policy` | Manager gate flag |
| `POST /api/frms/manager-callback` | Forward to Command API |
| `GET /api/frms/audit-stream` | Manager compliance history |

---

## Section 11 — Product defaults (approved recommendations)

1. **Tenant:** pilot single-tenant emulation via sync worker env
2. **Video:** isolated Cloudflare R2 bucket
3. **Voice:** Twilio WebRTC (not custom Railway audio)
4. **Parked alerts:** auto-suppress at 0 km/h
5. **Network:** IP whitelist + WebAuthn (hybrid)
6. **Dispute lockout:** no manager pause — 15-min rest mandatory
7. **Shifts:** stateless — audit via `lifecycle_transition_log` only

---

## Related docs

- [SCHEMA_ADAPTATIONS.md](./SCHEMA_ADAPTATIONS.md) — Gemini vs app-next fixes
- [MISSING_PARTS.md](./MISSING_PARTS.md) — was the gap list (now largely complete)
- [COLLABORATION.md](./COLLABORATION.md) — inbox workflow
