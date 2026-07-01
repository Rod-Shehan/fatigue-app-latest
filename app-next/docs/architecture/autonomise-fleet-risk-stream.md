# Autonomise fleet risk stream (proposed)

**Status:** Proposed — **not implemented**. Captured for future product and integration planning.

**Last updated:** 2026-06

**Related:**

- [incident-routing-assembly.md](./incident-routing-assembly.md) — three pipelines (A/B/C); this extends **B — Assurance**
- [autonomise-webhook-pilot.md](./autonomise-webhook-pilot.md) — MTS webhook ingest (live)
- [camera-risk-stream.md](./camera-risk-stream.md) — Circadia cab-camera BT → `DriverRiskBlock` (driver axis)
- [ADR 0003](../adr/0003-prospective-risk-engine.md) — assurance vs compliance boundary

---

## 1. Purpose

Offer a **parallel assurance risk view** on the manager **Risk analysis** page (`/manager`) that is driven entirely by **Autonomise in-cab events**, without requiring fatigue-sheet attribution or TPMA diary context.

This is a potential **market opening** for Circadia when the product is **ported or packaged for Autonomise.ai fleets**: customers already have camera events and VRNs in Autonomise; they may not yet have driver attested work diaries in Circadia. A fleet-native heatmap lets managers see **camera exposure by vehicle** alongside (not instead of) the existing **driver + sheet + TPMA** timeline.

**Principle:** Same manager surface, **two independent scoring paths** — do not merge Autonomise % into TPMA `combinedPct` by default.

---

## 2. What we are not doing (rejected path)

**Sheet-duty auto attribution** (`autonomise-sheet-attribution.ts` → `DriverRiskBlock`) matches Autonomise VRN + trigger time to **attested sheet duty** (rego on day card + work minutes in the 15-min block). That path is appropriate for **optional pilot fusion** into a *named driver's* timeline when sheets are reliable; it is **not** the right primary model for an Autonomise-first fleet product.

For this proposal:

- Do **not** require sheets, `Driver` roster match, or login `userId` to show fleet camera risk.
- Do **not** treat Autonomise `driverName` from webhooks as ground truth without a separate policy decision.
- Do **not** fold camera scores into compliance (Pipeline **A**) or incident acceptance (Pipeline **C**).

See [autonomise-webhook-pilot.md](./autonomise-webhook-pilot.md) § Metrics bridge for the existing **optional** sheet-duty bridge (`AUTONOMISE_BLOCK_BRIDGE_ENABLED`) — distinct from this proposal.

---

## 3. Placement in the three pipelines

| Pipeline | This proposal | Existing manager risk (today) |
|----------|---------------|-------------------------------|
| **A — Compliance** | Unchanged | Sheets + `compliance.ts` |
| **B — Assurance** | **New stream:** Autonomise events → fleet blocks **by VRN/device** | Sheets + TPMA/FRMS + optional `DriverRiskBlock` **by driver name** |
| **C — Incident lifecycle** | Unchanged (triage on `/manager/alerts`, Command) | Same |

Pipeline **C** answers “was this event reviewed and actioned?” Pipeline **B** answers “what did the camera system flag over time?” — coaching and glance only.

---

## 4. Data flow (target)

```text
Autonomise Event webhook
        ↓
AutonomiseWebhookIngest (existing)
        ↓
Autonomise fleet scorer (new — rego/device axis)
        ↓
AutonomiseFleetRiskBlock (new table(s), 15-min grid)
        ↓
GET /api/manager/autonomise-fleet-risk-timeline (new)
        ↓
Manager risk section — parallel panel (new UI)
```

**Ingest** stays as today. **Scoring** and **storage** are a new domain. **UI** sits next to `ManagerFleetRiskPulse` / `ManagerRiskTimelineDashboard`, not replacing them.

Same Postgres instance is fine — “separate” means **separate tables, APIs, and scorer**, not a second database server.

---

## 5. Entity axis and scope

| Dimension | Driver timeline (existing) | Autonomise fleet stream (proposed) |
|-----------|----------------------------|----------------------------------|
| **Row key** | Driver name (from sheets) | Vehicle registration (VRN) or device id |
| **Time scope** | Regulatory work week (`weekStarting`) | Event-time window (calendar range; may reuse week picker as filter only) |
| **Inputs** | Sheet events, minute grids, TPMA/FRMS | Accepted Autonomise fatigue/distraction (and configured ADAS proxy) events |
| **Provenance** | `FrmsRiskSnapshot`, `DriverRiskBlock` | `AutonomiseWebhookIngest` ids per block |

When Autonomise omits VRN, bucket under **device hardware id** or existing placeholder (`UNKNOWN` / `TRIAGE_QUEUE_PLACEHOLDER_REGO` pattern from lifecycle bridge) — show clearly as “unassigned vehicle” in UI.

---

## 6. Scoring (lightweight, dedicated)

No TPMA / `frms-engine` required for v1.

