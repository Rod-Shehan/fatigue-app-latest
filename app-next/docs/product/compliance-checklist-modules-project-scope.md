# Project scope: Compliance checklist modules (FFW / Prestart / Dimension & Load)

**Status:** Phases 0–**5** done. **Phase 6** in progress under **revised PDF / storage doctrine (2026-08-01)**. **Trial mode:** checklists optional — gates off (**P**).  
**Stack:** Circadia24 EWD in **`app-next` (Next.js)** — not React Native / Flutter.  
**Baseline today:** Day cards store three **boolean** ticks on the Weekly Trip Sheet plus embedded signed checklist records in day JSON. Fatigue **28-day roadside** produce stays a **separate** regulatory artefact.

**Do not** change AMI / Reg 184E / rolling timeline / coverage engines in this project. Checklist completion must not invent work/break/non-work minutes.

**Related:** `weekly-trip-sheet-pdf-project-scope.md` (paper week chrome + tick strip — ticks only, not full CoR forms).

---

## Goal

Three **distinct** fast-interaction compliance forms (not one bundled start-of-day checklist):

1. **Fitness for Work (FFW)** — personal declaration + driver signature.  
2. **Prestart vehicle inspection** — Pass / Fail / N/A groups + defects + driver signature (when this driver is responsible).  
3. **Dimension & Load check** — repeatable post-load form + **driver** signature; **loader** CoR acknowledgment as a **separate legal function** when obtainable.

Forms use Circadia24 tokens, touch-first controls, canvas signatures. Full checklist detail is available in-app (**View**) and as a **dedicated checklist PDF** produced on demand — **never** merged into the 28-day fatigue roadside pack (different regulations).

### Trial / marketing posture (locked)

During the current trial term, checklists are a **capability preview**:

- Drivers/managers **may** complete FFW / Prestart / Dimension & Load when useful.  
- Completing them is **never required** to Start shift, log work, leave loading, or sign the week.  
- Gate designs below (C–E, L–O) remain the **target product** for customers who later want enforcement — implemented only when `checklistSheetGatesEnabled()` is turned on for that org (or a future policy flag).  
- Do **not** soft-block or nag in a way that implies a legal obligation the customer has not contracted.

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
| **A** | **A1** | Keep Weekly Trip Sheet Sun–Sat tick rows. A tick means **≥1 completed signed checklist of that type for that day** (never invent ticks). Full checklist detail is separate PDF / in-app View. |
| **B** | **B1 + photo doctrine** | Persist checklist **answers + signatures + meta** in day JSON (`checklists[]`). **Photos are the storage cost driver** — see **Q**. |
| **C** | **C1 — designed, off in trial** | **Shift Start Gate (future):** may require this driver’s **FFW** + **Prestart when responsible** (see **L**). **Trial:** do not lock Start shift / movement. Do **not** bundle Dimension & Load into Start shift. |
| **D** | **D1 — designed, off in trial** | **Post-Load Gate (future):** Dimension & Load separate; multi-complete per shift. **Trial:** optional form only — no leave-loading / in-transit block. |
| **E** | **E1 — designed, off in trial** | **FAIL + unsafe (future):** may block Start / resume when gates on. **Trial:** record unsafe flag for evidence; do not block sheet actions. |
| **F** | **F1** | Item UI: **Unselected** default; single tap → **Pass**; explicit **Fail** / **N/A**. Fail opens defect card (text, optional photo; mobility where applicable). FFW uses acknowledge/declare, not Pass/Fail/NA. |
| **G** | **G1** | Every completed checklist ends with canvas signature(s): Clear + Confirm; store base64 PNG + **UTC & AWST** timestamps + lat/lng when available (null if denied). |
| **H** | **H2 — revised 2026-08-01** | **Do not** append checklists into the **28-day fatigue roadside** PDF or merge CoR forms into fatigue week tiles. Checklist PDF is a **separate on-demand artefact** (EWD + Enterprise). Brand header Midnight `#0A1118`; defects `#EF4444`. Weekly Trip Sheet may still show **ticks only** (A1). |
| **I** | **I1** | Brand tokens on checklist modals + checklist PDF pages: Midnight `#0A1118`, Slate `#16222F`, Cobalt `#007AFF` / `#1E88E5`, Emerald `#10B981`, Red `#EF4444`, Steel `#64748B`, Border `#2A3B50`. |
| **J** | **J1 = A+B+C** | **Loader CoR paths** (Dimension & Load): **A** present → loader name + **loader** signature; **B** known but absent → driver-complete / **loader pending**; **C** unknown/unavailable → **driver-only** + **required photo(s)** at capture; PDF flags loader CoR **not obtained**. **No proxy.** |
| **J2** | **Yes** | Dual function: separate **As driver** and **As loader** acknowledgments (two signatures if self-loader). |
| **J3** | **Yes** | No proxy / assumption of another’s CoR responsibility. |
| **K** | **K2 — revised** | Checklist PDF (and in-app View) **must** show honest **loader pending** / **not obtained** states. Does **not** live inside fatigue 28-day produce. Week sign-off is **not** blocked solely by pending loader CoR in v1. |
| **L** | **L1 — designed, off in trial** | Prestart responsibility question (future when gates on). **Trial:** optional Prestart UX. |
| **M** | **M1 — designed, off in trial** | Two-up “one Prestart on vehicle” — **only when gates on**. |
| **N** | **N1 — advisory** | Second driver FFW remains personal when gates on; **trial:** optional for all. |
| **O** | **O1 — designed, off in trial** | Explicit post-load action / status — **only when gates on**. |
| **P** | **P1 — trial lock** | Checklists optional. `checklistSheetGatesEnabled()` defaults **false**. |
| **Q** | **Q1 — storage doctrine (2026-08-01; audit-aware)** | **System of record = structured JSON** in Neon (answers, paths, signatures, timestamps) — durable and re-producible for **WAHVA / CoR / WHS audits**. **PDF is a view**, generated on demand (or archived copy for filing) — not a substitute for the record. **Photos:** do not bloat Neon long-term; move to **object storage and/or customer SharePoint** with keys/hashes on the record so evidence stays auditable. **Email** is a delivery channel to the customer (copy for their mailbox), **not** Circadia’s only audit store. **No Circadia-owned physical photo server** in this phase unless a contract forces it. |

