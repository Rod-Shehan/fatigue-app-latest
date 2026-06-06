/**
 * Manager reference: prospective risk engine (ISO 31000 / IEC 31010).
 * Aligns with ADR 0003 — coaching and assurance, not automatic enforcement.
 */

import type { ManagerReferenceCard, ManagerReferenceLibrary } from "@/lib/manager-risk-reference";

export const PROSPECTIVE_RISK_REFERENCE_LAST_REVIEWED = "2026-06";

const CARDS: ManagerReferenceCard[] = [
  {
    id: "iso-31000-process",
    title: "ISO 31000 in Circadia",
    summary:
      "The prospective engine follows the ISO 31000 risk management process — context, identify, analyse, evaluate, treat, monitor — on future work only.",
    bullets: [
      "Context: jurisdiction, driver type, and rolling headroom from the attested record (e.g. 168h, solo 14d/28d).",
      "Identification: driver-declared run plans on future days (route name + expected hours and/or km).",
      "Treatment is coaching (shorten leg, extra rest, delay start) — not a signed breach until work is logged.",
    ],
    relateTo: ["prospective", "run plan", "headroom", "168"],
  },
  {
    id: "iec-31010-techniques",
    title: "IEC 31010 techniques",
    summary:
      "IEC 31010 selects methods for risk analysis. v1 uses scenario analysis and a semi-quantitative matrix — not full probabilistic FRMS modelling.",
    bullets: [
      "Scenario analysis: baseline from logged data, then apply declared plans on future segments only.",
      "Sensitivity: optional high/low branches (e.g. planned hours ±2h) to test fragility.",
      "Likelihood × consequence → low / monitor / elevated / critical per future leg (see risk criteria in code).",
    ],
    relateTo: ["scenario", "likelihood", "elevated", "critical", "monitor"],
  },
  {
    id: "compliance-vs-risk",
    title: "Compliance vs prospective risk",
    summary:
      "A minute on the timeline is either retrospective compliance or forward-looking risk — never both. This keeps violations and coaching separate.",
    bullets: [
      "Compliance: past and present as recorded (work, break, non-work, events, kms).",
      "Risk: future calendar segments with a declared run plan before they are logged.",
      "When a day is logged, it leaves risk and enters compliance only — plan vs actual gaps are assurance on the record.",
    ],
    relateTo: ["violation", "compliance", "prospective"],
  },
  {
    id: "barriers-bow-tie",
    title: "Barriers & bow-tie thinking",
    summary:
      "Bow-tie language links threats, top events, and consequences. Logging, End shift, breaks, and start-shift gates are barriers the register tests.",
    bullets: [
      "Preventive barriers: rest before a long leg, realistic run plans, manager roster changes.",
      "Recovery barriers: End shift, 7h non-work gates, driver “mark non-work from now” when they forgot to end.",
      "Residual risk assumes standard barriers hold; if not, conversation — not automatic discipline.",
    ],
    relateTo: ["barrier", "end shift", "recovery"],
  },
  {
    id: "out-of-scope",
    title: "What this engine is not",
    summary:
      "Circadia’s FRMS glance (Python TPMA when enabled) and legacy sawtooth chart are assurance and coaching — not NHVR FRMSc certification, legal advice, or regulator approval.",
    bullets: [
      "With FRMS enabled, the register and risk chart use the peer-reviewed Three-Process Model (S/C/W); legacy sawtooth applies only when FRMS is off or the cache is empty.",
      "Not an EWD or NHVR product approval claim — see ADR 0001 for jurisdiction architecture.",
      "Elevated exposure on the brief is a composite glance; violations on the record still dominate “needs attention”.",
    ],
    relateTo: ["frms", "nhvr", "ewd"],
  },
  {
    id: "manager-use",
    title: "Using the register with drivers",
    summary:
      "Risk outputs attach to future legs with run plans. Use them to steer before the week is signed, alongside compliance warnings.",
    bullets: [
      "Unsigned weeks and thin GPS remain monitor-tier signals — not the same as a prospective elevated leg.",
      "Discuss plans early: “If you run this leg as declared, headroom on 168h looks tight.”",
      "Document outreach and agreed changes; risk levels should fall when plans or rest change.",
    ],
    relateTo: ["unsigned", "gps", "register"],
  },
];

export const PROSPECTIVE_RISK_REFERENCE: ManagerReferenceLibrary = {
  id: "prospective-risk",
  title: "Risk Reference",
  lastReviewed: PROSPECTIVE_RISK_REFERENCE_LAST_REVIEWED,
  cards: CARDS,
};

export function prospectiveReferenceCardsForMessage(message: string): ManagerReferenceCard[] {
  const lower = message.toLowerCase();
  const out: ManagerReferenceCard[] = [];
  for (const card of CARDS) {
    if (!card.relateTo?.length) continue;
    const hit = card.relateTo.some((key) => lower.includes(key));
    if (hit) out.push(card);
  }
  return out.length ? out : [CARDS.find((c) => c.id === "compliance-vs-risk")!];
}
