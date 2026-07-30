# Concept note: WorkSafe WA day sheet ↔ EWD logging

**Status:** Concept **approved** (2026-07-30). Presentation build may proceed from this note.  
**Authority:** WorkSafe WA Fatigue Driver Logs (Element 2.2.4) and DFMP definitions.  
**Helper / MTS:** Visual language may follow the Helper paper chart (step line / layout aid only). **WorkSafe WA is the meaning.** Helper is modelled to fit WorkSafe — not the reverse.

### Locked product decisions (2026-07-30)

1. This concept note is frozen.  
2. **Visual primary:** WorkSafe WA blank timesheet template. Helper only for how the step line looks.  
3. **UI rollout:** Replace the current three-bar day chart as the **default immediately** (no long-lived alternate bars flag).  
4. **Delivery order:** Driver **UI first**, then **PDF / print** (weekly + roadside day tiles) to match.

---

## What the WorkSafe day sheet is

One calendar day, left → right across **00:00–24:00**, with three activity tracks. At any minute the driver is on **exactly one** track:

| WorkSafe row | Meaning (WorkSafe) |
|--------------|--------------------|
| **WORK TIME** | Driving, loading/unloading, maintenance, paperwork, and other work incidental to driving |
| **BREAKS FROM DRIVING** | Short rest from driving (**under ~30 minutes**), including **napping** |
| **NON WORK TIME** | Rest **over ~30 minutes**, sleeping, time away from the vehicle |

Paper sheet also carries day/date, driver, rego/kms where used, and totals per row. A continuous **step line** (Helper-style) is a presentation of these three tracks — it is not a fourth activity type.

---

## How EWD buttons map onto those rows

Driver taps are the source of truth. The day sheet **paints what was logged**, then applies the same duration rules EWD already uses (short vs long break).

| EWD action | Paints as WorkSafe… | Notes |
|------------|---------------------|--------|
| **Start shift / Work** | **WORK TIME** | Continues until the next logged change |
| **Break** | **BREAKS FROM DRIVING** | Only when the driver taps Break. If that logged break runs **past ~30 minutes**, EWD already treats the stretch as **NON WORK TIME** (same as today’s ≥31 min rule) |
| **Non-work** (if offered) | **NON WORK TIME** | Explicit off-duty / rest |
| **End shift** | **NON WORK TIME** from that moment | Immediately non-work until the next Work. Not Break. Gaps after End shift are not invented as Break |
| Nothing logged yet (today, future minutes) | Empty / unpainted | OK on the open day |
| Carry overnight (open work/break across midnight) | Same track continues | Day/date columns are labels only; the timeline does not reset at midnight |

**Totals:** WorkSafe **Breaks** total = time on the Breaks row only. Do not fold short breaks into the Work Time total box (WorkSafe paper practice). Compliance engines still count those minutes under the rules they already use.

---

## What this concept is *not*

- Not a new fatigue rule set (AMI / Reg 184E stay as they are).
- Not “three coloured bars” as the WorkSafe record — bars are a digital shortcut; the WorkSafe concept is **three named tracks + exclusive time**.
- Not requiring the driver to hand-draw the line — EWD draws from logged events.
- Not proven by a single day alone for 72h / 14-day windows — multi-day EWD history still required; each day must classify correctly so those windows can be computed.

---

## Build sequence (after this concept)

1. **Phase B — Day paint model** (exclusive track per minute + totals; tests).  
2. **Phase C — Driver UI** day view (default; replace bars).  
3. **Phase D — PDF / print** to match UI.  
4. **Phase E — Guides + cutover QA.**

---

## Related

- Older chart build notes (presentation detail; subordinate to this concept): `docs/product/mts-day-sheet-chart-instruction.md`  
- Project scope checklist: `docs/product/worksafe-wa-day-sheet-project-scope.md`  
- Hours / Reg 184E: `docs/regulatory/wa-commercial-vehicle-hours.md`
