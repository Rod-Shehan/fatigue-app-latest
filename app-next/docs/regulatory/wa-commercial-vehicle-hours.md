# WA commercial vehicle driver hours (source-mapped)

This document is the **source of truth** for the app’s **time-based** fatigue checks for **Western Australia**.

For **how long records must be kept** vs **how much history the rule engine loads**, see [record-retention-and-compliance-lookback.md](./record-retention-and-compliance-lookback.md).

For the product doctrine that a **≥24h continuous break soft-resets short-horizon rules** (but **not** 14/28-day rules) — intended reading, not an explicit Reg 184E sentence — see [24h-soft-reset-doctrine.md](./24h-soft-reset-doctrine.md).

## Primary source

The implemented time requirements are taken directly from the WA **Work Health and Safety (General) Regulations 2022**:

- **Reg 184E — Commercial vehicle driver: hours of work**
- Source text location in our workspace capture: `agent-tools/9e4e8a3e-1a0c-4070-b635-a6a3aa95deb2.txt`
  - See lines **8503–8531** for the full clause text (Reg 184E(1)–(4)).

Important: WorkSafe training and fact sheets historically refer to an older OSH numbering (e.g. “OSH Reg 3.132”). We use **Reg 184E** as the authoritative current text.

## Mapping: regulation → app enforcement

All checks are implemented in `src/lib/compliance.ts` and executed via `runComplianceChecks()`.

### Applies to all commercial vehicle drivers (Reg 184E(1))

- **Reg 184E(1)(a)**: **For every 5 hours work time** — breaks totalling **≥20 minutes**, including a break of **≥10 consecutive minutes after 5 hours work time**.
  - **App**: rolling **5 hours (300 minutes) of driving work**, then **≥20 minutes** rest (2×10 or 1×20). Live “rest due” is at **300 work minutes**, not 20 minutes earlier. Retrospective 5h flags only when the window has **≥300** driving minutes without that rest.
  - Code: `checkBreakFromDriving()` + `five-hour-break-rule.ts` (`getBreakDueByTime` / AMI `evaluateFiveHourBreakRule`)

- **Reg 184E(1)(b)**: **In any 14‑day period** — **≤168 hours of work time**.
  - **App**: enforced as **14‑day work ≤168h**, with reset segmentation after **≥48h continuous no‑work** (app warning threshold at 140h). Uses the same **historyDays + prev week + current week** minute timeline as solo 14/28-day checks.
  - Code: `check168hWorkOnMinuteTimeline()` in `runComplianceChecks()`

### Solo driving (no relief driver) — additional requirements (Reg 184E(2))

- **Reg 184E(2)(a)**: In any **72‑hour period** — **≥27 hours non‑work**, including **≥3 periods of ≥7 consecutive hours non‑work**, **each separated from the next by ≤17 hours**.
  - Read as **one conjunctive package** (not three independent rules). **≥3× ≥7h** is required when the package applies.
  - **App**:
    - 72h (retrospective “ending now”): warns if **<27h** non‑work OR **<3×(≥7h)** blocks.
      - Code: `checkSoloRules()` (72h window ending now)
    - ≤17h separation: **violation** if elapsed time between qualifying ≥7h non‑work periods exceeds **17h**.
      - Code: `checkSoloRules()` (17h separation logic)
  - **Soft-reset:** a **≥24h** continuous break is intended to reset this package (and related short-horizon scoring) so holidays / long green are not false failures; **not** stated explicitly in the Reg text — see [24h-soft-reset-doctrine.md](./24h-soft-reset-doctrine.md). Legacy and AMI both soft-reset; AMI uses absolute-tape segment starts (`evaluateSolo72h`).

- **Reg 184E(2)(b)(i)**: In any **14‑day period** — **≥2 periods of ≥24 consecutive hours non‑work**.
  - **App**: **violation** if fewer than 2×(≥24h) non‑work blocks in the available 14‑day horizon (requires 14 days of coverage).
  - Code: `checkSoloRules()` (14‑day 24h break count)

