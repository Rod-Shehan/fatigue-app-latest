# Australia-wide transition (engineering checklist)

This document supports **ADR 0001** (`docs/adr/0001-multi-jurisdiction-fatigue-architecture.md`). It does **not** authorise UI redesigns without product approval.

## Principles

1. **Canonical events** remain the source of truth; **aggregated day views** stay simple quick-view components.  
2. **New jurisdictions / rule sets** ship as **modules** (or clearly named files), not ad-hoc branches in UI.  
3. **NHVR EWD**: do **not** claim approved-EWD status in app copy or store listings until a deliberate certification decision.

## Phased work (suggested)

| Phase | Scope | UI impact |
|-------|--------|-----------|
| **A (current)** | ADR + `src/lib/jurisdiction/` types; comment cross-links in `compliance.ts` | None |
| **B** | `getComplianceEngine()` / `waOsh3132Engine` — WA delegates to `runComplianceChecks`; **API routes** use the engine (**S8** complete, `docs/roadmap/approval-gates.md`) | None unless agreed |
| **C (partial)** | **Sheet-level** jurisdiction (`jurisdictionCode` + header **Fatigue rules** selector) | Org/driver defaults deferred |
| **D (S5)** | **NHVR provisional** (`NHVR_PROVISIONAL`) behind env flags — WA math + non-EWD warning; see `docs/architecture/nhvr-provisional-pack.md` | Extra dropdown row when enabled |
| **E** | Officer/export enhancements (PDF, read-only summary) | Copy/layout **requires approval** if “fundamental” |

## Explicit approval required before

- Changing **LogBar**, **day card** layout, **sheet header** patterns, or **manager workbench** section structure.  
- Replacing **quick-view** time grids with denser views **as the default** experience.  
- Any in-app claim of **EWD approval** or **interstate legal sufficiency** without legal review.

## Files to watch

- `src/lib/compliance.ts` — WA engine (to be wrapped / split per phase B+).  
- `src/lib/jurisdiction/` — identifiers, `getComplianceEngine()` (WA only until more packs land).  
- `src/components/fatigue/*` — **approval-gated** for structural changes.

## References

- `docs/adr/0001-multi-jurisdiction-fatigue-architecture.md`  
- `docs/roadmap/approval-gates.md` — **step-by-step approvals** for major work  
- `docs/product/positioning.md` — approved positioning (**S1**)  
- `docs/architecture/event-model.md` — events vs aggregated displays (**S3**)  
- `docs/architecture/nhvr-provisional-pack.md` — NHVR provisional pack (**S5**)  
- `src/lib/jurisdiction/compliance-engine.ts` — Phase B entry point
