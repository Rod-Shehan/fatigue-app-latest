# Circadia edge ↔ server contracts

**Status:** Draft v1 — contract-first parallel development (Pi + Manager/Command)  
**Document ref:** CIRCADIA-CONTRACTS-2026  
**Parent spec:** [circadia-frms-scope-v3-2026.md](../circadia-frms-scope-v3-2026.md) (supersedes [V2](../circadia-frms-scope-v2-2026.md))

These schemas are the **single source of truth** for payloads that cross Boundary A (Pi edge) and Boundary B (`app-next` / Neon). The Pi project and this repo must implement against the same versions.

## Versioning rules

1. **Never** remove or rename fields in a published version — add optional fields or bump `schema_version`.
2. Server **rejects** unknown `schema_version` with `400` + `ERR_UNSUPPORTED_SCHEMA`.
3. Pi CI and server CI both run `node scripts/validate-circadia-contracts.mjs` against golden fixtures.
4. Compliance **1440-minute grids** are server-only — not in edge schemas.

## Schema index

| Schema | File | Direction | Cadence |
|--------|------|-----------|---------|
| Camera risk block | [camera-risk-packet-v2.schema.json](./camera-risk-packet-v2.schema.json) | Edge → server | Every 15 min |
| Edge session init | [edge-session-init-v1.schema.json](./edge-session-init-v1.schema.json) | Edge → server | Once per shift start |
| Evidence capsule | [evidence-capsule-v1.schema.json](./evidence-capsule-v1.schema.json) | Edge → server | On milestone / dispute |
| Vault ack | [vault-ack-v1.schema.json](./vault-ack-v1.schema.json) | Server → edge | After capsule stored |

**Legacy (shipped):** Camera v1 — `app-next/src/lib/camera-risk-packet.ts`. v2 is a superset; server accepts both during transition.

## Golden fixtures

| Fixture | Purpose |
|---------|---------|
| [fixtures/camera-block-v2-normal.json](./fixtures/camera-block-v2-normal.json) | Healthy 15-min block |
| [fixtures/camera-block-v2-drift-anomaly.json](./fixtures/camera-block-v2-drift-anomaly.json) | Engine 2 unintended drift |
| [fixtures/camera-block-v2-suspect-pre-fatigue.json](./fixtures/camera-block-v2-suspect-pre-fatigue.json) | Engine 1 enrollment fail |
| [fixtures/camera-block-v2-cognitive-tunneling.json](./fixtures/camera-block-v2-cognitive-tunneling.json) | Engine 3 cognitive tunneling |
| [fixtures/edge-session-init-v1-acknowledged.json](./fixtures/edge-session-init-v1-acknowledged.json) | Fit-for-work + enrollment |
| [fixtures/evidence-capsule-v1-drift-anomaly.json](./fixtures/evidence-capsule-v1-drift-anomaly.json) | Vault capsule with narratives |
| [fixtures/evidence-capsule-v1-silent-observation.json](./fixtures/evidence-capsule-v1-silent-observation.json) | Engine 5 silent mode |
| [fixtures/vault-ack-v1-success.json](./fixtures/vault-ack-v1-success.json) | Server ack for vault delete |

## V3 Engine 3 oculomotor extensions

Scope V3 adds **Engine 3 — Advanced oculomotor & head kinematics** (`saccade_analyzer.py` on Pi). These fields are **optional** on existing schemas (no `schema_version` bump):

| Location | New fields / values |
|----------|---------------------|
| `camera-risk-packet-v2` metrics | `gaze_shift_velocity_mean`, `fixation_duration_max_seconds`, `head_yaw_velocity_mean`, `inter_movement_latency_mean_ms`, `saccade_peak_velocity_ratio_vs_baseline` |
| `camera-risk-packet-v2` flags | `main_sequence_decoupling`, `cognitive_tunneling`, `nodding_micro_sleep` |
| `evidence-capsule-v1` triggers | `cognitive_tunneling`, `main_sequence_decoupling`, `nodding_micro_sleep` |
| `evidence-capsule-v1` summary_metrics | `fixation_duration_max_seconds`, `saccade_peak_velocity_ratio_vs_baseline`, `head_yaw_velocity_mean` |

**Thresholds (edge logic, server validates consistency):**

- Main sequence decoupling: `saccade_peak_velocity_ratio_vs_baseline` < **0.70** (30% drop) with stable amplitude
- Cognitive tunneling: `fixation_duration_max_seconds` > **3.5** + reduced `head_yaw_velocity_mean`
- Nodding micro-sleep: `nodding_micro_sleep` flag → vault capsule with trigger `nodding_micro_sleep`

Golden fixture (optional): `fixtures/camera-block-v2-cognitive-tunneling.json` — Engine 3 cognitive tunneling block.

## Planned HTTP surface (server — not implemented yet)

| Method | Path | Body schema |
|--------|------|-------------|
| POST | `/api/edge/v1/session-init` | `edge-session-init-v1` |
| POST | `/api/edge/v1/risk-blocks` | `{ blocks: [{ upload_id, block_start_ms, camera: camera-risk-packet-v2 }] }` |
| POST | `/api/edge/v1/evidence-capsules` | `evidence-capsule-v1` |
| POST | `/api/edge/v1/evidence-capsules/{capsule_id}/complete` | (empty) → `vault-ack-v1` |

Auth: device credential or driver session — TBD in security review. Mock uplink for Manager dev: `app-next/scripts/simulate-edge-uplink.mjs` (fixtures only).

## Feature flags (coordinate Pi + server)

| Flag | Edge | Server |
|------|------|--------|
| `SILENT_OBSERVATION_MODE` | Suppress haptic/audio | Suppress driver-facing alerts from edge events |
| `CAMERA_PACKET_V2` | Emit schema_version 2 | Parse v2 metrics + flags |
| `EDGE_GATE_AUTHORITATIVE` | Fit-for-work init required | Deprecate TPMA self-report bump |
| `EVIDENCE_VAULT_ENABLED` | Write `/mnt/circadia_ssd/evidence` | Store + return vault ack |

## Command lifecycle bridge (downstream)

High-severity edge events may promote to Command triage via existing `edge_fatigue_events` + lifecycle trigger. Contract enum `promote_to_command` on evidence capsule (optional server-side).

| `trigger_type` | Suggested Command metric |
|----------------|--------------------------|
| `drift_anomaly` | `DISTRACTION` or fleet-specific |
| `fatigue_milestone` | `FATIGUE` |
| `suspect_pre_fatigue` | (assurance only — no Command promote by default) |
| `cognitive_tunneling` | `FATIGUE` (assurance) |
| `main_sequence_decoupling` | `FATIGUE` |
| `nodding_micro_sleep` | `FATIGUE` (high severity) |

## Validation

```bash
# From repo root
node scripts/validate-circadia-contracts.mjs

# Server unit tests (fixtures)
cd app-next && npx vitest run src/lib/circadia-contracts/circadia-contracts.test.ts
```

## Pi project integration

Copy or submodule `docs/architecture/schemas/` into the Pi repo. Edge encoders must produce JSON that passes fixture validation before uplink integration tests.

## TypeScript implementation

`app-next/src/lib/circadia-contracts/` — validators mirroring these schemas (v2 ingest not wired to production routes until feature flag on).
