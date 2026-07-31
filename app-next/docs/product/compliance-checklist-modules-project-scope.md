# Project scope: Compliance checklist modules (FFW / Prestart / Dimension & Load)

**Status:** Phase 0 locked; **Phase 1 code complete** (2026-07-31). Phase 2 not started.  
**Stack:** Circadia24 EWD in **`app-next` (Next.js)** — not React Native / Flutter. PDF work extends the existing week / roadside pipeline (`sheet-jspdf-export`, WorkSafe day tiles, produce PDF), not a separate `PDFEngine.ts` mobile module.  
**Baseline today:** Day cards store three **boolean** ticks (`fitness_for_work`, `dimension_load_checklist`, `daily_vehicle_checklist`) printed on the Weekly Trip Sheet. This project replaces casual ticks with **full signed checklist records** and **shift / load gates**.

**Do not** change AMI / Reg 184E / rolling timeline / coverage engines in this project. Checklist completion must not invent work/break/non-work minutes.

**Related:** `weekly-trip-sheet-pdf-project-scope.md` (paper week chrome + tick strip).

---

## Goal

Three **distinct** fast-interaction compliance forms (not one bundled start-of-day checklist):

1. **Fitness for Work (FFW)** — personal declaration + driver signature.  
2. **Prestart vehicle inspection** — Pass / Fail / N/A groups + defects + driver signature (when this driver is responsible).  
3. **Dimension & Load check** — repeatable post-load form + **driver** signature; **loader** CoR acknowledgment as a **separate legal function** when obtainable.

Forms use Circadia24 tokens, touch-first controls, canvas signatures, and append as supplementary PDF pages in week / 28-day exports behind the relevant day sheet.

---

## CoR / role principles (non-negotiable)

1. **A driver cannot assume another person’s CoR responsibility.** No proxy loader signature, and no driver attestation that “covers” the loader’s duties.  
2. **Driver and loader are two distinct legal functions.** The same natural person may perform both (e.g. driver also loaded), but the product must capture them as **two labelled acknowledgments** (“As driver” / “As loader”), never one merged sign-off.  
3. When loader identity is unknown or the loader is unavailable, the driver completes **driver-only** load checks and may attach **photo evidence**. The PDF must show a visible **gap**: loader CoR acknowledgment not obtained — not a false completion.  
4. **FFW is personal** — each driver who drives (including two-up second) still does their own FFW. Prestart is **role-gated**, not personal fitness.

---

## Phase 0 decisions (locked)

