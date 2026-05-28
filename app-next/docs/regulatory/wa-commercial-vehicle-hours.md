# WA commercial vehicle driver hours (source-mapped)

This document is the **source of truth** for the app’s **time-based** fatigue checks for **Western Australia**.

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
  - **App**: enforced as a rolling “5h work → 20 min break” rule using the event timeline.
  - Code: `checkBreakFromDriving()` + `five-hour-break-rule.ts`

- **Reg 184E(1)(b)**: **In any 14‑day period** — **≤168 hours of work time**.
  - **App**: enforced as **14‑day work ≤168h**, with reset segmentation after **≥48h continuous no‑work** (app warning threshold at 140h).
  - Code: `segmentsSplitBy48hNonWork()` + 14‑day section in `runComplianceChecks()`

### Solo driving (no relief driver) — additional requirements (Reg 184E(2))

- **Reg 184E(2)(a)**: In any **72‑hour period** — **≥27 hours non‑work**, including **≥3 periods of ≥7 consecutive hours non‑work**, **each separated from the next by ≤17 hours**.
  - **App**:
    - 72h (retrospective “ending now”): warns if **<27h** non‑work OR **<3×(≥7h)** blocks.
      - Code: `checkSoloRules()` (72h window ending now)
    - ≤17h separation: **violation** if elapsed time between qualifying ≥7h non‑work periods exceeds **17h**.
      - Code: `checkSoloRules()` (17h separation logic)

- **Reg 184E(2)(b)(i)**: In any **14‑day period** — **≥2 periods of ≥24 consecutive hours non‑work**.
  - **App**: **violation** if fewer than 2×(≥24h) non‑work blocks in the available 14‑day horizon (requires 14 days of coverage).
  - Code: `checkSoloRules()` (14‑day 24h break count)

- **Reg 184E(2)(b)(ii)**: Alternative **28‑day** pattern (4×24h) with additional cap (≤144h work in any 14‑day inside the 28‑day period).
  - **App**: **not currently implemented** (requires ≥28 days of data + explicit “pattern selection” policy).

### Two‑Up driving (with relief driver) — additional requirements (Reg 184E(3))

- **Reg 184E(3)(a)**: In any **24‑hour period** — **≥7 hours non‑work** (may be in a moving vehicle).
  - **App**: **violation** if any rolling 24h window that contains work/break data has **<7h non‑work**.
  - Code: `checkTwoUpRules()` (rolling 24h non‑work)

- **Reg 184E(3)(b)**: Either:
  - **(i)** In any **48‑hour period** — **≥1 period of ≥7 continuous hours non‑work**, **not** spent in a moving vehicle; **or**
  - **(ii)** In any **7‑day period** — **≥48 hours non‑work** (not moving), including **≥24 consecutive hours**, and **does not include any non‑work period <7 consecutive hours**.

  - **App** (current approach):
    - Evaluates the **7‑day option** structural requirements:
      - warns if **<48h** non‑work
      - warns if missing **≥24h continuous** non‑work
      - warns if any non‑work block is **<7h**
    - If the 7‑day option is **not met**, enforces the **48‑hour option** as a **violation** when a rolling 48h window with work/break data has **no ≥7h non‑work block**.
    - “Not spent in a moving vehicle” is supported by an **evidence warning** heuristic (GPS change during breaks), but the app does not yet have a definitive “moving vehicle” classifier for non‑work.
  - Code: `checkTwoUpRules()` + `checkRestBreakMovingVehicle()`

### Shiftwork ≥5 consecutive days (Reg 184E(4))

- **Reg 184E(4)**: If shiftwork on **5+ consecutive days** — **≥24 continuous hours non‑work between shift changes**.
  - **App**: Driver sets **Shift pattern (A/B)** on each day card (Day/Night). After **5+ consecutive worked days**, an **A↔B** change between consecutive days triggers a check from **End shift** on day N to first **Work** on day N+1. Proactive education in compliance + prompt after End shift on a 5+ day streak.

## Notes on definitions

- The regulation distinguishes **work time**, **breaks from driving**, and **non‑work time**. The app uses:
  - `work_time` minute grid
  - `breaks` minute grid
  - `non_work` minute grid
  - plus an event timeline for rolling 5h/break qualification

- Project-specific rule (implemented in UI derivation): **any break >30 minutes is recorded as non‑work time**.