- **Reg 184E(2)(b)(ii)**: Alternative **28‑day** pattern (4×24h) with additional cap (≤144h work in any 14‑day inside the 28‑day period).
  - **App**: evaluated as an **OR** with (i). Passes when the rolling tape (or declarations) shows **≥4×24h** non-work in 28 days **and** no 14-day window inside that 28 days exceeds **144h work**. Not used until 28 days of timeline exist. Does **not** replace the universal 168h cap in (1)(b).
  - Code: `option28Satisfied()` in `declared-24h-rests.ts`; live EWD via `evaluateSolo184E2bRestOptions()` in `ami/evaluate.ts` + `runWaComplianceChecks()`.

### Two‑Up driving (with relief driver) — additional requirements (Reg 184E(3))

- **Reg 184E(3)(a)**: In any **24‑hour period** — **≥7 hours non‑work** (may be in a moving vehicle).
  - **App**: **violation** if any rolling 24h window that contains work/break data has **<7h non‑work**.
  - Code: `checkTwoUpRules()` (rolling 24h non‑work)

- **Reg 184E(3)(b)**: Either:
  - **(i)** In any **48‑hour period** — **≥1 period of ≥7 continuous hours non‑work**, **not** spent in a moving vehicle; **or**
  - **(ii)** In any **7‑day period** — **≥48 hours non‑work** (not moving), including **≥24 consecutive hours**, and **does not include any non‑work period <7 consecutive hours**.

  - **App** (current approach):
    - **184E(3)(a)** is always required (rolling 24h ≥7h non-work).
    - **184E(3)(b)** is an **OR**: the **7-day option** (rolling 7×24h: ≥48h GPS-proven stationary non-work, ≥24h consecutive, no piece under 7h) **or** the **48-hour option** (≥7h continuous GPS-proven stationary non-work in any rolling 48h). Meeting either satisfies (b); the unused option is not raised.
    - “Not spent in a moving vehicle” is proven only by **Parked** (`stationary_rest`) or **End shift** (`stop`) **with a GPS pin on that event**. **Sleeper berth** counts for 184E(3)(a) (7h in 24h, moving allowed) and does **not** credit (3)(b). Missing GPS = not proven.
    - Code: `evaluateTwoUp24hRest` (tape, all non-work) plus `evaluateTwoUp48hStationaryOption` / `evaluateTwoUp7dStationaryOption` in `two-up-stationary.ts`. Live EWD uses those via `runWaComplianceChecks()` (AMI overlay, default) and `checkTwoUpRules()` (AMI kill-switch). Both paths require a GPS pin on **Parked** or **End shift**; sleeper tape does not credit (3)(b).

### Shiftwork ≥5 consecutive days (Reg 184E(4))

- **Reg 184E(4)**: If shiftwork on **5+ consecutive days** — **≥24 continuous hours non‑work between shift changes**.
  - **App**: Driver sets **Shift pattern (A/B)** on each day card (Day/Night). Legislation speaks in “days”; the engine treats **5×24h = 120h (7200 minutes)** on the **same pattern** on the rolling **event timeline** (not five calendar days). An **A↔B** change after that threshold is checked as elapsed time from **End shift** to the next **Work** (24h block), which may fall anywhere and need not align with midnight. Day cards are for labels and readable output. Proactive education in compliance + prompt after End shift when the pattern streak crosses 120h.

## Notes on definitions

- The regulation distinguishes **work time**, **breaks from driving**, and **non‑work time**. The app uses:
  - `work_time` minute grid
  - `breaks` minute grid
  - `non_work` minute grid
  - plus an event timeline for rolling 5h/break qualification

- Project-specific display rule (UI derivation and AMI reclass): **any logged break ≥31 minutes is recorded as non‑work time**. Break only comes from a driver **Break** action — End shift and other short off-duty gaps stay **non-work**. For the **5h / 20 min rest** rule, the break and non-work rows have the same effect (2×10 or 1×20); they are only shown differently. Other rules (7h / 17h / 72h / 168h) still treat non-work as recovery, not as a short break from driving.

## Prospective risk (separate from compliance)

Retrospective rule checks above apply only to the **attested record**. **Forward-looking** exposure (declared route distance/time on **future** days, projected against rolling state from history) is defined in [ADR 0003: Prospective risk engine](../adr/0003-prospective-risk-engine.md). Risk criteria are aligned with the same Reg 184E thresholds but do not replace violations on logged time.

