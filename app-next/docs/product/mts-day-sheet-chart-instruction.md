# Cursor instruction: MTS / WorkSafe day sheet chart for Circadia24 EWD

**Status:** Shipped (Phases A–E). WorkSafe WA day-sheet definitions remain the product concept source of truth. See `docs/product/worksafe-wa-day-sheet-concept.md`. Helper / MTS visuals are layout aid only.

**Do not** reintroduce the old three coloured bars (`TimeGrid`) as the driver day view or PDF day tile.

---

## What shipped

| Surface | Implementation |
|---------|----------------|
| Paint model | `src/lib/worksafe-day-sheet/` (`buildWorkSafeDayPaint`) |
| Driver Day Entry | `WorkSafeDaySheet.tsx` — paper header + 15-min tick grid |
| Weekly + roadside PDF | Same tick-grid layout via `pdf-render.ts` |
| Scope checklist | `docs/product/worksafe-wa-day-sheet-project-scope.md` |

---

## Goal (unchanged)

On EWD Day Entry and in PDF export, show a **WorkSafe-faithful paper day row**:

- Header: Odometer Start / Start Location / Finish Location / Odometer Finish
- Hour labels **24.00 … 23.00** with alternating grey/white
- Three labelled rows with a **15-minute tick grid** (filled cells from EWD paint)
- Right-hand **Total** column per row
- Day name (e.g. SUNDAY) on the left; signature fields deferred to the week sheet

---

## WorkSafe row definitions (mandatory)

Use these for classification, labels, tooltips, and driver help. Prefer `WORKSAFE_TRACK_LABELS` in code.

### Work Time
Driving, loading / unloading, maintenance, paperwork, and other work incidental to driving.

### Breaks from driving
Under ~30 minutes. Includes short rest and **napping**. Only when the driver taps Break. Longer logged breaks paint as Non work (existing EWD ≥31 min rule).

### Non work time
Rest over ~30 minutes, sleeping, time away from the vehicle; **End shift** paints non-work immediately (gaps after End shift are not invented as Break).

---

## Integration points

1. **Primary:** Day Entry — `WorkSafeDaySheet` (not bars).
2. **Two up:** one chart instance per driver sheet for that calendar day.
3. **PDF:** weekly export + 28-day roadside produce use the same paint model.
4. Do not break event logging, compliance math, or rolling windows.

---

## Visual QA (owner)

When checking against a blank WorkSafe Element 2.2.4 / Helper day row:

1. Labels match WORK TIME / BREAKS FROM DRIVING / NON WORK TIME.
2. Known pattern (non-work → work → short break → work → end shift) draws a continuous step line; End shift gap is non-work.
3. Day card and exported PDF day for the same logs read as the same sheet.
4. Mobile day card scrolls horizontally if needed.

---

## Related

- Concept: `docs/product/worksafe-wa-day-sheet-concept.md`
- Project scope: `docs/product/worksafe-wa-day-sheet-project-scope.md`
- Coverage: `src/lib/coverage/derive-minute-coverage.ts`
