# ADR 0001: Multi-jurisdiction fatigue architecture & EWD positioning

## Status

**Accepted** — 2026-03-18

## Context

- The product is expanding toward **Australia-wide** operation, including **NHVR**-relevant contexts in the future.
- **WA OSH (General) Regulations 2022 — Reg 3.132** is the current implemented rule set (`src/lib/compliance.ts`).
- **NHVR Electronic Work Diary (EWD)** approval is a **separate regulatory process**; it must not be implied by code structure alone.
- Stakeholders require **future-proof layering** (canonical events, pluggable rule engines, clear compliance outputs) **without** mandating certification work now.
- **Fundamental driver/manager UI** (quick day views, LogBar, workbench layout) must remain **stable** unless **explicitly approved** — see `.cursor/rules/fatigue-ui-approval.mdc`.

## Decision

1. **Layered model (target architecture)**  
   - **Canonical timeline**: append-only **events** with precise timestamps (foundation for 1-minute accounting without replacing simple aggregated views).  
   - **Jurisdiction / rule engine**: **pluggable** modules (WA today; NHVR/HVNL/BFM/AFM or other packs later). Same events in; rule set determines violations/warnings.  
   - **Presentation**: **simple day / quick views** remain **aggregated** views derived from events — not the only source of truth.  
   - **Compliance output**: structured results + exports; can evolve toward officer-style summaries independently of logging UX.

2. **Regulatory positioning (until explicitly changed)**  
   - The app is **not** represented as an **NHVR-approved EWD** unless and until a separate decision and certification path is completed.  
   - Marketing, in-app labelling, and help copy must stay aligned with this (honest jurisdiction scope).

3. **Implementation approach**  
   - Introduce **jurisdiction identifiers and scaffolding** (`src/lib/jurisdiction/`) without moving all WA logic out of `compliance.ts` in one step.  
   - Migrate rule logic incrementally behind stable **interfaces**; avoid scattering jurisdiction `if/else` through UI components.

4. **UI change governance**  
   - **No fundamental UI redesign** (driver sheet, LogBar, day cards, manager workbench tiles, navigation patterns) without **explicit product owner approval**.  
   - Architectural refactors under this ADR may proceed in **logic/data layers** and **non-breaking** API surfaces.

## Consequences

### Positive

- Clear path to **multiple rule packs** and **NHVR-oriented** logic without a monolithic rewrite.  
- **Certification** (EWD or other) can be pursued as a **later gate**, not blocked by lack of forethought now.  
- **Quick-view UX** can stay intact while precision improves at the **event/compliance** layer.

### Negative / trade-offs

- Short term: **duplication risk** if new code paths bypass the layering; reviews should route new compliance through the agreed structure.  
- **Documentation burden**: ADRs and transition notes must stay current as modules split from `compliance.ts`.

## Non-goals (this ADR)

- Obtaining **NHVR EWD approval** or claiming **approved EWD** status.  
- **Redesigning** fundamental UI as part of adopting this ADR.  
- Replacing **30-minute-style quick views** as the default at-a-glance experience without approval.

## References

- `docs/architecture/australia-wide-transition.md` — transition checklist.  
- `src/lib/jurisdiction/` — jurisdiction scaffolding.  
- `src/lib/compliance.ts` — current WA Reg 3.132 implementation.
