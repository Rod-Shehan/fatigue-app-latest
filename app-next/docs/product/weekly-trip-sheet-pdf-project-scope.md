# Project scope: Weekly Trip Sheet PDF

**Status:** Phases 0–3 code complete (2026-07-30). Owner production spot-check pending after deploy.  
**Paper reference:** Helper / carrier “WEEKLY TRIP SHEET” blank (week header, FFW/load/vehicle tick rows, ×7 day grids, footer).  
**Day tile authority:** Existing WorkSafe day sheet (`worksafe-wa-day-sheet-concept.md`) — **15‑minute** grid + step line. Do **not** switch to paper’s 20‑minute divisions without a separate owner decision.

**Do not** change AMI / Reg 184E / rolling timeline engines in this project.

## Goal

Week **Export PDF** (and the same body used by roadside/archive) reads as a **Weekly Trip Sheet**: paper-like week chrome + seven WorkSafe day rows consistent with Day Entry, plus retained Circadia compliance/appendix value.

Every filled cell must have a real data source (or an explicit blank). No decorative fake ticks.

## Phase 0 decisions (locked)

| # | Choice | Meaning |
|---|--------|---------|
| **A** | **A1 + A2** | **Paper week body** (title, week ending, driver, regs, checklist, ×7 day tiles, footer) **and** keep Circadia **compliance summary** + **shift-log appendix** around/after that body. |
| **B** | **B1 + B2** | **Capture** Fitness for Work / Dimension & load / Daily vehicle checklist in the app (day-level Sun–Sat ticks) **and** print **empty** tick boxes when a day is unset — never invent ticks. |
| **C** | **C3 — deferred** | Trailer / dolly reg lines: **not in this project**. See [Deferred](#deferred-come-back). |
| **D** | **D1** | **One week signature** in the footer (reuse `FatigueSheet.signature` / `signedAt`). No per-day signature column for now. |
| **E** | **Deferred** | Licence valid Y/N: **not in this project**. See [Deferred](#deferred-come-back). |
| **F** | **Yes** | **OFFICE USE** block — always printable blank (“Checked / Recorded by:”). |
| **G** | **Yes** | **Total Working Hours Per Week** — auto-sum of **WORK TIME** minutes across the seven day paints. |
| **H** | **Both** | Show **truck reg** in the **week header** (union of regs used that week) **and** on each **day tile** when that day has `truck_rego`. |

### Implied presentation rules

- **Week ending** = `weekStarting` + 6 days (Saturday), labelled as week ending; still store/identify sheets by `weekStarting`.
- **Driver’s name** = sheet `driverName` (print).
- Day rows = current WorkSafe tiles (odo, locations, 3 tracks, totals, weekday + date). Extend tile chrome for **truck reg** (H).
- HTML (Chromium) and jsPDF paths must both show week signature when D1 applies (fix today’s HTML gap).

## Phases

### Phase 0 — Decisions — DONE

- [x] Owner lock A–H (this doc)

### Phase 1 — Week PDF chrome + existing data — DONE

- [x] Paper-style **week header**: title, week ending, driver name, truck reg summary (H)
- [x] **×7** WorkSafe day tiles (existing paint); per-day truck reg on tile (H)
- [x] **Footer**: Total Working Hours Per Week (G), OFFICE USE blank (F), week signature (D1) on **both** export paths
- [x] Preserve **A2**: roadside/compliance summary + shift-log appendix (order: compliance → paper week body → appendix)
- [x] Checklist strip: **empty** Sun–Sat boxes only (B2 preview), until Phase 2 wires data
- [x] Tests for header/footer totals and signature presence
- [x] Driver / manager guide: what the week PDF shows

### Phase 2 — Checklist capture (B1) + PDF ticks — DONE

- [x] Day JSON fields for Fitness for Work / Dimension & load / Daily vehicle checklist
- [x] Driver UI on day card + Set up day (mobile-first)
- [x] PDF checklist rows show ✓ when set, empty when unset (B1+B2)
- [x] Soft prompt before sign if ticks missing — **deferred** (default no hard block)
- [x] Guides updated for the three checklist rows

### Phase 3 — Polish + QA — DONE (code); owner prod spot-check pending

- [x] Page breaks so seven day rows remain readable (tile-only day cards; shift log keeps event detail; HTML/jsPDF page breaks)
- [x] Visual QA checklist documented below (layout only; 15‑min retained)
- [x] Confirmed roadside produce uses `renderPdfHtml` / `buildSingleSheetJsPdfBuffer` week body + trip-sheet CSS; archive design remains “same PDF as Export PDF”
- [ ] Owner spot-check on production after deploy approval

### Visual QA checklist (owner / engineering)

Compare Export PDF to the paper Weekly Trip Sheet blank:

1. Week header: title, week ending (Sat), driver name, truck reg(s)
2. Three checklist rows × SUN–SAT — ticks only where day cards were ticked
3. Seven WorkSafe day rows (15‑min grid, blank first hour, step line) — not split mid-tile
4. Footer: OFFICE USE blank, week work-hours total, week signature when signed
5. Compliance summary before the trip sheet; shift log appendix after
6. No fabricated trailer/dolly or licence-valid fields (deferred)

## Deferred (come back)

Documented so we do not silently drop them:

| Item | Paper field | Why deferred | Come-back notes |
|------|-------------|--------------|-----------------|
| **C — Trailer / dolly** | Trailer Reg No / Dolly Reg No (multiple lines) | No data model or UI yet | Add week- or day-level fields + catalogue optional; print in header with truck. Revisit after Phase 2. |
| **E — Licence valid** | “Is your driver’s licence valid?” Yes/No | Not an attested sheet field today; `Driver.licenceNumber` ≠ validity | Likely a **sign-off attestation** (Y/N stored on sheet). Revisit with sign flow / D1 footer. |
| Per-day signature column | Paper “Signature” per day | Owner chose D1 (week signature) | Only if regulators/customers require daily wet-ink style cells. |
| 20‑minute hour divisions | Paper note | EWD + WorkSafe day sheet are **15‑min** | Do not change without explicit owner approval. |

## Out of scope

- Fatigue / compliance **rule** behaviour changes
- Inventing checklist ticks or regs without capture
- Replacing Day Entry WorkSafe sheet with a different grid
- SharePoint archive plumbing (unchanged — still “same PDF as Export PDF”)

## Key files (implementation)

| Area | Path |
|------|------|
| Week PDF assemble | `src/lib/sheet-jspdf-export.ts`, `src/app/api/sheets/[id]/export/route.ts` |
| Day tile | `src/lib/worksafe-day-sheet/pdf-render.ts`, `WorkSafeDaySheet.tsx` |
| Day JSON types | `src/lib/api.ts` (`DayData`) |
| Sheet model | `prisma/schema.prisma` (`FatigueSheet`) |
| Guides | `docs/user-guides/driver-ui-guide-esl.md`, `DriverGuideArticle.tsx`, manager guides as needed |

## Exit criteria

1. Export PDF shows a recognisable **Weekly Trip Sheet** frame (header + 7 day rows + footer) using our 15‑min WorkSafe days.  
2. Truck regs appear in header and on day tiles when present.  
3. Week work-hours total and OFFICE USE + week signature behave as locked.  
4. Checklist ticks are either **captured and printed** or **empty** — never fabricated.  
5. Compliance summary + shift-log appendix still present (A1+A2).  
6. Trailer/dolly and licence-valid remain documented deferred items until a follow-up project.

## Related

- Day sheet concept: `worksafe-wa-day-sheet-concept.md`
- Day sheet project (shipped): `worksafe-wa-day-sheet-project-scope.md`
- Archive policy: `../WEEKLY_ARCHIVE_EXPORT.md`