| # | Choice | Meaning |
|---|--------|---------|
| **A** | **A1** | Keep Weekly Trip Sheet Sun–Sat tick rows. A tick means **≥1 completed signed checklist of that type for that day** (never invent ticks). Full checklist pages are the legal detail. |
| **B** | **B1** | Persist full checklist records (typed schema + items + defects + photos + signatures + geo/time). Booleans become derived from completed records. |
| **C** | **C1** | **Shift Start Gate:** requires this driver’s **FFW** + **Prestart when responsible** (see **L**). Lock Start shift / movement unlock until satisfied. Do **not** bundle Dimension & Load into Start shift. |
| **D** | **D1** | **Post-Load Gate:** Dimension & Load is separate; triggered when leaving loading / going in transit **or** on explicit driver “run load check”. **Multiple** completions per shift allowed. |
| **E** | **E1** | **FAIL + unsafe-to-drive** on Prestart (or load, if flagged) **blocks** Start shift / resume transit until resolved per company process. FAIL without unsafe may save with defect + photo. |
| **F** | **F1** | Item UI: **Unselected** default; single tap → **Pass**; explicit **Fail** / **N/A**. Fail opens defect card (text, optional photo; unsafe flag where applicable). FFW uses acknowledge/declare, not Pass/Fail/NA. |
| **G** | **G1** | Every completed checklist ends with canvas signature(s): Clear + Confirm; store base64 PNG + **UTC & AWST** timestamps + lat/lng when available (null if denied). |
| **H** | **H1** | PDF: append completed checklist page(s) **after that day’s WorkSafe day tile** in week export and 28-day produce (before shift-log appendix unless later revised). Brand header Midnight `#0A1118`; defects highlighted `#EF4444`. |
| **I** | **I1** | Brand tokens on checklist modals + checklist PDF pages in v1: Midnight `#0A1118`, Slate `#16222F`, Cobalt `#007AFF` / `#1E88E5`, Emerald `#10B981`, Red `#EF4444`, Steel `#64748B`, Border `#2A3B50`. |
| **J** | **J1 = A+B+C** | **Loader CoR paths** (Dimension & Load): **A** present → loader name + **loader** signature; **B** known but absent → driver-complete / **loader pending** (later capture); **C** unknown/unavailable → **driver-only** + **required photo(s)**; PDF flags loader CoR **not obtained**. **No proxy.** |
| **J2** | **Yes** | Dual function: “Did you also load?” / “I loaded it” → separate **As driver** and **As loader** acknowledgments (two signatures if self-loader). |
| **J3** | **Yes** | Product rule: **No proxy / assumption of another’s CoR responsibility** (enforced in UI copy and validation). |
| **K** | **K1** | Week / 28-day PDF **may** include load checks with **loader pending** or **not obtained (photos)** — must be visually obvious. Week sign-off is **not** blocked solely by pending loader CoR in v1 (revisit if operators require harder lock). |
| **L** | **L1** | Prestart gate: **“Are you responsible for the vehicle prestart this shift?”** Yes → must complete Prestart. No → skip Prestart for this driver; record reason. **Solo** auto-Yes (question hidden). |
| **M** | **M1** | Two-up: both may not leave the vehicle with **no** Prestart on record for that rego/shift — block Start until one responsible Prestart exists (or linked co-driver completion). |
| **N** | **N1** | Second / relief driver: still requires **FFW**; Prestart defaults toward **No** when role is second (editable). |
| **O** | **O1** | Loading / in-transit: if no formal status exists yet, use an **explicit driver action** for post-load gate in v1; optional richer status model later (deferred). |

### Implied rules

- Forms are **three modules**, not one combined checklist.  
- Dimension & Load header metadata (client, loader name when known, driver, truck/trailer rego, load type, weight) captured per completion.  
- Guides (driver + manager) update in the same change as each user-visible gate.  
- Offline: local-first write; sync with existing sheet/day persistence patterns.

---

## Brand tokens (checklist surfaces)

| Token | Hex | Use |
|-------|-----|-----|
| Midnight | `#0A1118` | Primary dark / PDF header |
| Slate | `#16222F` | Cards / containers |
| Cobalt | `#007AFF` / `#1E88E5` | Primary actions / active |
| Emerald | `#10B981` | Pass / compliant |
| Red | `#EF4444` | Fail / defect / unsafe |
| Steel | `#64748B` | Muted text |
| Border | `#2A3B50` | Borders |

---

## Checklist schemas (content authority)

### 1. Fitness for Work (FFW)

- Metadata: driver name, date/time, location.  
- 10 acknowledge/declare points (confidential reporting; physical wellness; medications; drugs/alcohol; D&A testing consent; sleep/fatigue reporting; secondary employment; stress; food/water; external workplace issues) — final wording from company paper / legal review.  
- Sign-off: **driver** digital signature only.

### 2. Prestart vehicle inspection

- Groups (Pass / Fail / N/A): Wheels & tyres; Vision & glass; Lights & reflectors; Structure & fluids; Brakes & air; Engine & coupling; Safety gear — item lists from company paper.  
- Fail → defect text + optional photo + unsafe-to-drive when applicable.  
- Sign-off: **driver** digital signature (when responsible per **L**).

### 3. Dimension & Load