### Implied rules

- Forms are **three modules**, not one combined checklist.  
- Guides update when voluntary UI ships; gate copy only when **P** is lifted.  
- Offline: local-first write; sync with existing sheet/day persistence.  
- Any future gate code **must** call `checklistSheetGatesEnabled()` and no-op when false.  
- Fatigue roadside produce and checklist PDF remain **product-separated**.  
- Checklist completions are **audit artefacts** (WAHVA / CoR / maintenance evidence): keep honest answers, signatures, and timestamps; photo media may live off Neon but must remain **retrievable for audit**, not “email-only and gone from Circadia.”

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
- 10 acknowledge/declare points — final wording from company paper / legal review.  
- Sign-off: **driver** digital signature only.

### 2. Prestart vehicle inspection

- Groups (Pass / Fail / N/A) with note bullets under headings.  
- Fail → defect text + optional photo + mobility.  
- Sign-off: **driver** digital signature (when responsible per **L**).

### 3. Dimension & Load

- Header: client, loader name (when known / self), driver, truck/trailer rego, load type, weight.  
- Points: dimensions/permit; route/RAV; secured restraints; CoG; dunnage.  
- Sign-off: **driver** mandatory; **loader** per **J** / **J2**.

---

## Phases

### Phase 0 — Decisions — DONE

- [x] Owner lock A–O, including CoR no-proxy and loader/prestart gates  
- [x] **H2 / K2 / Q1** locked 2026-08-01 (separate checklist PDF; JSON SoR; photo offload doctrine)

### Phase 1 — Design system + shared form kit — DONE

- [x] Brand tokens, item controls, signature panel, modal shell, kit demo, unit tests

### Phase 2 — Data model + API + persistence — DONE

- [x] Records in day JSON; validation; tick derive; GET/POST checklists API

