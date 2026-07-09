# Project Circadia FRMS — Case Specification (Scope V3)

**Document ref:** CIRCADIA-SCOPE-V3-2026  
**Date:** 9 July 2026  
**Status:** Architecture specification — not yet implemented  
**Repository:** fatigue-app-latest  
**Supersedes:** [circadia-frms-scope-v2-2026.md](./circadia-frms-scope-v2-2026.md) (five-engine model)

**Target environments:**

| Boundary | Stack | Role |
|----------|-------|------|
| **A — Edge device** | Raspberry Pi 5 + Hailo-8L NPU, Python/C++ | Cabin laboratory — acquisition, inference, haptics, local storage |
| **B — External server** | Next.js / TypeScript / Neon (`app-next`, `frms-engine` service) | Manager fusion — compliance, risk, capsule ingest, plain-English UI |

**Related docs:**

- [Edge ↔ server contracts (Phase 0)](./schemas/README.md) — JSON schemas, golden fixtures, validators
- [Risk & compliance engines overview](./risk-and-compliance-engines-overview.md) — current TS/Python engines
- [FRMS Python integration](../../app-next/docs/architecture/frms-python-integration.md) — server-side TPMA today
- [Camera risk stream](../../app-next/docs/architecture/camera-risk-stream.md) — BT packet contract v1 (legacy)
- ADR 0003 — prospective risk vs retrospective compliance

---

## 1. Project vision & paradigm shift

Project Circadia is a spacecraft-level reliability Fatigue Risk Management System (FRMS) designed to replace legacy **compliance theater** with **real-time biological assurance**.

**Core architectural directive:** Treat the heavy-vehicle cabin as a **Mobile Fatigue Measurement Laboratory**. The system actively deconstructs, evaluates, and verifies the human risk profile across hard architectural boundaries **without relying on subjective human inputs**, which transport research, the FAEyeTON framework, and lived experience prove are structurally unreliable.

**Product positioning (unchanged from current ADRs):**

- Retrospective **compliance** (WA Reg 184E) remains on the attested diary record.
- FRMS assurance timelines and edge telemetry are **coaching and safety** — not statutory EWD verdicts unless separately certified.

---

## 2. System boundaries & architectural separation

To ensure stable compilation and prevent logic leakage, the codebase is **structurally partitioned** into two independent software environments.

### Boundary A: Onboard edge device code (the cabin laboratory)

| Attribute | Requirement |
|-----------|-------------|
| **Environment** | Python / C++ running natively on Raspberry Pi 5 with external NVMe/SSD partition |
| **Directives** | Low-latency, high-fidelity data acquisition (100 FPS loop arrays), real-time NPU matrix inference, local physical hardware relay management, volatile storage cleanup |
| **Isolation rule** | Zero awareness of web sockets, API routing tables, or administrative web UI layouts |
| **Upstream** | Communicates solely via asynchronous data packet payloads when network connections become available |

**Planned repo location (new):** `edge-device/` or `circadia-edge/` (separate Pi project). **Do not** place edge inference inside `app-next/` or `circadia-command/`.

### Boundary B: External server code (the manager fusion layer)

| Attribute | Requirement |
|-----------|-------------|
| **Environment** | TypeScript / Node.js / Next.js backend infrastructure (`app-next/src/lib`) |
| **Directives** | Retrospective statutory compliance logging (WA Reg 184E), prospective risk scenario modeling based on 1440-minute daily boolean grids, multi-modal data capsule receipt/verification, plain-English translation rendering |
| **Isolation rule** | Zero awareness of raw camera frame pointers, NPU hardware temperatures, or local edge file system handles |

**Existing entry points:** `getComplianceEngine()`, `buildRiskRegister()`, `manager-risk-scoring.ts`, `camera-risk-packet.ts`, `circadia-contracts/`, `frms/orchestrator.ts`.

---

## 3. Core technical module instructions (six engines)

### Engine 1 — "Acknowledge & Verify" entry gate

**Spec location:** `frms-engine/app/math_engine.py` & `frms-engine/app/initialization.py` (edge Pi repo)

