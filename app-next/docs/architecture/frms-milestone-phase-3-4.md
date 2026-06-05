# FRMS integration milestone — Phase 3 & 4 (June 2026)

**Status:** Shipped in two commits on `main`  
**Decision record:** [ADR 0004 — FRMS Python microservice](../adr/0004-frms-python-microservice.md)  
**Architecture:** [frms-python-integration.md](./frms-python-integration.md)

This document records a critical juncture: the app moves from TypeScript-only prospective risk to a **hybrid architecture** — Neon-cached FRMS profiles computed by a peer-reviewed Python TPMA engine, orchestrated from Next.js without blocking driver workflows.

---

## Commits

| Commit | Scope | Summary |
|--------|--------|---------|
| `53408ca` | `app-next/` | Phase 3–4 wiring: Prisma cache, orchestrator, internal worker, API hooks |
| `23f60bf` | `frms-engine/` | Production TPMA math engine + FastAPI `/v1/risk-profile` + this record |

---

## What changed

### Next.js (`app-next`) — Phase 3 & 4

| Component | Path | Role |
|-----------|------|------|
| Timeline payload | `src/lib/frms/build-timeline-payload.ts` | Sheet weeks → 15-min `timeline_blocks` + SHA256 hash (Phase 1b, prior) |
| Python client | `src/lib/frms/python-client.ts` | `POST ${FRMS_PYTHON_URL}/v1/risk-profile` with bearer key |
| Orchestrator | `src/lib/frms/orchestrator.ts` | Cache check, `runFrmsAndPersist`, `enqueueFrmsRecompute`, `resolveFrmsProspectiveRegister` |
| Serialize | `src/lib/frms/serialize.ts` | BigInt → string for JSON APIs |
| Internal worker | `src/app/api/internal/frms/recompute/route.ts` | Secured by `FRMS_INTERNAL_SECRET`; loads sheets, calls Python, persists snapshots |
| Compliance API | `src/app/api/manager/compliance/route.ts` | Hybrid `risk_register` when `FRMS_ENGINE ≠ legacy` |
| Sheet API | `src/app/api/sheets/[id]/route.ts` | GET: cached register + status; PATCH: enqueue on `days` change |

### Neon schema

- **`FrmsProfileRun`** — one computation per `(driverName, inputHash, engineVersion)`; stores `prospectiveRegister` JSON and run metadata.
- **`FrmsRiskSnapshot`** — 15-minute profile points (`processSPct`, `processCPct`, `modelPct`, `combinedPct`, `band`).

### Python (`frms-engine/`)

| Component | Path | Role |
|-----------|------|------|
| TPMA engine | `app/math_engine.py` | Three-Process Model (S/C/W) + progressive workload μ; Dawson-Reid bands |
| Schemas | `app/schemas.py` | `TimelineBlock`, `SnapshotResponse`, `ProspectiveRegisterItem` |
| FastAPI | `app/main.py` | `POST /v1/risk-profile`, `GET /health` |
| Tests | `tests/test_math_engine.py` | Work accumulation, rest recovery, prospective-only register |

**Scientific basis (assurance only, not compliance verdicts):**

- Process S / W / C — Åkerstedt & Folkard; Van Dongen et al.
- Two-harmonic circadian — Folkard & Akerstedt (1992)
- Coaching bands — Dawson & Reid (1997); NHVR-facing progressive thresholds at 5.5h / 7h / 10h continuous work

---

## Runtime flow

```
Driver PATCH sheet (days)
  → enqueueFrmsRecompute (fire-and-forget, non-blocking)
  → POST /api/internal/frms/recompute (Bearer FRMS_INTERNAL_SECRET)
      → buildFrmsTimelinePayload + hash
      → cache hit (ready + same hash)? return
      → callFrmsPython → persist FrmsRiskSnapshot[] + prospectiveRegister
Manager GET compliance
  → resolveFrmsProspectiveRegister
      → hash match + ready? serve cache
      → miss/stale? serve last-good if any + enqueue recompute
      → FRMS_ENGINE=legacy? TypeScript buildRiskRegister only
```

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `FRMS_ENGINE` | Vercel | `legacy` (default) \| `hybrid` \| `python` |
| `FRMS_PYTHON_URL` | Vercel | FastAPI base URL |
| `FRMS_PYTHON_API_KEY` | Vercel + Python | Outbound auth to Python |
| `FRMS_INTERNAL_SECRET` | Vercel | Inbound auth on `/api/internal/frms/recompute` |
| `FRMS_PYTHON_API_KEY` | Python host | Validates `/v1/risk-profile` |

**Default `FRMS_ENGINE=legacy`** — production behaviour unchanged until env is flipped.

---

## Deployment checklist

1. **Neon:** `cd app-next && npx prisma db push`
2. **Python:** deploy `frms-engine` (e.g. Railway/Fly/Cloud Run); set `FRMS_PYTHON_API_KEY`
3. **Vercel:** set FRMS env vars; start with `FRMS_ENGINE=hybrid` on staging only
4. **Smoke test:** PATCH a sheet → verify `FrmsProfileRun` pending→ready; GET compliance shows Python `risk_register`
5. **Parity:** compare TS vs Python register on staging before manager glance cutover (Phase 5)

---

## Guardrails (unchanged)

- FRMS outputs are **assurance and coaching** — not automatic violations ([ADR 0003](../adr/0003-prospective-risk-engine.md)).
- Compliance API and `compliance.ts` remain authoritative for attested rule outcomes.
- Driver workflows stay non-blocking; recompute is always async.

---

## Not in this milestone (planned)

- Phase 5: `GET /api/manager/risk-timeline` reads `FrmsRiskSnapshot` (chart from Python)
- Phase 6: Cron/queue for active drivers; callback route for long Python runs
- Phase 7: Retire TS sawtooth for manager glance after parity sign-off
- XGBoost / weather enrichment layer on top of TPMA baseline

---

## Changelog entry (frms-python-integration.md)

| Date | Change |
|------|--------|
| 2026-06 | **Milestone:** Phase 3–4 Next.js wiring + `frms-engine` TPMA shipped; Neon `FrmsProfileRun` / `FrmsRiskSnapshot`; hybrid compliance path behind `FRMS_ENGINE` |
