/**
 * TPMA (Three-Process Model of Alertness) references for manager risk timeline.
 * Aligned with frms-engine/app/math_engine.py — assurance only, not NHVR FRMSc.
 */

export const FRMS_TPMA_REFERENCES = [
  {
    id: "akerstedt-folkard-1990",
    citation:
      "Åkerstedt T, Folkard S (1990). The three-process model of alertness and its extension to performance, sleep latency, and sleep length. Chronobiol Int.",
    use: "Process S (homeostatic sleep pressure), Process W (sleep inertia), and net alertness capacity C − S − W.",
  },
  {
    id: "van-dongen-2003",
    citation:
      "Van Dongen HPA et al. (2003). The cumulative cost of additional wakefulness: dose–response effects on neurobehavioral functions and sleep physiology. Sleep.",
    use: "Homeostatic depletion during sustained wake/work (Process S dynamics).",
  },
  {
    id: "folkard-akerstedt-1992",
    citation:
      "Folkard S, Akerstedt T (1992). A three-process model of the sleep–wakeiness regulator. Sleep.",
    use: "Two-harmonic circadian alertness drive (Process C) — afternoon dip and early-morning nadir.",
  },
  {
    id: "dawson-reid-1997",
    citation:
      "Dawson D, Reid K (1997). Fatigue, alcohol and performance impairment. Nature.",
    use: "Coaching bands at ~0.05% and ~0.10% BAC equivalence (7 h / 10 h continuous work thresholds).",
  },
  {
    id: "wa-184e",
    citation: "WA WHS (General) Reg 2022 reg 184E(1)(a) — breaks per 5 h work.",
    use: "Diary rest/work classification input — product alignment, not biomath certification.",
  },
] as const;

/** In-app explanation when chart is fed by FrmsRiskSnapshot (Python TPMA). */
export const FRMS_RISK_TIMELINE_CHART_HELP = {
  intro:
    "Each 15-minute block gets a 0–100% TPMA impairment score from the Python FRMS engine. Prospective assurance only — not a compliance breach score, fleet average, or NHVR FRMSc certification.",
  baseline: {
    title: "Expected baseline (grey line)",
    summary:
      "Three-Process Model (TPMA) impairment from the driver’s logged diary timeline — work, rest, and break blocks across the horizon. No cab camera in this curve.",
    factors: [
      "Process S — homeostatic sleep pressure: rises during work/wake (dynamic χ_w with progressive workload μ), falls during rest with daytime and heat/cold modifiers",
      "Process C — two-harmonic circadian alertness (Folkard & Akerstedt): afternoon dip and deep circadian nadir",
      "Process W — sleep inertia on waking after qualifying rest",
      "Progressive compression — continuous on-duty legs tracked for 5.5 h / 7 h / 10 h coaching thresholds",
    ],
    mapping:
      "Net alertness capacity C − S − W is mapped to 0–100% impairment (higher = higher fatigue risk). Bands: low ≤35%, monitor ≤54%, elevated ≤74%, critical ≥75%.",
    horizon:
      "Computed for past and future 15-minute blocks from attested sheets so you can see the expected trajectory; future segments use declared diary context where the app has it.",
  },
  live: {
    title: "Live risk (coloured line and dots)",
    summary:
      "Observed impairment for blocks up to right now — TPMA combined score when no device block exists; cab-camera fusion when a DriverRiskBlock is stored.",
    factors: [
      "Same TPMA diary trajectory as the baseline for blocks without camera ingest",
      "When connected: drowsiness, distraction, eyes-off-road, and coverage-weighted camera metrics overlay the observed live line",
    ],
    horizon:
      "Filled for blocks up to right now; later blocks appear as diary context and device data arrive (or in demo controls when FRMS cache is empty).",
  },
  shaded:
    "Amber shading marks intervals where live risk sits above the expected baseline for that block.",
  referencesNote:
    "TPMA constants and progressive thresholds are implemented in frms-engine (frms-py-1). Assurance coaching only — not statutory compliance verdicts.",
} as const;
