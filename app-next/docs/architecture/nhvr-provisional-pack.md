# NHVR provisional pack (S5)

**Status:** Optional, **feature-flagged**. Not an NHVR-approved Electronic Work Diary (EWD).

## Behaviour

- Code: `NHVR_PROVISIONAL` (`src/lib/jurisdiction/nhvr-provisional-engine.ts`).
- **Compliance math** matches **WA OSH Reg 3.132** via `runComplianceChecks` until dedicated NHVR/BFM logic exists.
- Every compliance run **prepends** a **warning** on day `"Sheet"` stating the pack is provisional and not a certified EWD.

## Enabling

Set **either** (or both) to `"true"`:

| Variable | Where |
|----------|--------|
| `NEXT_PUBLIC_NHVR_PROVISIONAL_RULES_ENABLED` | Client: shows **NHVR BFM (provisional)** in the sheet **Fatigue rules** dropdown. |
| `NHVR_PROVISIONAL_RULES_ENABLED` | Server/API: accepts `jurisdictionCode` / `NHVR_PROVISIONAL` from DB and clients. |

If flags are **off**, stored `NHVR_PROVISIONAL` in the database is **coerced to WA** in API responses and compliance (see `parseJurisdictionCode`).

## Related

- `docs/product/positioning.md` — EWD disclaimer  
- `docs/roadmap/approval-gates.md` — S5
