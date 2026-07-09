# Project Circadia FRMS — Case Specification (Scope V2)

**Document ref:** CIRCADIA-SCOPE-V2-2026  
**Date:** 9 July 2026  
**Status:** Architecture specification — not yet implemented  
**Repository:** fatigue-app-latest

**Target environments:**

| Boundary | Stack | Role |
|----------|-------|------|
| **A — Edge device** | Raspberry Pi 5 + Hailo-8L NPU, Python/C++ | Cabin laboratory — acquisition, inference, haptics, local storage |
| **B — External server** | Next.js / TypeScript / Neon (`app-next`, `frms-engine` service) | Manager fusion — compliance, risk, capsule ingest, plain-English UI |

**Related docs:**

- [Risk & compliance engines overview](./risk-and-compliance-engines-overview.md) — current TS/Python engines
- [FRMS Python integration](../../app-next/docs/architecture/frms-python-integration.md) — server-side TPMA today
- [Camera risk stream](../../app-next/docs/architecture/camera-risk-stream.md) — BT packet contract v1
- ADR 0003 — prospective risk vs retrospective compliance

---

## 1. Project vision & paradigm shift

Project Circadia is a spacecraft-level reliability Fatigue Risk Management System (FRMS) designed to replace legacy "compliance theater" with **real-time biological assurance**.

**Core directive:** Treat the heavy-vehicle cabin as a **Mobile Fatigue Measurement Laboratory**. The system actively deconstructs, evaluates, and verifies the human risk profile across hard architectural boundaries **without relying on subjective human inputs**, which transport research and lived experience prove are structurally unreliable.

**Product positioning (unchanged from current ADRs):**

- Retrospective **compliance** (WA Reg 184E) remains on the attested diary record.
- FRMS assurance timelines and edge telemetry are **coaching and safety** — not statutory EWD verdicts unless separately certified.

---

## 2. System boundaries & architectural separation

To ensure stable compilation and prevent logic leakage, the codebase is **structurally partitioned** into two independent software environments.

### Boundary A: Onboard edge device (cabin laboratory)

| Attribute | Requirement |
|-----------|-------------|
| **Runtime** | Python / C++ natively on Raspberry Pi 5; external NVMe/SSD partition |
| **Directives** | Low-latency acquisition (100 FPS loop arrays), Hailo NPU inference, hardware relay, volatile storage cleanup |
| **Isolation** | Zero awareness of WebSockets, API routing, or admin UI layouts |
| **Upstream** | Asynchronous data packet payloads when network is available |

**Planned repo location (new):** `edge-device/` or `circadia-edge/` (not yet created). **Do not** place edge inference inside `app-next/` or `circadia-command/`.

### Boundary B: External server (manager fusion layer)

| Attribute | Requirement |
|-----------|-------------|
| **Runtime** | TypeScript / Node.js / Next.js (`app-next/src/lib`) + optional Python TPMA service (`frms-engine/`) |
| **Directives** | Retrospective compliance (1440-min grids), prospective risk, multi-modal capsule receipt/verification, plain-English rendering |
| **Isolation** | Zero awareness of raw frame pointers, NPU temperatures, or local edge file handles |

**Existing entry points:** `getComplianceEngine()`, `buildRiskRegister()`, `manager-risk-scoring.ts`, `camera-risk-packet.ts`, `frms/orchestrator.ts`.

### Parsing rule for Cursor / agents

When implementing changes:

1. **Edge Python/C++** — no TypeScript or web UI imports.
2. **Server TypeScript** — preserve **1440-minute daily boolean grid** structure for compliance integrity.
3. **Compliance rule IP** — changes to `compliance.ts` / `five-hour-break-rule.ts` require owner approval (`.cursor/rules/time-rules-ip.mdc`).

---

## 3. Core technical modules (five engines)

### Engine 1 — "Acknowledge & Verify" entry gate

**Spec location:** `frms-engine/app/math_engine.py` & `frms-engine/app/initialization.py`

| Requirement | Detail |
|-------------|--------|
| **Deprecate** | Legacy 1–5 subjective fatigue self-assessment slider and scalar multipliers |
| **Add** | Binary WAHVA Reg 184E "Fit for Work" statutory acknowledgement checkbox |
| **If acknowledged** | External compliance timeline initializes to GREEN; TPMA Process S starts at baseline **0.0** |
| **5-minute silent audit** | On departure (speed > 0 km/h): 30,000-frame window @ 100 FPS |
| **Metrics** | Camera 1: involuntary eyelid velocity distribution; 940 nm steering-wheel marker coordinate variance |
| **Override** | If mean vs historical profile: eyelid velocity < 75% **or** steering entropy < 60% → `SUSPECT_PRE_FATIGUE`; scale Process S accumulation **+40%**; arm haptics early |

