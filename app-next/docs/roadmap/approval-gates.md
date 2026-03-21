# Roadmap — step-by-step approval

Each **major** item below should be **explicitly approved** (reply in chat or PR: **“Approve: [step id]”**) before implementation proceeds beyond what’s already done.

**Rule:** Fundamental UI changes (LogBar, day cards, manager workbench layout) always need separate approval — see `.cursor/rules/fatigue-ui-approval.mdc`.

| Step ID | Deliverable | Approval gate | Status |
|--------|-------------|----------------|--------|
| **S1** | Product positioning & EWD disclaimer (`docs/product/positioning.md`) | Approve **wording** before public/marketing use | **Approved 2026-03-18** — OK for external use as written |
| **S2** | Compliance engine wrapper (`getComplianceEngine`, WA only) | Approve **continuing** to migrate call sites to wrapper | **Approved 2026-03-18** — wrapper is the app entry point |
| **S3** | Event model doc: events = truth, grids = derived (`docs/architecture/event-model.md`) | Approve before **1‑minute event** / precision work | **Approved 2026-03-18** — principles locked; UI changes still need `.cursor/rules/fatigue-ui-approval.mdc` |
| **S4** | Jurisdiction selector on **sheet** (`jurisdictionCode` + header UI); compliance uses sheet code | Approve **UI** (done 2026-03-18) | **Done 2026-03-18** — WA only in dropdown; org-level deferred |
| **S5** | NHVR-oriented rule pack (dev/feature-flag) | Approve scope + **no public EWD claim** | **Done 2026-03-18** — `NHVR_PROVISIONAL`; WA math + banner warning; env flags (see `docs/architecture/nhvr-provisional-pack.md`) |
| **S6** | Roadside: PDF summary + optional QR (substance first) | Approve UX + **legal copy** | Not started |
| **S7** | WA CVD medical expiry tracking | Approve **UI pattern** (banner vs settings) | Not started |
| **S8** | Migrate API routes to `getComplianceEngine()` | Approve **S2** migration | **Done 2026-03-18** — `/api/compliance/check`, `/api/manager/compliance` |

## Changelog

| Date | Step | Note |
|------|------|------|
| 2026-03-18 | S1, S2, S3, S8 | User approved positioning, engine migration, event-model principles; API routes use `getComplianceEngine(DEFAULT_JURISDICTION_CODE)`. |
| 2026-03-18 | S4 | Sheet-level `jurisdictionCode` (Prisma), **Fatigue rules** selector on sheet header (WA only); `/api/compliance/check` and manager compliance resolve engine per sheet. |
| 2026-03-18 | S5 | NHVR provisional engine + optional second dropdown entry when `*_NHVR_PROVISIONAL_RULES_ENABLED=true`. |

## How to approve

Reply with one or more lines, e.g.:

- `Approve: S4` — OK to add jurisdiction selector UI (describe scope).  
- `Approve: S7 UI` — use [describe pattern].

Updates to this file should record the date in **Status** or **Changelog** when steps complete.
