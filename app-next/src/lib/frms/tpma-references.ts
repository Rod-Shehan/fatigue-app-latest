/**
 * TPMA (Three-Process Model of Alertness) references for manager risk timeline.
 * Aligned with frms-engine frms-py-2 dual-layer — assurance only, not NHVR FRMSc.
 */

import { DRIVER_NAP_QUESTION_LABEL } from "@/lib/product-copy";

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
    "Two diary lines: teal is sleep / biological (nap and End-shift sleep). Grey is combined risk, which sits on or above that floor because of task strain. Awake Rest closes the gap; sleep lowers both. Prospective assurance only — not a compliance score.",
  baseline: {
    title: "Sleep / biological (teal) and combined risk (grey)",
    summary:
      "Teal is the TPMA floor — it moves when they sleep (inferred after End shift, or a nap tag). Grey is that floor plus acute task strain from driving and other work. A Start Rest dumps strain: grey steps down toward teal, teal stays put. That is the control measure working for a break.",
    factors: [
      `Process S — homeostatic sleep pressure: rises during work and other work. Awake Rest and converted long Rest hold S flat. Main sleep is inferred in End-shift non-work (7 h sleep, 30 min travel each way, remaining home) — not a driver tap. An in-shift nap is tagged only if the driver answers ${DRIVER_NAP_QUESTION_LABEL} on Rest.`,
      "Process C — two-harmonic circadian alertness (Folkard & Akerstedt): afternoon dip and deep circadian nadir",
      "Process W — sleep inertia after inferred main sleep or a nap tag, once they are back on duty. The last 30 min of an off-duty bout is commute, so inertia has usually worn off before Start driving.",
      "Task-strain index — charges while driving/loading; a 20-minute awake Rest clears about two-thirds of acute strain. This is the visible downward sawtooth on breaks.",
      "Progressive compression — continuous on-duty legs tracked for 5.5 h / 7 h / 10 h coaching thresholds",
      "Driver self-reported alertness (1–5 from Set up day) — subjective impairment bump on all blocks that calendar day",
    ],
    mapping:
      "Grey cannot fall below teal. Rest cannot repay sleep debt. Nap / inferred main sleep lowers teal (and grey follows). Bands on combined risk: low ≤35%, monitor ≤54%, elevated ≤74%, critical ≥75%.",
    horizon:
      "Computed for past and future 15-minute blocks from attested sheets so you can see the expected trajectory; future segments use declared diary context where the app has it.",
  },
  live: {
    title: "Live risk (coloured line and dots)",
    summary:
      "Observed impairment for blocks up to right now — TPMA combined score when no device block exists; cab-camera fusion when a DriverRiskBlock is stored.",
    factors: [
      "Same TPMA diary trajectory (including self-reported alertness) as the baseline for blocks without camera ingest",
      "When connected: drowsiness, distraction, eyes-off-road, and coverage-weighted camera metrics overlay the observed live line; diary alertness is merged from the day card on upload",
    ],
    horizon:
      "Filled for blocks up to right now; later blocks appear as diary context and device data arrive (or in demo controls when FRMS cache is empty).",
  },
  shaded:
    "Amber shading marks intervals where live risk sits above the grey combined line.",
  referencesNote:
    "TPMA dual-layer (frms-py-2): biological floor plus task-strain overlay. Assurance coaching only — not statutory compliance verdicts.",
} as const;
