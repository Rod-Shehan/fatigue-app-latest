# Project scope: WorkSafe WA day sheet on EWD (UI then PDF)

**Concept:** `worksafe-wa-day-sheet-concept.md` (approved 2026-07-30).  
**Do not** change AMI / Reg 184E engines in this project.

## Decisions locked

| # | Decision |
|---|----------|
| 1 | Concept note approved / frozen |
| 2 | Visual primary = WorkSafe WA template; Helper = step-line look only |
| 3 | UI: replace three-bar chart as default **immediately** |
| 4 | Ship **UI first**, then **PDF** |

## Goal

Driver day view (then print) presents the WorkSafe three-track day sheet from existing EWD logs.

## Phases

### Phase A — Concept freeze — DONE
- [x] WorkSafe authority  
- [x] Button → row mapping (Break ≠ End shift)  
- [x] Owner decisions 1–4  

### Phase B — Day paint model — DONE
- [x] Exclusive minute → WorkSafe track from current coverage / events  
- [x] Row totals; overnight carry; End shift → non-work; actioned Break only  
- [x] Fixture tests (known day patterns)  
- [x] **No UI chrome yet** (`src/lib/worksafe-day-sheet/`)

### Phase C — Driver UI — DONE
- [x] Paper-style day row on Day Entry (WorkSafe labels + Helper-style step line)  
- [x] Default replace `TimeGrid` bars (`WorkSafeDaySheet`)  
- [x] Mobile: horizontal scroll OK  

### Phase D — PDF / print — DONE
- [x] Weekly export + roadside day tiles match Phase C UI (`pdf-render` + `sheet-jspdf-export`)  

### Phase E — Guides + cutover — DONE
- [x] Driver manual / help / in-app guide describe WorkSafe day sheet  
- [x] Structural visual QA checklist (labels, exclusivity, UI↔PDF); owner can confirm vs blank Element 2.2.4  
- [x] Removed dead bar-chart (`TimeGrid`, `TIME_GRID_ROWS`); roadside produce CSS uses WorkSafe day CSS  

## Out of scope
New log types; fatigue engine changes; long-lived dual “classic bars” mode; DFMP features on the day chart.

## Exit criteria (project)
Open EWD day + exported PDF day read as the same WorkSafe day sheet for the same logs. **Met** for paint/UI/PDF paths; owner visual spot-check vs paper blank recommended.