| Requirement | Detail |
|-------------|--------|
| **Deprecation** | Completely strip the legacy 1–5 subjective fatigue self-assessment slider and associated scalar multipliers |
| **Modification** | Binary WAHVA Reg 184E "Fit for Work" statutory acknowledgement checkbox |
| **If checked** | External compliance timeline initializes to `GREEN`; TPMA Process S initializes strictly at baseline **0.0** — objective edge telemetry only |
| **5-minute silent audit** | On vehicle departure (speed > 0 km/h): 30,000-frame enrollment window @ 100 FPS |
| **Metrics** | Camera 1: involuntary eyelid velocity distribution; 940 nm steering-wheel marker coordinate variance |
| **Override** | Mean vs historical profile: eyelid velocity < **75%** or steering entropy < **60%** → `SUSPECT_PRE_FATIGUE`; scale Process S accumulation **+40%**; arm haptics early |

**Current codebase:**

| Item | State |
|------|-------|
| `math_engine.py` self-report bump | **Exists** — `_self_report_impairment_bump` on 1–5 levels |
| `driver-alertness.ts` / Day card slider | **Exists** — UI + fusion into risk timeline |
| `initialization.py` | **Missing** (edge repo) |
| 5-min enrollment / eyelid velocity / steering entropy | **Missing** |
| Fit-for-work binary gate | **Missing** (compliance uses event diary, not edge gate) |
| Contract | **Draft** — [`edge-session-init-v1`](./schemas/edge-session-init-v1.schema.json) + fixture |

---

### Engine 2 — Zero-lag visual control safeguard

**Spec location:** `frms-engine/app/inference_loop.py` & `app-next/src/lib/manager-risk-scoring.ts`

| Requirement | Detail |
|-------------|--------|
| **Sensor** | Move away from chassis IMU; Camera 1 tracks angular velocity (Δθ/Δt) of **940 nm reflective marker** on steering wheel rim |
| **Control entropy** | Track continuous 1–3 Hz micro-corrections for lane alignment |
| **Anomaly** | Distraction clock accumulating (e.g. mirror check) **but** steering marker variance below flatline (< **0.05**) → **Unintended Drift Anomaly** |
| **Response** | Bypass dynamic L/v timeout clearance matrix; distraction window → **0 s**; trip hardware relay / haptic **immediately** |

**Current codebase:**

| Item | State |
|------|-------|
| `inference_loop.py` | **Missing** (edge repo) |
| Steering marker / entropy | **Missing** |
| `camera-risk-packet.ts` v1 | **Exists** — no steering entropy |
| `circadia-contracts` v2 | **Draft** — `steering_entropy`, `unintended_drift_anomaly` flag |
| `manager-risk-scoring.ts` | **Exists** — no drift anomaly tier |

---

### Engine 3 — Advanced oculomotor & head kinematics (DEMoNS & FAEyeTON alignment)

**Spec location:** `frms-engine/app/saccade_analyzer.py` (edge Pi repo)

| Requirement | Detail |
|-------------|--------|
| **Algorithm** | Modified Velocity-Threshold Identification (I-VT) @ **100 Hz** under pure 940 nm IR |
| **Metric targets** | Gaze shift velocity, fixation durations, head vector velocity (ΔYaw/Δt), inter-movement latencies |
| **Main sequence decoupling** | Rolling ratio of saccadic peak velocity vs amplitude; peak velocity drops **> 30%** below driver baseline while amplitude consistent → autonomic motor-neuron fatigue |
| **Cognitive tunneling / glaze** | Prolonged fixation **> 3.5 s** on single vector + decreased head movement velocity → accelerate TPMA Process S **independently** of eye closure |
| **Nodding verification** | Sharp downward head pitch **without** corresponding upward saccadic gaze correction → override pipeline; flag active **micro-sleep milestone** |

**Current codebase:**

| Item | State |
|------|-------|
| `saccade_analyzer.py` | **Missing** (edge repo) |
| I-VT / saccade pipeline | **Missing** |
| Main sequence / cognitive tunneling flags | **Missing** — optional fields planned in [`camera-risk-packet-v2`](./schemas/camera-risk-packet-v2.schema.json) (V3 extension) |
| TPMA Process S acceleration from tunneling | **Missing** — server-side TPMA extension when edge authoritative |
| FAEyeTON / DEMoNS reference metrics | **Documented here only** — not in production ingest |

