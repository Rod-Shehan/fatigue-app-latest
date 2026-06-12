# Circadia Command — specification gaps

**Status:** Gemini has returned Sections 1–2 twice (identical, ends at RLS). Database layer is implemented in this repo. **Do not re-request Section 2.**

## Still undefined

- [ ] Section 3 — Lifecycle state machine (transitions, idempotency, audit rules)
- [ ] Section 4 — Operator auth + hardware MFA + JWT `role=command_operator`
- [ ] Section 5 — API gateway routes (OpenAPI)
- [ ] Section 6 — Edge ingress (Pi → Neon, lifecycle bootstrap)
- [ ] Section 7 — `identity_uuid_map` sync (no customer UI changes)
- [ ] Section 8 — Railway SSE (events, auth, backfill)
- [ ] Section 9 — Frontend page map + env vars
- [ ] Section 10 — Driver intervention / ack (minimal customer touchpoint)
- [ ] Section 11 — Phased MVP + acceptance criteria

## Open product questions

- **`tenant_cuid`** — customer app has no `Tenant` table; define org identity or use single-tenant UUID for pilot
- **RLS scope** — ingress service role must bypass RLS; operators use JWT claim
- **`telemetry_snapshot_json`** — required fields at creation

## Follow-up prompt for Gemini (copy verbatim)

```
STOP. Do NOT repeat Sections 1 or 2. They are finalized and implemented in circadia-command/.

Write ONLY Sections 3 through 11 of the Circadia Command Center spec.

Frozen context:
- Package: circadia-command/ (isolated from app-next customer app)
- DB tables on shared Neon: identity_uuid_map, edge_fatigue_events, fatigue_incident_lifecycle (RLS + CHECK on event_status), command_operators
- event_status enum: PENDING_TRIAGE, VERIFIED_FALSE_POSITIVE, VERIFIED_TRUE_FATIGUE, INTERVENTION_SENT, DRIVER_ACKNOWLEDGED, DRIVER_DISPUTED, CLOSED
- Deploy: Vercel command.circadia24.com, SSE on Railway
- Customer app: User/Driver use cuid; NO Tenant table; ZERO changes to driver/manager/owner routes

Required sections:
3. Lifecycle state machine (transition table, who acts, idempotency, immutability)
4. Operator authentication (hardware MFA, session/JWT, Neon RLS claim issuance)
5. API gateway (REST routes with request/response JSON shapes and error codes)
6. Edge ingress pipeline (how Pi writes edge_fatigue_events and spawns lifecycle rows)
7. Identity map sync job (cuid → UUID without customer UI)
8. Railway SSE (event catalog, auth, reconnect)
9. Next.js frontend (pages, components, env vars)
10. Driver intervention channel (ack/dispute — specify if any customer-app endpoint is required)
11. MVP phases with acceptance criteria

Format: numbered sections only. Use tables and TypeScript/OpenAPI snippets where needed. Max 5 open decisions. Do not output SQL for tables already defined.
```
