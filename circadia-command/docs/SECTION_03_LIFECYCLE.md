# Section 3 — Incident lifecycle state machine

WAHVA/NHVR compliance requires an immutable chronological record.

> **Real-time fatigue path (2026-06-29):** See [incident-routing-assembly.md](../../app-next/docs/architecture/incident-routing-assembly.md) **§3.5** — shift, **claim**, **confirm → action → close**, handover timeline. That path **supersedes** the optional **`MANAGER_VALIDATION_PENDING`** approval gate for new builds. Legacy `enforce_manager_gate` remains in DB for older contracts only.

## State transition matrix (legacy + target)

### Real-time path (§3.5 — preferred for fatigue/distraction)

| Step | Actor | Audit |
|------|-------|-------|
| Open / `PENDING_TRIAGE` | — | Ingest |
| Viewed | On-shift manager or operator | `viewed_at`, actor |
| Claimed | On-shift manager or operator | `claimed_by`, mutex |
| Confirmed / Not confirmed | Claimer | outcome |
| Action(s) or no action | Claimer | `incident_action_log` |
| `CLOSED` | Claimer or system | `closed_at` |

### Legacy matrix (manager gate — do not use for new MTS real-time)

Optional **`MANAGER_VALIDATION_PENDING`** when `tenant_compliance_policy_overrides.enforce_manager_gate` is true:

| Initial state | Target state | Actor | Side effect |
|---------------|--------------|-------|-------------|
| `PENDING_TRIAGE` | `VERIFIED_FALSE_POSITIVE` | Command operator | Dismiss; log AI false-positive signature |
| `PENDING_TRIAGE` | `VERIFIED_TRUE_FATIGUE` | Command operator | Escalate; if manager gate on → `MANAGER_VALIDATION_PENDING`, else auto → `INTERVENTION_SENT` |
| `MANAGER_VALIDATION_PENDING` | `INTERVENTION_SENT` | Fleet manager | Authorize in-cab lockout |
| `MANAGER_VALIDATION_PENDING` | `VERIFIED_FALSE_POSITIVE` | Fleet manager | Supervisor dismissal (if `allow_manager_override_dismissal`) |
| `VERIFIED_TRUE_FATIGUE` | `INTERVENTION_SENT` | System | Automated pipeline when manager gate off |
| `INTERVENTION_SENT` | `DRIVER_ACKNOWLEDGED` | Driver HUD | SOP safe haven; 15-min FFW countdown |
| `INTERVENTION_SENT` | `DRIVER_DISPUTED` | Driver HUD | Emergency push to fleet supervisor |
| `DRIVER_ACKNOWLEDGED` \| `DRIVER_DISPUTED` | `CLOSED` | System / manager | Audit lock; freeze asset logs |

## Status enum (DB CHECK)

`PENDING_TRIAGE` · `VERIFIED_FALSE_POSITIVE` · `VERIFIED_TRUE_FATIGUE` · `MANAGER_VALIDATION_PENDING` · `INTERVENTION_SENT` · `DRIVER_ACKNOWLEDGED` · `DRIVER_DISPUTED` · `CLOSED`

## Schema

- `tenant_compliance_policy_overrides` — per-tenant `enforce_manager_gate`, `allow_manager_override_dismissal`
- Migration: `prisma/sql/001_command_lifecycle.sql` (greenfield) or `002_section3_state_machine.sql` (upgrade)

## Boundary note

Fleet manager and driver HUD transitions imply **customer-app touchpoints** (Section 10). Those must be **isolated API routes** — not changes to existing driver/manager/owner UI flows. Spec Sections 4–11 still required to define how.

## Not yet specified (from Gemini)

- Idempotency rules per transition
- Immutable audit append-only ledger table (mentioned in prose, no DDL)
- Transition authorization matrix in API layer
