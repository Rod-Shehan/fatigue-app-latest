# Fatigue risk sawtooth model (manager timeline)

## Purpose

The manager **risk at a glance** chart must reflect that **mandated breaks and rest reduce fatigue risk** between work bouts — a **sawtooth** pattern, not a smooth climb.

This is **prospective assurance** (ADR 0003), not compliance scoring and not NHVR biomathematical FRMS.

## Theory (cited)

| Source | Role in v1 model |
|--------|------------------|
| **Borbély (1982)** — two-process sleep regulation | Homeostatic pressure (Process S) rises with wake/work, falls with sleep/rest; circadian (Process C) modulates slowly. |
| **Williamson & Lombardi (2015)** — driving hours vs crash risk | Continuous time-on-task increases relative risk; modelled as carry saturation over ~5 h. |
| **Dawson et al. (2001)** — countermeasures to fatigue | Rest breaks reduce fatigue-related risk between work periods. |
| **WA Reg 184E(1)(a)** | Product alignment: breaks per 5 h work (≥20 min incl. ≥10 min after 5 h). Demo uses 2 h work + 15 min break cycles for visible sawteeth. |

Constants and functions: `src/lib/fatigue-risk-carry.ts` (`FATIGUE_RISK_REFERENCES`).

## Implementation

### Stateful carry (0–1)

Per 15-minute block:

1. **Work** — carry increases by `workMinutes / 300` (saturates at 1 ≈ 5 h continuous work).
2. **Break ≥15 min** — carry × `0.4` (~60% relief).
3. **Rest ≥30 min / non-work** — carry × `0.12` (~88% relief).

### Composite score

`compositeFatigueIndex()` in `manager-risk-timeline.ts`:

- **42%** time-on-task carry (primary sawtooth driver)
- **18%** circadian (normalised two-process-style curve)
- **14%** rolling 14-day work proxy (slow background)
- **10%** current-block work minutes
- **6%** plan deviation (live only; zero on baseline)
- Camera term when present (reduces diary weights)

Then: z-score with `DEFAULT_RISK_INDEX_STATS` → logistic → 0–100%.

### Demo timeline

`buildDemoRiskTimelineSeries()` walks blocks with **8×15 min work + 1×15 min break** cycles so the grey baseline visibly sawtooths.

### Server / diary

When only single-block diary fields exist, `inferCarryFromDiaryProxies()` uses `minutes_since_break` plus inferred recovery from zero work minutes. Full sawtooth accuracy improves when diary supplies sequential context per block.

## Related

- [ADR 0003](../adr/0003-prospective-risk-engine.md)
- [camera-risk-stream.md](./camera-risk-stream.md)
- [WA commercial vehicle hours](../regulatory/wa-commercial-vehicle-hours.md)
