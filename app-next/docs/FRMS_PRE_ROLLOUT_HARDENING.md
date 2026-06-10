# FRMS record hardening — before customer rollout

Status: **TODO — review before first paying customer.**

The TPMA risk pipeline (`FrmsProfileRun` / `FrmsRiskSnapshot`) is the historical
record behind the manager risk charts. Scores are computed once by the Python
engine, persisted to Neon, and served from those rows — never recomputed at
render time. This document tracks the remaining gaps between "persisted" and
"audit-grade".

## Current guarantees (as of 2026-06)

- Every computation writes a `FrmsProfileRun` row: `inputHash`, `engineVersion`,
  `modelVersion`, `requestedAt`, `completedAt`, status.
- Every 15-minute block score is stored in `FrmsRiskSnapshot`
  (`processSPct`, `processCPct`, `combinedPct`, `band`).
- Diary changes produce a **new** run (new `inputHash`); old runs and snapshots
  are retained — full input→output history.
- Snapshot writes are **append-only**: `createMany` with `skipDuplicates`, no
  `deleteMany`. A retry of the same run can only fill missing blocks, never
  rewrite existing rows (engine is deterministic for a given hash).

## Hardening TODO before customer rollout

1. **DB-level immutability** — application code is append-only, but nothing
   stops a raw SQL `UPDATE`/`DELETE`. Add a Postgres trigger (or revoke
   UPDATE/DELETE from the app role) on `FrmsRiskSnapshot` and completed
   `FrmsProfileRun` rows.
2. **Cascade delete review** — `FrmsRiskSnapshot.run` has `onDelete: Cascade`.
   Deleting a run silently deletes its score history. Decide: forbid run
   deletion, or archive snapshots first.
3. **Retention policy** — runs are currently kept forever (good for records,
   unmanaged for cost). Define retention aligned with WA record-keeping
   obligations (see `docs/regulatory/wa-commercial-vehicle-hours.md`) before
   pruning anything.
4. **Legacy/demo fallback in production** — when no FRMS run exists, the chart
   falls back to the on-the-fly sawtooth (or client demo preview). Neither
   leaves a score record. Consider suppressing fallback in production so only
   persisted TPMA scores ever display to customers.
5. **`failed` run rows** — keep them (they record that inputs X failed at time
   T), but add alerting so failures are noticed, not just stored.
6. **Engine version bumps** — when `frms-engine` maths changes, bump
   `FRMS_ENGINE_VERSION` so old snapshots stay attributable to the engine that
   produced them. Never reuse a version string after maths changes.