**Current codebase:**

| Item | State |
|------|-------|
| `math_engine.py` self-report bump | **Exists** — `_self_report_impairment_bump` on 1–5 levels |
| `driver-alertness.ts` / Day card slider | **Exists** — UI + fusion into risk timeline |
| `initialization.py` | **Missing** |
| 5-min enrollment / eyelid velocity / steering entropy | **Missing** |
| Fit-for-work binary gate | **Missing** (compliance uses event diary, not edge gate) |

**Implementation notes:**

- Server: remove `alertness_level` from TPMA payload path when edge gate is authoritative; keep compliance diary separate.
- Edge: new `initialization.py` owns enrollment window; exports `suspect_pre_fatigue` flag in telemetry packets only.

---

### Engine 2 — Zero-lag visual control safeguard

**Spec location:** `frms-engine/app/inference_loop.py` & `app-next/src/lib/manager-risk-scoring.ts`

| Requirement | Detail |
|-------------|--------|
| **Sensor** | Camera 1 tracks angular velocity Δθ/Δt of **940 nm reflective marker** on steering wheel rim (not chassis IMU) |
| **Control entropy** | Track 1–3 Hz micro-corrections for lane alignment |
| **Anomaly** | Distraction clock accumulating (e.g. mirror check) **but** steering marker variance < 0.05 → **Unintended Drift Anomaly** |
| **Response** | Bypass dynamic L/v timeout matrix; distraction window → 0 s; trip hardware relay / haptic **immediately** |

**Current codebase:**

| Item | State |
|------|-------|
| `inference_loop.py` | **Missing** |
| Steering marker / entropy | **Missing** |
| `camera-risk-packet.ts` | **Exists** — 15-min blocks: drowsiness, distraction, eyes-off-road, yawns (no steering entropy) |
| `manager-risk-scoring.ts` | **Exists** — tiers from compliance + prospective risk + GPS; **no** drift anomaly layer |
| Command triage | Separate pipeline (Autonomise video) — not cabin steering marker |

**Implementation notes:**

- Extend `CameraRiskPacket` schema **v2** with `steering_entropy`, `eyelid_velocity_mean`, `drift_anomaly` flags.
- Edge: `inference_loop.py` runs at 100 FPS; server ingests aggregated 15-min capsules only.
- Manager: new plain-English branch in Engine 4 for drift anomaly events.

---

### Engine 3 — Two-tiered edge storage controller

**Spec location:** `frms-engine/app/storage_manager.py` (edge repo; not Railway `frms-engine` service)

| Partition | Path | Behaviour |
|-----------|------|-----------|
| **A — Volatile buffer** | `/mnt/circadia_ssd/rolling` | 100 FPS arrays + low-res MJPEG in 1-min chunks; FIFO purge at **90%** util → delete oldest unflagged until **10%** headroom |
| **B — Protected vault** | `/mnt/circadia_ssd/evidence` | 30 s **Evidence Data Capsule** on fatigue milestone or dispute; JSON + IR frames + plain-English summary; **no FIFO**; delete only after server **HTTP 200** crypto handshake |

**Current codebase:**

| Item | State |
|------|-------|
| `storage_manager.py` | **Missing** |
| Evidence capsule ingest API | **Partial** — Command `edge_fatigue_events` + media URLs; no cryptographic vault handshake |
| Incident evidence retention doc | **Exists** — `app-next/docs/architecture/incident-evidence-retention.md` |

**Implementation notes:**

- New server route: `POST /api/internal/evidence-capsule/ack` with signed token → edge may unlink vault file.
- Capsule schema versioned separately from `CameraRiskPacketV1`.

---

### Engine 4 — Dual-layer triage & plain-English translation

**Spec location:** `app-next/src/lib/manager-risk-scoring.ts` (+ new translation module)

| Layer | Content |
|-------|---------|
| **Technical** | Frame EAR streams, eyelid velocity curves, steering variance floats (forensic) |
| **Manager summary** | Biological drop-off + control degradation in plain English |
| **Driver summary** | Non-punitive, educational — autonomic reflex stalling; haptic as safety buffer |

**Current codebase:**

| Item | State |
|------|-------|
| `manager-risk-scoring.ts` | **Exists** — tiering, badges, compliance dominance |
| Plain-English capsule summaries | **Missing** |
| Dual-layer incident presentation | **Partial** — Command triage shows video + metric type; no eyelid/steering narrative |
| `manager-prospective-risk-reference.ts` | **Exists** — ISO reference cards, not edge telemetry narratives |