- Header: client, loader name (when known / self), driver, truck rego, trailer rego, load type, load weight.  
- Points (Yes / No / N/A): regulated dimensions or permit; route/RAV; load secured & rated restraints; CoG/stability; dunnage.  
- Sign-off: **driver** mandatory; **loader** per **J** (present / pending / not obtained + photos). Dual function per **J2**.

---

## Phases

### Phase 0 — Decisions — DONE

- [x] Owner lock A–O (this doc), including CoR no-proxy and loader/prestart gates

### Phase 1 — Design system + shared form kit — DONE

- [x] CSS variables for brand tokens (checklist surfaces) — `.checklist-kit` + Tailwind `ck-*`
- [x] 3-state item control + defect card; FFW acknowledge variant
- [x] Canvas signature panel (Clear / Confirm; UTC + AWST + geo)
- [x] Modal shell (mobile-first)
- [x] Unit tests for item state machine (`src/lib/checklist/*.test.ts`)
- [x] Demo / fixture page: `/manager/checklist-kit` (manager session; no persistence)

**Key paths:** `src/lib/checklist/`, `src/components/checklist/`, `src/app/manager/checklist-kit/page.tsx`

### Phase 2 — Data model + API + persistence — NOT STARTED

- [ ] Checklist record schema + Prisma / day JSON + API
- [ ] Photo storage limits; signature blob storage
- [ ] Derive trip-sheet ticks from completed records (A1)
- [ ] Legacy boolean ticks: no invented full forms

### Phase 3 — FFW + partial Start gate — NOT STARTED

- [ ] FFW modal + copy constants
- [ ] Block Start shift until this driver’s FFW complete
- [ ] Guides updated

### Phase 4 — Prestart + full Start gate — NOT STARTED

- [ ] Prestart schema UI + responsibility question (**L**/**M**/**N**)
- [ ] Unsafe block (**E1**)
- [ ] Guides updated

### Phase 5 — Dimension & Load + post-load gate — NOT STARTED

- [ ] Load form + Q “know who loaded?” / “I loaded it”
- [ ] Loader paths **J** A/B/C + dual function **J2**
- [ ] Multi-load per shift; post-load trigger (**D**/**O**)
- [ ] Guides updated

### Phase 6 — PDF + 28-day / week integration — NOT STARTED

- [ ] Checklist page renderer (HTML + jsPDF as needed)
- [ ] Wire week export + roadside produce (**H**)
- [ ] Pending / not-obtained / photo evidence presentation (**K**)
- [ ] Offline cache via existing produce path

### Phase 7 — Polish + QA — NOT STARTED

- [ ] Touch, geo-denied, photo size, two-up edge cases
- [ ] Manager read-only history (minimal)
- [ ] Manuals fully aligned; visual QA vs paper

---

## Deferred

| Item | Why deferred | Come-back |
|------|--------------|-----------|
| Formal `LOADING` / `IN_TRANSIT` status model | Not required if explicit post-load action works (O1) | After Phase 5 UX proven |
| Hard block week-sign on pending loader CoR | Soft visibility chosen (K1) | If operators demand |
| Loader app accounts / login | Capture via present sign, deferred link, or photos | After B path proven |
| Replacing Weekly Trip Sheet tick strip entirely | A1 keeps ticks as summary | Only if A2 revisited |

---

## Out of scope

- Fatigue / compliance **rule** behaviour changes  
- Inventing checklist answers or loader signatures  
- RN/Flutter rewrite  
- Assuming one person’s CoR duties for another  

---

## Exit criteria (project)

1. Three separate forms with gates as locked (C, D, L, J).  
2. No proxy loader CoR; dual function clearly labelled.  
3. Trip-sheet ticks reflect real completions only.  
4. Week / 28-day PDFs append checklist pages with honest pending / not-obtained states.  
5. Guides match the app.  
6. No timeline / coverage IP changes.

---

## Next action

**Phase 2** — data model + API + persistence (derive trip-sheet ticks from completed records).
