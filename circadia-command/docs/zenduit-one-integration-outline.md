# Zenduit One — Command center integration (outline)

**Status:** Proposed — **not implemented**.

**Canonical spec:** [app-next/docs/architecture/zenduit-one-integration-outline.md](../../app-next/docs/architecture/zenduit-one-integration-outline.md)

**Related:** [MASTER_SPEC.md](./MASTER_SPEC.md) · [SECTION_03_LIFECYCLE.md](./SECTION_03_LIFECYCLE.md) · [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)

---

## 1. Why Command for Zenduit fleets

ZenduONE customers already have **safety exceptions**, **video**, and **coaching** inside Zenduit. Circadia Command addresses a different sale:

| Zenduit native | Circadia Command |
|----------------|------------------|
| Safety scorecard + coaching tags | **Fatigue-focused operator desk** (F1/F2/F3) |
| Per-fleet Zenduit UI | **Circadia-operated** triage at `command.circadia24.com` |
| General safety rules | Catalogue filtered to **DSM / fatigue-adjacent ADAS** (see parent doc §4) |
| Coaching workflow states | **`fatigue_incident_lifecycle`** + evidence retention |

Same market opening as Manager + assurance: **port Circadia onto Zenduit telematics** without replacing Zenduit as the device platform.

Command is required for tenant routing **M1**, **M2**, and **M4** ([incident-routing-assembly.md](../../app-next/docs/architecture/incident-routing-assembly.md)). Routing **M3** (supervisor-only) skips Command but still uses the same ingest in `app-next`.

---

## 2. What Command consumes (vendor-agnostic today)

Command already implements Pipeline **C** for Autonomise:

| Layer | Tables / APIs |
|-------|----------------|
| Ledger | `edge_fatigue_events`, `fatigue_incident_lifecycle` |
| Queue | `GET /api/v1/triage/queue`, `fetchTriageQueue` |
| Real-time | SSE + Postgres `NOTIFY` |
| Actions | `POST /api/v1/triage/mutate`, `resolve`, `verify-distraction` |
| Media | `hydrate-edge-media` from linked ingest row |
| Reasons | `triage-trigger-reasons` (unified F1/F3 catalog) |

**Zenduit goal:** new exceptions reach the **same queue** with no parallel operator product.

---

## 3. Zenduit-specific design

### 3.1 Ingress stays in `app-next`

Mirror Autonomise bridge ([DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)):

1. Scheduled **poll** of Zenduit **Exception** API (`app-next` credentials).
2. Upsert `ZenduitExceptionIngest`.
3. `command-lifecycle-bridge` → `edge_fatigue_events` + `PENDING_TRIAGE`.
4. Lifecycle insert triggers **SSE** to Command operators.

Command **does not** hold Zenduit `sessionId` in v1 (rotation, security boundary).

### 3.2 Media

| Step | Behaviour |
|------|-----------|
| Queue load | Placeholder or cached thumbnail if available |
| Operator selects incident | `hydrate-edge-media` (extend) calls Zenduit **Media** API via `app-next` proxy or shared resolver |
| Evidence retention | Follow [incident-evidence-retention.md](../../app-next/docs/architecture/incident-evidence-retention.md) — re-host if URLs are short-lived |

### 3.3 Queue card fields

Map Zenduit exception → existing `QueueIncident` shape:

| `QueueIncident` field | Zenduit source |
|-----------------------|----------------|
| `lifecycle_id` | `fatigue_incident_lifecycle` |
| `vehicle_registration` | Device / VRN |
| `fatigue_metric_type` | Rule family (FATIGUE / DISTRACTION / …) |
| `detected_at` | Exception timestamp |
| `video_snippet_url` | After media hydrate |
| `confidence_score` | Vendor field if present; else default |

Optional UI: **source badge** `Zenduit` vs `Autonomise` from `edge_fatigue_events.source_vendor` or ingest table join.

### 3.4 Operator actions (no change)

| Key | Action | Reasons |
|-----|--------|---------|
| F1 | `VERIFIED_FALSE_POSITIVE` | Unified `triage-trigger-reasons` |
| F2 | Verified fatigue → resolution form | Unchanged |
| F3 | Verified distraction | Same trigger catalog as F1 |

Works for **any** Zenduit event type in catalogue — same as Manager desk.

### 3.5 What Command must not do

- Sync status back to Zenduit (Needs Coaching / Dismissed).
- Show WA compliance or fatigue sheets.
- Run Zenduit poll jobs (keep credentials in `app-next`).

---

## 4. Command work breakdown

| Phase | Command deliverables |
|-------|---------------------|
| **0** | Review sample exceptions in `/triage` simulate-ingest fixtures |
| **1** | None (ingest only in `app-next`) |
| **2** | Extend `hydrate-edge-media` for Zenduit ingest ids |
| **2** | `source_vendor` on queue/SSE payload |
| **2** | Dev fixtures: `simulate-ingest` Zenduit-shaped payloads |
| **2** | E2E operator test: F1 dismiss with phone + looking-left reasons |
| **4** | Operator runbook: media failures, session expiry |
| **4** | Load test: poll burst → SSE backlog |

---

## 5. Deployment notes

| Project | Zenduit-related config |
|---------|------------------------|
| `app-next` | `ZENDUIT_CONNECT_*`, poll cron, lifecycle bridge |
| `circadia-command` | No Zenduit secrets v1; shared `DATABASE_URL` only |

SQL: extend `edge_fatigue_events` link column if needed (pattern: `010_edge_autonomise_source.sql`).

---

## 6. Success criteria (Command pilot)

- Operator sees Zenduit fatigue/distraction in queue within **5 min p95** of Zenduit exception time.
- F1/F2/F3 + claim/mutex behave identically to Autonomise incidents.
- Video plays on first open for **> 95%** of ZenCAM exceptions.
- Manager desk (M1) receives synced triage after operator action — unchanged bridge.

---

## 7. Document history

| Date | Change |
|------|--------|
| 2026-06 | Command companion outline; links to app-next canonical spec |