1. Align `triggerTime` to **15-minute blocks** (same grid as `RISK_BLOCK_MINUTES`).
2. Group by normalized VRN (reuse `regoKey` normalization).
3. Classify alarm via `fatigue-event-catalogue.ts` → fatigue vs distraction counts.
4. Derive block features → 0–100% assurance score (starting point: count-based decay in `autonomise-block-bridge.ts` `syntheticFeaturesFromCounts` — extract to a fleet-only module when built).
5. Store ingest id list on each block for audit.

**Empty block** = no data / no coverage — not “zero risk green”.

Optional later: event **bundle/correlate** layer (rego + rearm window) before aggregation — see incident ingest discussions; belongs in scorer, not primary ingest filter.

---

## 7. Proposed storage (sketch)

Illustrative model names — implement when approved:

```prisma
/// 15-min Autonomise camera assurance per vehicle (not driver).
model AutonomiseFleetRiskBlock {
  id                   String   @id @default(cuid())
  vehicleRegoKey       String   // normalized VRN or device fallback key
  deviceId             String?
  blockStartMs         BigInt
  blockMinutes         Int      @default(15)
  fatigueEventCount    Int      @default(0)
  distractionEventCount Int     @default(0)
  livePct              Int
  features             Json?
  sourceIngestIds      String[] @default([])
  computedAt           DateTime @updatedAt

  @@unique([vehicleRegoKey, blockStartMs])
  @@index([blockStartMs])
}
```

Optional later: `AutonomiseFleetVehicle` for display aliases (fleet labels, VRN spelling variants) — **not** required for v1 scoring.

---

## 8. Manager UI (parallel display)

On `/manager` → **Risk analysis** section:

| Panel | Source | Axis |
|-------|--------|------|
| **Driver fatigue profile** (existing) | Sheets + FRMS/TPMA | Driver name |
| **Autonomise fleet exposure** (new) | Autonomise fleet API | VRN / device |

UX options (pick one at build time):

- **Stacked cards** — both visible; no mode switch.
- **Toggle** — “View by: Driver | Vehicle (Autonomise)”.

Copy boundaries (required):

- Driver panel: based on **attested work diary + prospective model**.
- Autonomise panel: based on **in-cab camera events** — not attested work time; may not match the driver on the sheet.

Optional v2: click VRN → deep-link to `/manager/alerts` filtered by that registration.

---

## 9. Product and market notes

**Autonomise-first fleets** may buy:

1. **Pipeline C** — live alert desk (`/manager/alerts`, Command) — *in progress / pilot*.
2. **Pipeline B (this doc)** — fleet heatmap from events they already generate — *proposed*.
3. **Pipeline A** — WA fatigue record compliance — *upsell when drivers adopt Circadia sheets*.

Positioning: Circadia as **assurance + compliance layer** on top of Autonomise telematics/camera, not a replacement for Autonomise event generation. The parallel UI makes that legible: camera truth on one strip, diary/TPMA truth on another.

**Guardrails** (same as [camera-risk-stream.md](./camera-risk-stream.md)):

- Not compliance violations
- Not NHVR biomathematical FRMS certification
- Not legal evidence of hours worked
- Coaching, prioritisation, and conversation starters only

---

## 10. Suggested build order (when approved)

1. Schema + SQL migration for `AutonomiseFleetRiskBlock`
2. Fleet scorer module + hook on accepted event ingest (or async recompute job)
3. `GET /api/manager/autonomise-fleet-risk-timeline`
4. UI component (adapt from `ManagerFleetRiskPulse` — rego rows instead of driver rows)
5. Wire into `/manager` risk section + disclaimer copy
6. Backfill job from historical `AutonomiseWebhookIngest`
7. Deprecate or keep off the sheet-duty `AUTONOMISE_BLOCK_BRIDGE` pilot — product decision

**Open decisions for v1:**

- Heatmap by **rego only**, or rego + single-vehicle drill-down timeline?
- Default time window (rolling 7d vs aligned to manager week picker)?
- Tenant flag: `AUTONOMISE_FLEET_RISK_ENABLED`?

---

## 11. References in code (today)

| Area | File | Relevance |
|------|------|-----------|
| Webhook capture | `AutonomiseWebhookIngest` | Source events |
| Field extract | `autonomise-payload.ts` | VRN, triggerTime, alarm id |
| Alarm taxonomy | `fatigue-event-catalogue.ts` | Fatigue vs distraction |
| Sheet-duty bridge (pilot) | `autonomise-block-bridge.ts`, `autonomise-sheet-attribution.ts` | **Different path** — driver fusion |
| Manager fleet UI | `ManagerFleetRiskPulse.tsx`, `fleet-risk-timeline.ts` | Template for parallel panel |
| Incident triage | `edge_fatigue_events`, `/manager/alerts` | Pipeline C — stays separate |

---

## 12. Approval gate

Implementation requires explicit owner approval for:

- New assurance scoring formula (even if lightweight)
- Manager UI copy and dual-panel layout
- Whether to retire the sheet-duty metrics bridge in favour of this stream

Until then, this document is the **reference architecture** only.
