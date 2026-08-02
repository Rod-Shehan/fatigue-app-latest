# ≥24h break — soft reset doctrine (WA solo / short-horizon rules)

**Status:** Product / compliance-expert doctrine for Circadia24.  
**Not** an explicit sentence in Reg 184E — the regulation states rolling windows (“in any 72-hour period”, etc.) but does **not** write “a 24-hour non-work break resets …”.  
This note records the **intended reading** used when implementing and explaining the diary: a **fundamental ≥24h continuous break** clears short-horizon fatigue accounting so that long green (holidays, days off) is not scored as a false shortfall.

Related: [wa-commercial-vehicle-hours.md](./wa-commercial-vehicle-hours.md) (source-mapped thresholds), [record-retention-and-compliance-lookback.md](./record-retention-and-compliance-lookback.md) (lookback vs retention).

---

## Principle

1. Timelines are **rolling** (event → minute tape). Calendar day / week labels are **descriptors only**.
2. **Work enlivenes** short-horizon rest structure rules. Continuous non-work with **no work in play** must not be treated as “missing N×7h majors” — otherwise a holiday is one long green run and looks non-compliant.
3. A **≥24 continuous hours** break (proven continuous no-work / non-work, or a declared absolute **start–end** range on the sheet) is the **fundamental recovery break**. Soft-reset uses the **end instant** on the rolling timeline — **not** a calendar day / midnight descriptor.
4. **Do not** soft-reset the **14-day** and **28-day** solo rules on that same break: those rules **count** ≥24h non-work periods as their substance (Reg 184E(2)(b)). Resetting them would erase the thing they measure.

---

## What a ≥24h break is intended to reset

| Area | Soft-reset after ≥24h? | Notes |
|------|------------------------|--------|
| Solo **72h** package (184E(2)(a)): ≥27h non-work **including** ≥3× ≥7h continuous, ≤17h between those majors | **Yes** | One conjunctive package on the post-reset segment / window — not three independent alarms. |
| **≤17h** span between ≥7h majors | **Yes** | Same package / same segments as 72h. |
| Other short-horizon “worked pattern” rest structure that would otherwise punish long green | **Yes** (same idea) | Must stay consistent with “work enlivenes”. |
| Solo **14-day** ≥2×24h non-work | **No** | 24h blocks are the requirement, not a wipe. |
| Solo **28-day** alternative (4×24h + work cap) | **No** | Same. |
| **168h** work in 14 days | **Not via 24h** | App uses a **≥48h** continuous no-work segmentation for 168h (separate doctrine). |
| **5h work / 20 min break** | **No** (not a 24h-reset rule) | Rolling work/break window on the event tape. |
| **184E(4)** pattern-change 24h between shift changes | Separate | Uses 24h as the **required gap** on pattern change, not as a global soft-reset of all rules. |

---

## How this sits next to the statute text

- **Literal 184E(2)(a)** still requires, in a worked 72h context: ≥27h non-work including **at least three** ≥7h continuous non-work periods, ≤17h apart — **one AND line**, not optional “OR fewer majors if longer”.
- Soft-reset uses the **absolute end** of a declared ≥24h break when start/end times are set (not calendar midnight / day descriptors). See sheet fields `last24hBreakStart` / `last24hBreakEnd`.
- Without documenting this, “any rolling 72h of tape” (especially AMI absolute lookback with no segment reset) can warn **found: 1** after a ≥24h day off + later short work + long green — which fights the holiday / recovery intention.

---

## Implementation notes (engines)

| Engine | ≥24h soft-reset for 72h / 17h |
|--------|-------------------------------|
| **Legacy** `checkSoloRules()` | **Yes** — `segmentsSplitBy24hNonWork` (+ declared `last24hBreak`); 72h window only inside the segment that contains “now”; skip if segment shorter than 72h. |
| **AMI** `evaluateSolo72h` | **Yes** — `softResetSegmentStartMinute` on absolute reclassified tape (`!work` continuous ≥24h advances segment; declared `last24hBreak` → segment starts next local midnight); skip if post-reset segment &lt;72h; **work must enliven** the scored window. Bridge uses `AMI_72H_EVAL_LOOKBACK` and passes `last24hBreak`. **14/28-day** evaluators unchanged (no soft-reset). |

**Work gate:** AMI requires `work` in the scored 72h window (pure holiday green → `applies: false`). Legacy also skips windows with no work/break (`hasData`).

---

## Owner one-liners

- **≥24h break** → soft-reset short-horizon solo rest structure (**72h package / 17h**).  
- **14 / 28 day** → **no** soft-reset.  
- **No work enlivening** → don’t fail long green as missing majors.  
- Intention of the regs / FRMS practice; **not** copied verbatim from the Act.
