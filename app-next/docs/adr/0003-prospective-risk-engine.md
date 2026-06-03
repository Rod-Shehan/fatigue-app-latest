# ADR 0003: Prospective risk engine (ISO 31000) vs retrospective compliance

## Status

**Accepted** — 2026-06-02

## Context

- **Compliance** is implemented in `src/lib/compliance.ts` against the **attested record** (work/break/non-work, events, kms, GPS corroboration). It answers: *what happened, and does the record breach fatigue law?* See [WA commercial vehicle driver hours](../regulatory/wa-commercial-vehicle-hours.md).
- Product direction requires a separate **risk analysis** capability for **assurance and coaching**, not enforcement. Managers need to see **upcoming** exposure (e.g. a proposed long run that would push a **14-day / 168h** or solo **14-day / 28-day** boundary) **before** it becomes a signed violation.
- Fatigue planning generalises to two driver-declared parameters: **distance** and **time** (typical run). Retrospective rolling state plus a **proposed** leg on **future** calendar segments yields actionable outcomes (“1 + 1 = 2”).
- Route input must be **fluid**: owner-drivers and ad-hoc work enter runs from the **driver UI**; an optional org route catalogue is an accelerator, not a gate. Manager-only route building was rejected as too restrictive for unknown customers.
- Modern risk management practice ([ISO 31000:2018](https://www.iso.org/standard/65694.html), techniques in [IEC 31010:2019](https://www.iso.org/standard/72140.html)) provides a defensible structure for a **prospective** engine without implying NHVR FRMS biomathematical certification or EWD approval (see [ADR 0001](./0001-multi-jurisdiction-fatigue-architecture.md)).

## Decision

### 1. Two domains on one timeline (non-overlap rule)

| Domain | Time on timeline | Question |
|--------|------------------|----------|
| **Compliance** | **Past** and **present only as recorded** (minutes already in the attested log) | Did the record breach applicable rules? |
| **Risk analysis** | **Future** only (calendar periods / legs **not yet** represented as logged work) | If the **declared plan** proceeds, what **outcomes** are plausible? |

**Rule:** A given time segment is evaluated as **either** compliance **or** risk — **never both at once**. When a segment becomes present or past in the record, it **exits** risk and **enters** compliance exclusively.

Retrospective data is **input** to risk (rolling headroom, pattern counts). It is **not** re-labelled as “risk” on the same minutes compliance already owns.

**Plan vs actual after the fact** (odometer vs planned km, logged hours vs planned hours) is **retrospective assurance** / corroboration on the **record**, not prospective risk. It may surface in compliance-adjacent warnings or manager assurance copy; it does **not** attach risk scores to past segments.

### 2. Methodology stack (ISO 31000 + IEC 31010)

The risk engine follows the ISO 31000 process; specific techniques are selected from IEC 31010 for a **deterministic, rule-based** product (not full biomathematical FRMS in v1).

| Step | Standard | Circadia implementation |
|------|----------|-------------------------|
| **Establish context & risk criteria** | ISO 31000 §6.3 | Jurisdiction (`jurisdictionCode`), `driverType`, `asOf` (now), evaluation horizon (14d / 28d / 72h per rule pack). **Criteria** = prospective tolerability bands tied to the **same thresholds** as compliance (e.g. 168h, 140h warning, solo 24h-in-14d, 72h/27h) — expressed as **headroom / approach / likely breach if plan holds**, not as signed violations. |
| **Risk identification** | ISO 31000 §6.4.2 | Future days/legs with driver-declared **route label** + optional **planned_distance_km** and/or **planned_on_duty_hours** (at least one of distance or time required for a declared run). |
| **Risk analysis** | ISO 31000 §6.4.3; IEC 31010 **Scenario analysis** | **Baseline:** `complianceStateAt(asOf)` from logged data only. **Scenarios:** apply planned work on **future** segments only; optional **sensitivity** branches (e.g. planned hours ±1–2h, distance ±10–15%). **Light event tree** for multi-day accumulation (day N → N+1 → …). |
| **Risk evaluation** | ISO 31000 §6.4.4; IEC 31010 **semi-quantitative matrix** | **Likelihood** × **consequence** → band per **future segment** (see §4). Compare to risk criteria; output **inherent** risk (plan + history) and **residual** risk (after assuming standard barriers: breaks, end shift, 7h gate, manager roster change). |
| **Risk treatment** | ISO 31000 §6.5; **ALARP** / hierarchy of controls | Manager/driver **coaching** actions (avoid leg, shorten plan, extra rest, delay start). **No** automatic legal violation from risk alone. Document accept/monitor when residual risk remains in amber band. |
| **Monitor & review** | ISO 31000 §6.6 | Recompute when plan or record changes; future segments shrink as days are logged. |

**Bow-tie** language (threat → top event → consequence; preventive / recovery **barriers**) is used in **manager copy** and treatment hints. Existing logging, compliance checks, and start-shift gates are **barriers**; risk shows where **future threats** may defeat them if the plan proceeds.

**Manager UI:** Fleet risk brief includes a collapsible **Prospective risk reference (ISO 31000 / IEC 31010)** library (`src/lib/manager-prospective-risk-reference.ts`), same card layout as the fatigue & assurance reference.

**Explicitly out of scope for v1:** Monte Carlo, FAIR, full FMEA workshops, NHVR-style biomathematical fatigue scores ([FRMSc-style FRMS](https://developers.frmsc.com/)).

### 3. Route / run declaration (driver-first)

Stored on **day JSON** (snapshot at confirm):

| Field | Purpose |
|-------|---------|
| `route_label` | Short name (“Kalgoorlie return”, ad-hoc text) |
| `planned_distance_km` | Optional |
| `planned_on_duty_hours` | Optional |
| `route_source` | `adhoc` \| `driver_saved` \| `org_preset` (optional) |
| `route_preset_id` | Optional, if picked from org catalogue |

**Validation:** `route_label` required when declaring a run; **at least one** of `planned_distance_km` or `planned_on_duty_hours` must be set.

**Optional later:** `RoutePreset` (org), `DriverRouteFavorite`, “recent routes” from prior sheets. **Never** block start shift because the org list is empty.

**UI (driver):** Run plan fields live in **Set up day** dialog. Day card shows **record** (rego, from/to, kms) plus at most **one collapsed “Run plan”** summary line — not a second row of stat blocks (see `.cursor/rules/fatigue-ui-approval.mdc` for material UI changes).

### 4. Risk criteria and matrix scales (prospective)

Scales must be **anchored** (IEC 31010 / practitioner guidance — avoid undefined “high/low”). Example definitions for **WA solo/two-up** (refine in implementation):

**Likelihood** (that the **planned scenario** pushes the driver past a criterion if they follow the plan):

| Level | Definition (example) |
|-------|----------------------|
| 1 Rare | Headroom remains &gt; 24h on 168h after plan, or &gt; 2 qualifying recovery paths on solo 14d |
| 2 Unlikely | Headroom 12–24h or one fragile recovery path |
| 3 Possible | Headroom &lt; 12h or pattern depends on perfect rest |
| 4 Likely | Plan exceeds criterion on one leg with no offsetting rest in scenario |
| 5 Almost certain | Plan plus committed future legs exceed criterion with no mitigation branch |

**Consequence** (if the outcome materialises — **future breach or assurance failure**):

| Level | Definition (example) |
|-------|----------------------|
| 1 Negligible | Monitor only; no rule approach in scenario |
| 2 Minor | Approaches internal warning band (e.g. 140h / 168h) |
| 3 Moderate | Likely regulatory breach on record if plan executed |
| 4 Major | Breach plus weak corroboration (GPS/odo) in scenario narrative |
| 5 Critical | Multiple boundaries (e.g. 168h + solo 14d) in same forward window |

**Risk level** (per **future segment**): `likelihood × consequence` mapped to **low / monitor / elevated / critical** (e.g. 1–6 / 7–14 / 15–20 / 21–25 on a 5×5 grid). Constants live in `src/lib/risk-criteria.ts` (to be added).

**Compliance zero-tolerance** for signed breaches remains separate from **risk appetite** (how tightly the fleet runs before plan revision).

### 5. Software architecture

| Module | Responsibility |
|--------|----------------|
| `compliance.ts` / `runComplianceChecks()` | **Unchanged role:** retrospective only on supplied `historyDays` + weeks; no prospective legs. |
| `compliance-state.ts` (new) | `complianceStateAt(asOf)` — rolling metrics snapshot from **logged** data only. |
| `risk-scenarios.ts` (new) | Apply planned distance/time to **future** segments; scenario + sensitivity branches. |
| `risk-evaluate.ts` (new) | Matrix scoring, criteria comparison, inherent vs residual. |
| `risk-register.ts` (new) | Structured outputs per future segment for API/manager UI. |

**Orchestration:**

- **Driver sheet API:** compliance as today; optional lightweight forward hint (single line) from risk — **no** second violation panel.
- **Manager compliance / risk brief API:** `complianceStateAt(now)` + declared plans on **future days in focus week** → risk register; merge tiers in `manager-risk-scoring.ts` with **compliance violations dominating** attention tier.

**Output shape (per future segment):**

```ts
{
  segmentId: string;       // e.g. YYYY-MM-DD or day index
  scenario: "planned" | "high" | "low";
  likelihood: 1..5;
  consequence: 1..5;
  riskLevel: "low" | "monitor" | "elevated" | "critical";
  outcomes: string[];      // e.g. "168h_warning_if_plan_holds"
  barriers: string[];      // existing + suggested
  residualRiskLevel: ...;
}
```

### 6. Regulatory and product positioning

- Risk outputs are **assurance and planning** — not substitutes for compliance, not NHVR-approved EWD claims, not automated enforcement.
- Criteria and scenarios **derive from the same rule pack** as compliance ([wa-commercial-vehicle-hours.md](../regulatory/wa-commercial-vehicle-hours.md)) to avoid contradictory math.
- Jurisdiction packs (ADR 0001) may supply alternate **risk criteria** when NHVR/HVNL modules exist; until then, WA only.

## Consequences

### Positive

- Clear **temporal boundary** prevents duplicate alarms on the same minutes.
- **ISO-aligned** process supports audit narrative and manager trust.
- **Past + plan** projection surfaces 14d/28d/72h boundaries before they hit the record.
- **Driver-first** route input works for owner-operators and ad-hoc work without customer-specific imports.

### Negative / trade-offs

- Two code paths must stay **mathematically aligned** with compliance (drift risk — shared timeline builders and tests required).
- Matrix scales need **calibration** with real fleets; wrong anchors erode trust.
- Manager UI must not conflate **risk band** with **compliance violation** (copy and colour discipline).
- Optional org route catalogue adds schema/API surface without being required for MVP.

## Non-goals (this ADR)

- Replacing or duplicating `runComplianceChecks()` for future minutes.
- MTS / payroll / roster system integration.
- Biomathematical FRMS certification or circadian modelling.
- Risk scores on **past** days (including “plan vs actual” as risk).
- Manager-only mandatory route builder.

## Implementation order (recommended)

1. ADR accepted + `risk-criteria.ts` scale constants.  
2. `complianceStateAt` + unit tests against known sheets.  
3. Day JSON fields + driver dialog (adhoc route; collapsed summary on card).  
4. `risk-scenarios` / `risk-evaluate` + manager API merge.  
5. Optional `RoutePreset` admin + driver favourites.

## Related

- [0001 Multi-jurisdiction architecture](./0001-multi-jurisdiction-fatigue-architecture.md)  
- [0002 Managed PostgreSQL & data access](./0002-managed-postgres-and-data-access.md)  
- [WA commercial vehicle driver hours](../regulatory/wa-commercial-vehicle-hours.md)  
- [record-retention-and-compliance-lookback.md](../regulatory/record-retention-and-compliance-lookback.md)  
- `src/lib/compliance.ts`, `src/lib/manager-risk-scoring.ts`  
- [ISO 31000:2018](https://www.iso.org/standard/65694.html), [IEC 31010:2019](https://www.iso.org/standard/72140.html)  
- [Australian Government — ISO 31000 process overview (PDF)](https://www.finance.gov.au/sites/default/files/2020-12/Information-Sheet-Overview-Risk-Management-Process.pdf)

## Changelog

| Date | Note |
|------|------|
| 2026-06-02 | Proposed: temporal split; ISO 31000 / IEC 31010 stack; driver-first route; module sketch |
| 2026-06-02 | Accepted |