**Contract extension (V3, optional on v2 packet):** `gaze_shift_velocity_mean`, `fixation_duration_max_seconds`, `head_yaw_velocity_mean`, `saccade_peak_velocity_ratio_vs_baseline`, flags `main_sequence_decoupling`, `cognitive_tunneling`, `nodding_micro_sleep`. See [schemas README — V3 extensions](./schemas/README.md#v3-engine-3-oculomotor-extensions).

---

### Engine 4 — Two-tiered edge storage controller

**Spec location:** `frms-engine/app/storage_manager.py` (edge Pi repo)

| Partition | Path | Behaviour |
|-----------|------|-----------|
| **A — Volatile buffer** | `/mnt/circadia_ssd/rolling` | 100 FPS arrays + low-res MJPEG in 1-min unindexed chunks; FIFO purge at **90%** util → delete oldest unflagged until **10%** headroom |
| **B — Protected vault** | `/mnt/circadia_ssd/evidence` | 30 s **Evidence Data Capsule** on fatigue milestone or dispute; JSON + IR frames + plain-English summary; **no FIFO**; delete only after server **HTTP 200** cryptographic handshake |

**Current codebase:**

| Item | State |
|------|-------|
| `storage_manager.py` | **Missing** (edge repo) |
| Evidence capsule ingest API | **Partial** — Command `edge_fatigue_events`; no vault ack handshake in production |
| Contract | **Draft** — [`evidence-capsule-v1`](./schemas/evidence-capsule-v1.schema.json), [`vault-ack-v1`](./schemas/vault-ack-v1.schema.json) |

---

### Engine 5 — Dual-layer triage & plain-English translation

**Spec location:** `app-next/src/lib/manager-risk-scoring.ts` (+ new narrative module)

| Layer | Content |
|-------|---------|
| **Technical** | EAR streams, eyelid velocity curves, saccadic velocity distributions, steering variance floats (forensic) |
| **Manager summary** | Biological drop-off + control degradation — e.g. "Involuntary eye-opening speed dropped 48% below baseline during a circadian low point" + "steering micro-corrections flatlined for 2.4 seconds" |
| **Driver summary** | Non-punitive, educational — autonomic reflex stalling; haptic as biological safety buffer, not administrative infraction |

**Current codebase:**

| Item | State |
|------|-------|
| `manager-risk-scoring.ts` | **Exists** — tiering, badges, compliance dominance |
| `evidence-capsule-narrative.ts` | **Missing** (Phase 0 remainder) |
| Capsule `narrative` in contract | **Optional** on ingest — server may generate |
| Command triage presentation | **Partial** — video + metric type; no oculomotor narrative |

---

### Engine 6 — Silent trial & calibration mode gateway

**Spec location:** `frms-engine/app/operational_policy.py` (edge Pi repo)

| Flag | `SILENT_OBSERVATION_MODE = True` |
|------|----------------------------------|
| **When enabled** | Full face-mesh inference, steering entropy, baselines, TPMA, locked evidence capsules — **no** buzzers, audio, or haptics |
| **Goal** | 14–30 day baseline phase: map biological reality vs compliant paperwork before active intervention |

**Current codebase:**

| Item | State |
|------|-------|
| `operational_policy.py` | **Missing** (edge repo) |
| Contract flag | **Draft** — `operational_flags.silent_observation_mode` on all edge payloads |
| Test desk / simulate ingest | **Exists** — Command dev drills only |

---

## 4. Instruction for Cursor parsing

When implementing changes, evaluate files **independently**:

1. **Edge Python/C++** — no TypeScript or web UI dependencies.
2. **Server TypeScript** — maintain strict **1440-minute daily boolean grid** structure in manager/compliance layers.
3. **Compliance rule IP** — changes to `compliance.ts` / `five-hour-break-rule.ts` require owner approval (`.cursor/rules/time-rules-ip.mdc`).
4. **Contracts first** — Pi encoders and server validators must pass `node scripts/validate-circadia-contracts.mjs` before production ingest routes ship.

---

## 5. V2 → V3 engine renumbering

| V2 engine | V3 engine | Change |
|-----------|-----------|--------|
| 1 Acknowledge & Verify | 1 | Unchanged |
| 2 Visual control safeguard | 2 | Unchanged |
| — | **3 Oculomotor & head kinematics** | **New** — `saccade_analyzer.py`, FAEyeTON alignment |
| 3 Edge storage | 4 | Renumbered |
| 4 Plain-English triage | 5 | Renumbered; now includes saccade distributions in technical layer |
| 5 Silent trial | 6 | Renumbered |

---

## 6. Current vs specified — gap summary

| Engine | Spec modules | In repo today | Gap |
|--------|--------------|---------------|-----|
| 1 Acknowledge & Verify | `initialization.py`, math_engine | TPMA + self-report **active** | Edge init; deprecate slider |
| 2 Visual control safeguard | `inference_loop.py`, manager scoring | BT camera v1; v2 contract **draft** | Edge loop; drift tier on server |
| 3 Oculomotor kinematics | `saccade_analyzer.py` | None | Full edge module + contract fields |
| 4 Edge storage | `storage_manager.py` | None on device | Pi partition + vault ack API |
| 5 Plain-English triage | narrative + manager scoring | Tiering only | Narrative module + capsule UI |
| 6 Silent trial | `operational_policy.py` | Contract flag only | Edge policy implementation |

**Important:** Today's `frms-engine/` is a **Railway-hosted TPMA microservice** (15-min diary blocks), not the Pi edge stack. Scope V3 assumes a **separate edge codebase** plus extensions to server contracts in this repo.

---

## 7. Recommended implementation phases

### Phase 0 — Contracts (server, no edge hardware)

**Draft complete:** [schemas/README.md](./schemas/README.md)

1. ~~Core schemas (v2 packet, session init, evidence capsule, vault ack)~~ — done; TypeScript validators in `app-next/src/lib/circadia-contracts/`.
2. **V3 extension** — optional oculomotor fields + trigger types on existing schemas (no `schema_version` bump).
3. Add `evidence-capsule-narrative.ts` stub with plain-English templates (Engine 5).
4. Document deprecation path for `alertness_level` 1–5 in TPMA when `EDGE_GATE_AUTHORITATIVE` ships.

### Phase 1 — Edge scaffold (Pi, separate repo)

1. `initialization.py`, `inference_loop.py`, **`saccade_analyzer.py`**, `storage_manager.py`, `operational_policy.py`.
2. Hailo face mesh + 940 nm marker + I-VT saccade pipeline prototypes.
3. Local haptic relay behind `SILENT_OBSERVATION_MODE`.

### Phase 2 — Server ingest

1. `/api/edge/v1/*` routes + vault ack handshake.
2. Manager dual-layer UI for capsule review (Engine 5).
3. Extend `manager-risk-scoring` with drift anomaly + oculomotor tier inputs.

### Phase 3 — Deprecation & cutover

1. Remove self-report bump from `math_engine.py` when fleet on edge gate.
2. Hide/remove day-card alertness slider (feature flag).
3. Fleet silent observation → active intervention policy flip per tenant.

---

## 8. Formula & engine preservation (Boundary B)

Scope V3 does **not** replace existing compliance or prospective risk math. Edge telemetry **feeds** assurance layers:

```
Edge 100 FPS → saccade_analyzer + inference_loop → 15-min aggregates
                                        ↓
                    CameraRiskPacketV2 / EvidenceCapsuleV1
                                        ↓
                    risk-block-ingest + manager-risk-timeline (or TPMA)
                                        ↓
                    manager-risk-scoring + narrative (Engines 5–6)

Diary events → 1440-min grids → compliance.ts (unchanged statutory path)
                              → risk-register.ts (unchanged prospective path)
```

**Process S baseline 0.0** after fit-for-work ack applies to **edge-authoritative TPMA session**, not retroactive diary compliance state.

**Cognitive tunneling** (Engine 3) may inject an independent Process S acceleration term on the edge before aggregation — server ingests the effect via packet metrics, not raw saccade traces.

---

## 9. Regulatory & product guardrails

| Claim | Allowed when |
|-------|----------------|
| WA Reg 184E compliance on attested record | `compliance.ts` + signed diary |
| FRMS biological assurance | Edge + TPMA + manager timeline |
| FAEyeTON / DEMoNS-aligned oculomotor metrics | Engine 3 shipped + validated against fleet baselines |
| Replacing subjective self-report with objective telemetry | After Engine 1 shipped + fleet policy |
| NHVR FRMSc / approved EWD | **Not claimed** without separate certification |

Fit-for-work **checkbox** is a statutory acknowledgement UX — legal review required before production wording.

---

## 10. Document history

| Date | Change |
|------|--------|
| 2026-07-09 | Scope V2 ingested (CIRCADIA-SCOPE-V2-2026); five engines |
| 2026-07-09 | Scope V3 ingested (CIRCADIA-SCOPE-V3-2026); **Engine 3 oculomotor** added; storage/triage/silent renumbered to 4–6; contracts Phase 0 drafted |
