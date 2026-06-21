# Camera risk stream (15-minute blocks)

## Purpose

Cab **camera edge device** sends **JSON over Bluetooth** to the driver app. The app queues blocks during cellular blackspots and **POSTs batches** to the server. Blocks fuse **camera metrics + optional diary context** into the manager **risk-at-a-glance** timeline (assurance only — not compliance).

## Data flow

```text
Camera (BT JSON) → driver app queue (localStorage) → POST /api/driver/risk-blocks
                                                          ↓
                                              DriverRiskBlock (Postgres)
                                                          ↓
                                    GET /api/manager/risk-timeline?driverName=
                                                          ↓
                                    ManagerRiskTimelineDashboard
```

## Packet schema (v1)

See `src/lib/camera-risk-packet.ts` — `CameraRiskPacketV1`:

- `schema_version: 1`
- `packet_id`, `device_id`
- `block_start` (ISO timestamp, Perth-aligned)
- `block_minutes: 15`
- `metrics`: drowsiness, distraction, eyes-off-road, yawns, coverage, etc.

Validate with `parseCameraRiskPacket()` on device and server.

## Idempotency

Each upload includes client `upload_id` (UUID). Server unique key: `(userId, uploadId)`. Safe to **replay flush** after WA blackspots.

## Scoring

`compositeFatigueIndex()` in `manager-risk-timeline.ts` fuses **time-on-task carry (sawtooth with break recovery)** + diary + camera → z-score → logistic 0–100%. See [fatigue-risk-sawtooth-model.md](./fatigue-risk-sawtooth-model.md). Camera term uses coverage-weighted drowsiness/distraction/eyes-off.

## Driver client

- `getCameraRiskQueue()` — enqueue BT packets
- `flushCameraRiskQueue()` — batch upload when online
- `createCameraBtBridgeStub()` — replace with Web Bluetooth / native SDK

## Product guardrails

- **Not** compliance violations
- **Not** fleet aggregate scores
- **Not** NHVR biomathematical FRMS
- Provenance stored: `fusionSources: ["camera", "diary"]`

## Related

- [incident-routing-assembly.md](./incident-routing-assembly.md) — tenant routing M1–M4; §5c dual ingest (this packet + Streamax)
- [ADR 0003](./adr/0003-prospective-risk-engine.md) — assurance vs compliance
- `src/lib/manager-risk-timeline.ts` — chart scoring
- `src/components/manager/ManagerRiskTimelineDashboard.tsx` — UI

## DB

Run `npm run db:push` after pulling schema changes (`DriverRiskBlock` model).