### Phase 3 — FFW voluntary entry — DONE

- [x] `FitnessForWorkForm` + entry points + guides; gates off

### Phase 4 — Prestart voluntary entry — DONE

- [x] `PrestartForm` + responsibility / fault email path; gates off

### Phase 5 — Dimension & Load voluntary entry — DONE

- [x] `DimensionLoadForm` + J/J2 paths; multi-load; View vs Redo; guides

### Phase 6 — Dedicated checklist PDF (+ photo doctrine) — IN PROGRESS

**Doctrine:** JSON SoR (audit-durable); PDF on demand / optional archive copy; **not** in 28-day roadside; photos → object store or customer SharePoint (**email = delivery**, not sole custody) (**Q1**).

- [x] Checklist PDF renderer from completed records (jsPDF; brand **I**)
- [x] On-demand produce + email — **week pack per type** (FFW / Prestart / Load separate; never merged; not fatigue roadside)
- [x] Honest pending / not-obtained presentation (**K2**)
- [x] Interim email to Circadia holding inbox (`circadia24@gmail.com`); per-client distribution later
- [x] Explicit UI copy: checklist PDF ≠ fatigue roadside; types not combined
- [x] Guides updated
- [ ] Customer packing choice (per shift / day / week / fortnight / month) — deferred
- [ ] Off-Neon photo store (R2 / SharePoint) — **parked** (see `docs/architecture/checklist-photo-r2-parked.md`)

### Phase 7 — Polish + QA — NOT STARTED

- [ ] Touch / geo / two-up polish  
- [ ] Manager history + Enterprise produce  
- [ ] Manuals + visual QA  
- [ ] Customer gate opt-in  
- [ ] Optional paid photo retain / Blob / SharePoint  

---

## Deferred

| Item | Why deferred | Come-back |
|------|--------------|-----------|
| Formal `LOADING` / `IN_TRANSIT` | O1 enough for now | After Phase 5 UX proven |
| Hard block week-sign on pending loader CoR | Soft visibility (K2) | If operators demand |
| Loader app accounts | Present / pending / photos | After B path proven |
| Replacing Weekly Trip Sheet tick strip | A1 keeps ticks | Only if A2 revisited |
| WAHVA fault auto-email polish | Pathway landed; auto-send partial | Parallel to Phase 6 email PDF |
| Circadia-owned physical photo server | Ops/cost vs managed storage / customer email | Only if contract forces |
| Merging checklists into 28-day roadside | Wrong regulation mix (**H2**) | Do not revisit without owner lock |

---

## Out of scope

- Fatigue / compliance **rule** behaviour changes  
- Inventing checklist answers or loader signatures  
- RN/Flutter rewrite  
- Assuming one person’s CoR duties for another  
- Embedding CoR checklist pages inside fatigue roadside produce  

---

## Exit criteria (project)

1. Three separate forms available; gates only when customer enables (**P**).  
2. No proxy loader CoR; dual function clearly labelled.  
3. Trip-sheet ticks reflect real completions only (when used).  
4. Dedicated checklist PDF on demand from JSON; **not** inside 28-day fatigue roadside; honest pending / not-obtained states.  
5. Guides match the app (optional in trial).  
6. No timeline / coverage IP changes.  
7. `checklistSheetGatesEnabled()` false by default for trial / marketing.  
8. Photo / evidence media follows **Q1**: durable for audit (object store or customer SharePoint + keys), email as delivery only.

---

## Next action

**Phase 6 remaining** — per-client checklist email distribution + optional packing cadence (shift/day/week/…). R2/photo offload stays parked.

---

## Checklist PDF packing doctrine (locked 2026-08-01)

- Fatigue roadside / week sheets are **never** included in checklist PDFs.
- **One PDF = one checklist type** for one driver (default scope: **week**).
- Do **not** merge FFW + Prestart + Dimension & Load — different regulations; auditors often call them up separately.
- Legacy practice often treated each form iteration as its own output; week-per-type is the interim demo packing.
- Later: customer choice of packing (per shift / day / week / fortnight / month).