**Implementation notes:**

- Add `lib/evidence-capsule-narrative.ts` (server only) — input: capsule JSON → `{ managerSummary, driverSummary, technical }`.
- Keep technical layer in DB; expose human layer in Manager UI and optional driver notification.

---

### Engine 5 — Silent trial & calibration mode gateway

**Spec location:** `frms-engine/app/operational_policy.py` (edge)

| Flag | `SILENT_OBSERVATION_MODE = True` |
|------|----------------------------------|
| **When enabled** | Full inference, baselines, TPMA, evidence capsules — **no** buzzers, audio, or haptics |
| **Goal** | 14–30 day baseline phase: map biological reality vs compliant paperwork before active intervention |

**Current codebase:**

| Item | State |
|------|-------|
| `operational_policy.py` | **Missing** |
| Command silent observation | **N/A** — Command is operator triage, not edge policy |
| Test desk / simulate ingest | **Exists** — dev drills only |

---

## 4. Current vs specified — gap summary

| Engine | Spec modules | In repo today | Gap |
|--------|--------------|---------------|-----|
| 1 Acknowledge & Verify | `initialization.py`, math_engine changes | `math_engine.py` (TPMA only); self-report **active** | New edge init; deprecate slider path |
| 2 Visual control safeguard | `inference_loop.py`, manager scoring | BT camera v1 packets; no steering entropy | New edge loop; packet v2; manager anomaly tier |
| 3 Edge storage | `storage_manager.py` | None on device | New edge repo partition |
| 4 Plain-English triage | `manager-risk-scoring.ts` + narrative | Tiering only | Narrative module + capsule UI |
| 5 Silent trial | `operational_policy.py` | None | Edge policy flag |

**Important:** Today’s `frms-engine/` is a **Railway-hosted TPMA microservice** (15-min diary blocks), not the Pi edge stack. Scope V2 assumes a **separate edge codebase** plus extensions to the existing server contracts.

---

## 5. Recommended implementation phases

### Phase 0 — Contracts (server, no edge hardware)

1. Define `EvidenceCapsuleV1` and `CameraRiskPacketV2` schemas (steering entropy, eyelid velocity, flags).
2. Add `evidence-capsule-narrative.ts` stub with plain-English templates.
3. Document deprecation path for `alertness_level` 1–5 in TPMA when edge gate ships.

### Phase 1 — Edge scaffold (Pi)

1. Create `edge-device/` with `initialization.py`, `inference_loop.py`, `storage_manager.py`, `operational_policy.py`.
2. Hailo face mesh + 940 nm marker tracking prototypes.
3. Local haptic relay driver behind `SILENT_OBSERVATION_MODE`.

### Phase 2 — Server ingest

1. Capsule upload API + vault ack handshake.
2. Manager dual-layer UI for capsule review.
3. Extend `manager-risk-scoring` with `UNINTENDED_DRIFT_ANOMALY` tier input.

### Phase 3 — Deprecation & cutover

1. Remove self-report bump from `math_engine.py` when fleet on edge gate.
2. Remove day-card alertness slider from driver UI (or hide behind feature flag).
3. Fleet silent observation → active intervention policy flip per tenant.

---

## 6. Formula & engine preservation (Boundary B)

Scope V2 does **not** replace existing compliance or prospective risk math. Edge telemetry **feeds** assurance layers:

```
Edge 100 FPS → 15-min aggregates → CameraRiskPacketV2 / EvidenceCapsule
                                        ↓
                    risk-block-ingest + manager-risk-timeline (or TPMA)
                                        ↓
                    manager-risk-scoring (tiers + plain-English — Engine 4)

Diary events → 1440-min grids → compliance.ts (unchanged statutory path)
                              → risk-register.ts (unchanged prospective path)
```

**Process S baseline 0.0** after fit-for-work ack applies to **edge-authoritative TPMA session**, not retroactive diary compliance state.

---

## 7. Regulatory & product guardrails

| Claim | Allowed when |
|-------|----------------|
| WA Reg 184E compliance on attested record | `compliance.ts` + signed diary |
| FRMS biological assurance | Edge + TPMA + manager timeline |
| Replacing subjective self-report with objective telemetry | After Engine 1 shipped + fleet policy |
| NHVR FRMSc / approved EWD | **Not claimed** without separate certification |

Fit-for-work **checkbox** is a statutory acknowledgement UX — legal review required before production wording.

---

## 8. Document history

| Date | Change |
|------|--------|
| 2026-07-09 | Scope V2 case specification ingested from CIRCADIA-SCOPE-V2-2026; mapped to codebase gaps |
