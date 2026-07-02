# Zenduit One (Zendu Connect) — Circadia integration project outline

**Status:** Proposed — **not implemented**. Project outline for product, sales, and engineering planning.

**Last updated:** 2026-06

**Vendor docs:** [one-api-docs.zenduit.com](https://one-api-docs.zenduit.com) · Zendu Connect integration guide (Featurebase)

**Related:**

- [incident-routing-assembly.md](./incident-routing-assembly.md) — three pipelines (A/B/C), tenant routing M1–M4
- [autonomise-webhook-pilot.md](./autonomise-webhook-pilot.md) — live Autonomise ingest (reference adapter)
- [autonomise-fleet-risk-stream.md](./autonomise-fleet-risk-stream.md) — proposed VRN-keyed assurance stream
- [camera-risk-stream.md](./camera-risk-stream.md) — driver-axis `DriverRiskBlock`
- [ADR 0003](../adr/0003-prospective-risk-engine.md) — assurance vs compliance
- `src/lib/integrations/fatigue-event-catalogue.ts` — alarm tier / pipeline pattern to mirror

---

## 1. Executive summary

**Zenduit One** is a multi-vendor fleet marketplace (Geotab, ZenCAM, SurfSight, Smartwitness, Teltonika, etc.) with a **Zendu Connect** JSON-RPC/REST API. It exposes **safety exceptions**, **GPS logs**, **trips**, **devices**, **users**, and **camera media** — not attested work diaries.

**Circadia fit:** Zenduit is a strong second **camera/telematics vendor** alongside Autonomise. It can feed:

| Pipeline | Zenduit role |
|----------|----------------|
| **A — Compliance** | **No direct feed** — WA Reg 3.132 remains attested sheets only |
| **B — Assurance / risk** | **Primary value** — exception stream → 15-min fleet or driver exposure |
| **C — Incident lifecycle** | **Full parity target** — `/manager/alerts` + Command `/triage` |

**Product positioning:** Circadia as **fatigue record + assurance + triage layer** on fleets that already run ZenduONE — not a replacement for Zenduit coaching/scorecard, but a WA-focused compliance and operator desk where required.

**Integration style:** Poll-based ingest (Exceptions API) + on-demand Media — unlike Autonomise push webhooks. Reuse existing lifecycle, triage UI, and `triage-trigger-reasons` catalog; add a **Zenduit adapter** and **rule catalogue**.

---

## 2. Vendor platform summary

### 2.1 API access

| Item | Detail |
|------|--------|
| Docs | [one-api-docs.zenduit.com](https://one-api-docs.zenduit.com) (Postman collection; “Run in Postman”) |
| Base URL | `https://one-service.zenduit.com/api/` |
| Protocol | JSON-RPC (`method`, `params`, `credentials.sessionId`) + documented REST patterns |
| Auth | `Database`, `Username`, `Password` → `sessionId` (~14-day rotation) |
| Credentials | servicedesk@zenduit.com · integrations@zenduit.com |
| SDK (optional) | `zen-open-api` (npm) |

### 2.2 API modules relevant to Circadia

| Module | Purpose | Circadia use |
|--------|---------|--------------|
| **Exception** | Safety rule violations (fatigue, distraction, ADAS, harsh driving) | **Primary ingest** → Pipeline C (+ B aggregation) |
| **Rules** | Tenant-configured safety rules | Catalogue mapping, tenant enablement |
| **Media** | Live/historical video, snapshots, wake-up | Triage evidence (Pipeline C) |
| **Device** | Asset id, status, tracker type | VRN / device key for fleet risk |
| **Logs** | GPS + speed time series | Manager map, movement context |
| **Trips** | Trip summaries (distance, duration) | Normalise assurance (events per km) |
| **Users / Groups** | Drivers, supervisors | **Driver–vehicle assignment** (stronger than Autonomise VRN-only) |
| Jobs, Forms, Zone, Custom Data | Dispatch / ops | Out of scope v1 |

### 2.3 Zenduit-side concepts

- **Safety rules** fire **exceptions** (configurable per tenant in Admin → Rules).
- Exception workflow: **Needs Review → Reviewed → Needs Coaching → Dismissed** (with video, tags, coaching notes).
- **Driver must be assigned to vehicle** for Zenduit coaching workflow — useful for attribution hints, not legal attestation.
- **Scorecard** = exceptions weighted by distance (internal algorithm) — parallel to, not merged with, Circadia TPMA.

---

## 3. Circadia three-pipeline mapping

```text
                    Zenduit Zendu Connect API
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   Pipeline A            Pipeline B            Pipeline C
   Compliance            Assurance             Incident lifecycle
   (sheets only)         (risk heatmap)        (triage desk)
        │                     │                     │
   compliance.ts         FrmsRiskSnapshot      edge_fatigue_events
   FatigueSheet           ZenduitFleetRiskBlock? fatigue_incident_lifecycle
   NO Zenduit ingest      DriverRiskBlock?      /manager/alerts, Command
```

### 3.1 Pipeline A — Compliance (no Zenduit ingest)

| Question | Answer |
|----------|--------|
| Can Zenduit prove WA work/rest compliance? | **No** |
| What Circadia uses | Attested `FatigueSheet` + `compliance.ts` only |
| Zenduit indirect value | Manager may *compare* camera fatigue vs sheet gaps in UI copy — coaching only, not violations |

**Do not** pipe Exceptions into `compliance.ts` or breach detection.

### 3.2 Pipeline B — Assurance / risk

| Zenduit input | Engine behaviour |
|---------------|------------------|
| Exceptions (DSM + selected ADAS) | Bucket into 15-min blocks; count/decay → assurance % |
| Trips (distance) | Optional normalisation (events per km, like Zenduit scorecard) |
| Logs (speed, position) | Context on manager map / timeline — not scored as compliance |
| Device + assigned driver | Row key: **VRN** and/or **driver name** (see [autonomise-fleet-risk-stream.md](./autonomise-fleet-risk-stream.md)) |

**Principle:** Parallel display to sheet+TPMA timeline — do not merge Zenduit % into `combinedPct` by default.

### 3.3 Pipeline C — Incident lifecycle

| Zenduit input | Circadia behaviour |
|---------------|-------------------|
| New exceptions (poll) | Ingest → promote → `PENDING_TRIAGE` queue |
| Media on demand | Clip for operator/manager review |
| Rule name + tags | Map to `fatigue_metric_type` + display name |
| Exception id | Idempotency key (`zenduit:exception:{id}`) |

Reuse: Command lifecycle, manager triage (F1/F2/F3), `triage-trigger-reasons`, claim/mutex, activity timeline.

---

## 4. Rule catalogue mapping (draft)

Stable Zenduit rule names → Circadia catalogue entry. Implement as `zenduit-rule-catalogue.ts` (mirror `fatigue-event-catalogue.ts`).

**Legend:** Tier = `core` | `fatigue_adjacent` | `safety_other` | `excluded` · Pipeline = `incident` | `incident_and_assurance` | `assurance_only` | `null`

### 4.1 Ingest for triage + assurance (default on)

| Zenduit rule (representative) | Family | Tier | Pipeline | Notes |
|------------------------------|--------|------|----------|-------|
| Camera (ZenduCAM) > **Driver Fatigue** | DSM | core | incident | Maps to FATIGUE metric |
| Camera (ZenduCAM) > **Driver Distracted** | DSM | core | incident_and_assurance | DISTRACTION |
| Camera (ZenduCAM) > **Yawn** | DSM | fatigue_adjacent | incident_and_assurance | Weak fatigue signal |
| Camera (ZenduCAM) > **Phone Calling** | DSM | fatigue_adjacent | incident | Aligns with `mobile_phone_use` tag |
| Camera (SurfSight) > **Cell Phone Use** | DSM | fatigue_adjacent | incident | Same |
| Camera (SurfSight) > **Food Drink** | DSM | fatigue_adjacent | incident | Aligns with `eating` tag |
| Camera (ZenduCAM) > **Forward Collision Warning** | ADAS | fatigue_adjacent | incident | Fatigue-proxy |
| Camera (ZenduCAM) > **Lane Departure Warning** | ADAS | fatigue_adjacent | incident | |
| Camera (ZenduCAM) > **Headway Monitoring Warning** | ADAS | fatigue_adjacent | incident | Tailgating |
| Camera (ZenduCAM) > **Pedestrian Departure Warning** | ADAS | safety_other | incident | Tenant opt-in |
| Camera (ZenduCAM) > **Hard Brake / Acceleration / Turn** | — | safety_other | assurance_only | Map context, not live desk v1 |
| Camera (SurfSight) > **Possible Accident** | — | safety_other | incident | High priority; tenant flag |
| Camera (ZenduCAM) > **Panic Alarm** | EMERGENCY | safety_other | incident | Optional; not fatigue core |

### 4.2 Excluded from Circadia fatigue product (default off)

| Zenduit rule | Reason |
|--------------|--------|
| Smoking | Policy / not fatigue desk |
| Driver Unbelted / No Seatbelt | Same as Autonomise seatbelt exclusion |
| Speed / Speed Limit / Posted Speed | Fleet speeding, not Circadia fatigue IP |
| Idling, Ignition On/Off, Enter/Exit Location | Telematics ops |
| Geofence, Temperature, Humidity, Fuel, Battery | Not fatigue |
| Camera Obstruction, Power Failure, Media Error | Ops/tamper — optional ops view only |
| Faults, RPM, Coolant (OBD) | Maintenance |
| BLE door sensors, Aux inputs | Asset tracking |

### 4.3 Mapping to existing Autonomise semantics

| Circadia concept | Zenduit source |
|------------------|----------------|
| `vendorAlarmId` | Rule type string or rule id from **Rules** API (confirm from sample payload) |
| `vendorEventId` | Exception id |
| `vehicleRego` | Device → vehicle registration field |
| `driverName` | User assigned to vehicle at exception time |
| `triggerTime` | Exception timestamp |
| `fatigue_metric_type` | Derived: FATIGUE / DISTRACTION / ADAS / OTHER from family + rule name |
| Media URL | **Media** API after ingest (session-based fetch) |

---

## 5. Target architecture

### 5.1 New components (proposed)

```text
Cron / worker (Vercel cron or external)
        │
        ▼
zenduit-connect-client.ts     ← session auth, JSON-RPC wrapper
        │
        ▼
zenduit-exception-ingest.ts   ← poll Exception since cursor, idempotent upsert
        │
        ├──► ZenduitWebhookIngest (or ZenduitExceptionIngest table)
        │
        ├──► command-lifecycle-bridge (reuse pattern)
        │         └──► edge_fatigue_events + fatigue_incident_lifecycle
        │
        └──► zenduit-fleet-risk-scorer (Pipeline B)
                  └──► ZenduitFleetRiskBlock (or shared fleet block table)
```

### 5.2 Reuse (no reinvention)

| Existing module | Reuse for Zenduit |
|-----------------|-------------------|
| `fatigue-event-catalogue.ts` | Pattern for `zenduit-rule-catalogue.ts` |
| `autonomise-payload.ts` | Pattern for `zenduit-exception-fields.ts` |
| `command-lifecycle-bridge.ts` | Promote ingest → lifecycle |
| `triage-active-queue.ts` | Manager pending inbox |
| `triage-trigger-reasons.ts` | F1/F3 categories (already unified) |
| `incident-claim.ts`, lifecycle transitions | Command + manager desks |
| `autonomise-media-resolver.ts` | Pattern for on-demand Zenduit Media fetch |

### 5.3 Storage (sketch)

| Table | Role |
|-------|------|
| `ZenduitExceptionIngest` (or extend ingest pattern) | Raw exception + poll cursor metadata |
| `edge_fatigue_events` | Shared incident ledger (vendor-agnostic) |
| `fatigue_incident_lifecycle` | Pipeline C state machine |
| `ZenduitFleetRiskBlock` (optional) | Pipeline B 15-min blocks by VRN/driver |
| `CameraAlertTriage` / Command triage sync | Human decisions (vendor-neutral) |

### 5.4 Configuration (env)

```text
ZENDUIT_CONNECT_ENABLED=false
ZENDUIT_CONNECT_DATABASE=
ZENDUIT_CONNECT_USERNAME=
ZENDUIT_CONNECT_PASSWORD=
ZENDUIT_CONNECT_API_BASE=https://one-service.zenduit.com/api/
ZENDUIT_EXCEPTION_POLL_INTERVAL_MINUTES=2
ZENDUIT_EXCEPTION_LOOKBACK_HOURS=24
ZENDUIT_LIFECYCLE_BRIDGE_ENABLED=true
ZENDUIT_FLEET_RISK_ENABLED=false
```

---

## 6. Project phases

### Phase 0 — Discovery (1–2 weeks)

**Goal:** Prove API access and lock field mapping.

| # | Deliverable | Owner |
|---|-------------|-------|
| 0.1 | Zenduit credentials + Postman collection exercised | Integrations |
| 0.2 | 10+ sample Exception JSON exports (fatigue, distraction, yawn, FCW, excluded types) | Integrations |
| 0.3 | Confirm id fields: exception id, rule id/name, device id, driver id, timestamps, lat/speed | Engineering |
| 0.4 | Media API sample — clip URL lifetime, auth, latency | Engineering |
| 0.5 | Tenant rule list via **Rules** API → draft catalogue v1 | Product + Engineering |
| 0.6 | Go/no-go: single pilot fleet (tracker types: ZenCAM + Geotab?) | Product |

**Exit criteria:** Signed field-mapping doc; catalogue draft approved; no unknown blockers on video access.

---

### Phase 1 — Ingest + catalogue (2–3 weeks)

**Goal:** Exceptions land in Postgres idempotently; no UI yet.

| # | Deliverable |
|---|-------------|
| 1.1 | `zenduit-rule-catalogue.ts` + tenant enablement flags |
| 1.2 | `zenduit-connect-client.ts` (auth, session refresh, Get Exception search) |
| 1.3 | `ZenduitExceptionIngest` schema + SQL migration |
| 1.4 | Poll job with cursor (`lastSeenAt` / exception id) |
| 1.5 | Acceptance evaluation (tier + tenant settings) — mirror `evaluateAutonomiseEventAcceptance` |
| 1.6 | Unit tests with fixture payloads |
| 1.7 | Ops runbook: credential rotation, poll failures |

**Exit criteria:** Pilot tenant exceptions stored; excluded rules rejected with reason; idempotent replay.

---

### Phase 2 — Pipeline C: incident lifecycle (3–4 weeks)

**Goal:** Zenduit exceptions appear on Manager alerts + Command triage.

| # | Deliverable |
|---|-------------|
| 2.1 | Lifecycle bridge: ingest → `edge_fatigue_events` + `PENDING_TRIAGE` |
| 2.2 | Map `fatigue_metric_type` + display labels for queue cards |
| 2.3 | Media resolver on expand/open (Zenduit session + Media API) |
| 2.4 | Manager `/manager/alerts` — no UX fork; vendor badge optional |
| 2.5 | Command `/triage` — same F1/F2/F3 flow |
| 2.6 | Duplicate / multi-camera policy (rego + rearm window) — align with Autonomise discussion |
| 2.7 | E2E test: poll → queue → dismiss with trigger reasons |

**Exit criteria:** Pilot fleet managers can triage Zenduit fatigue/distraction like Autonomise; audit trail complete.

---

### Phase 3 — Pipeline B: assurance / fleet risk (2–3 weeks, optional parallel)

**Goal:** Zenduit-driven heatmap parallel to sheet+TPMA (see [autonomise-fleet-risk-stream.md](./autonomise-fleet-risk-stream.md)).

| # | Deliverable |
|---|-------------|
| 3.1 | Scorer: exceptions → 15-min blocks by VRN (and optional assigned driver) |
| 3.2 | `GET /api/manager/zenduit-fleet-risk-timeline` (or unified vendor-neutral endpoint) |
| 3.3 | Manager risk section — second panel “Zenduit camera exposure” |
| 3.4 | Disclaimer copy (assurance not compliance; may not match sheet driver) |
| 3.5 | Optional trips-based normalisation (events per km) |

**Exit criteria:** Manager sees VRN/driver camera exposure time series without sheet attribution required.

---

### Phase 4 — Enrichment + hardening (2 weeks)

| # | Deliverable |
|---|-------------|
| 4.1 | **Logs** / **Trips** enrichment on manager map (speed at event, trip distance) |
| 4.2 | False-positive export CSV includes Zenduit source column |
| 4.3 | Credential rotation automation / alerting |
| 4.4 | Rate limits, backoff, dead-letter for poll errors |
| 4.5 | Security review (session storage, secrets, manager API scope) |

---

### Phase 5 — Product packaging (ongoing)

| # | Deliverable |
|---|-------------|
| 5.1 | Tenant onboarding worksheet: Zenduit routing mode (M1–M4) + rule pack |
| 5.2 | Sales one-pager: Zenduit + Circadia vs Zenduit coaching alone |
| 5.3 | Pricing / module flag: `zenduit_incidents`, `zenduit_assurance` |
| 5.4 | Upsell path: Zenduit-only → add Circadia sheets for Pipeline A |

---

## 7. Tenant routing (reuse M1–M4)

Same assembly as [incident-routing-assembly.md](./incident-routing-assembly.md) §1a:

| Customer choice | Zenduit exceptions |
|-----------------|-------------------|
| Circadia desk + supervisor | Command queue → manager validation |
| Circadia desk only | Command auto-intervention |
| Supervisor on phone | Direct manager inbox (poll pushes to manager scope) |
| Customer SOC webhook | M4 external dispatch after operator |
| Assurance only | Phase 3 on; Phase 2 lifecycle off |

---

## 8. Risks and open questions

| # | Question | Impact |
|---|----------|--------|
| Q1 | Webhooks available or poll-only? | Poll architecture assumed; webhooks would simplify Phase 1 |
| Q2 | Exact Exception JSON schema per tracker type? | Field mapper may need per-vendor branches |
| Q3 | Media URL TTL and download rights for evidence retention? | [incident-evidence-retention.md](./incident-evidence-retention.md) |
| Q4 | Multi-tenant: one Circadia org per Zenduit database? | Auth model |
| Q5 | Zenduit coaching status vs Circadia lifecycle — sync or ignore? | Avoid double workflow confusion |
| Q6 | Geotab-only fleets without camera — in scope? | Likely exclude v1 (no DSM exceptions) |
| Q7 | Rule name stability across Zenduit releases? | Catalogue versioning strategy |

---

## 9. Out of scope (v1)

- Writing back to Zenduit (coaching status, tags) from Circadia
- Replacing Zenduit Safety dashboard or scorecard
- NHVR EWD / Geotab HOS as compliance source
- Full geofence / speed / maintenance rule ingestion
- Real-time SSE from Zenduit (unless vendor provides push later)

---

## 10. Success metrics (pilot)

| Metric | Target |
|--------|--------|
| Exception ingest lag | < 5 min p95 from Zenduit creation |
| Media playable on triage open | > 95% within 30s |
| False duplicate incidents | < 5% after bundle rules |
| Manager time-to-first-action | Comparable to Autonomise pilot |
| Compliance engine regression | Zero — no Zenduit input to Pipeline A |

---

## 11. Approval gates

Requires explicit owner approval before:

- Any Zenduit data entering compliance rule modules
- Lifecycle state mapping that differs from Autonomise
- Merging Zenduit assurance scores into TPMA `combinedPct`
- Production credential storage and poll job in Vercel

---

## 12. Suggested first sprint (if approved)

1. Phase 0.1–0.3 (credentials + samples + field map)
2. Scaffold `zenduit-rule-catalogue.ts` from §4 tables
3. Spike: single `Exception.Get` / search → console log mapped `CameraAlertItem` shape
4. Product review: Phase 2 only vs Phase 2+3 for pilot customer

---

## 13. Document history

| Date | Change |
|------|--------|
| 2026-06 | Initial outline from Zenduit API review + Circadia pipeline mapping |
