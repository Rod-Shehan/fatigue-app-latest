# ADR 0004: FRMS Python microservice & persisted risk profiles

## Status

**Proposed** — 2026-06 (`src/lib/frms/build-timeline-payload.ts` implemented)

## Context

- [ADR 0003](./0003-prospective-risk-engine.md) defines prospective risk vs retrospective compliance on one timeline.
- v1 manager assurance uses in-process TypeScript (`risk-register.ts`, `manager-risk-timeline.ts`, `fatigue-risk-carry.ts`) and optional `DriverRiskBlock` camera ingest.
- Product direction requires **biomathematical fatigue models (Process S/C)**, **ML regression** (e.g. XGBoost), and **external time-series enrichment** — too heavy and IP-sensitive for Vercel serverless alone.

## Decision

1. Run the predictive FRMS engine in an **external Python (FastAPI) microservice**.
2. Build a canonical **15-minute time-series payload** in `src/lib/frms/build-timeline-payload.ts` (`timeline_blocks` + SHA256 `inputHash`) from historical/prospective sheet weeks before calling Python.
3. Orchestrate from **Next.js Route Handlers** only (no Server Actions); central module `src/lib/frms/orchestrator.ts` (pending).
3. Persist outputs in Neon as **`FrmsProfileRun`** + **`FrmsRiskSnapshot`** (deduped by `inputHash`); keep **`DriverRiskBlock`** for raw camera provenance.
4. Serve reads **cache-first** (`GET /api/manager/compliance`, `GET /api/manager/risk-timeline`); recompute **async** via `POST /api/internal/frms/recompute`.
5. Feature flag **`FRMS_ENGINE`**: `legacy` → `hybrid` → `python`; compliance math unchanged.

## Consequences

- New env vars: `FRMS_PYTHON_URL`, `FRMS_PYTHON_API_KEY`, `FRMS_INTERNAL_SECRET`, `FRMS_ENGINE`.
- Vercel Pro `maxDuration` and/or queue (QStash/Inngest) for long-running fleet recomputes.
- Full implementation plan and boilerplate: **[FRMS Python integration](../architecture/frms-python-integration.md)**.

## Related

- [0003](./0003-prospective-risk-engine.md) — compliance vs risk
- [camera-risk-stream](../architecture/camera-risk-stream.md) — `DriverRiskBlock`
- [fatigue-risk-sawtooth-model](../architecture/fatigue-risk-sawtooth-model.md) — TS v1 glance model
