# Section 3 — Incident lifecycle state machine

WAHVA/NHVR compliance requires an immutable chronological record. Optional **`MANAGER_VALIDATION_PENDING`** step is controlled per tenant via `tenant_compliance_policy_overrides.enforce_manager_gate`.

## State transition matrix

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
