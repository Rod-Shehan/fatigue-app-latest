/**
 * Curated reference cards for managers — education and assurance context.
 * Not legal advice; review periodically and align with your safety management system.
 */

import { COMPLIANCE_PRIOR_WEEKS_LOOKBACK } from "@/lib/compliance-history";
import { RECORD_RETENTION_YEARS } from "@/lib/record-retention";

export type ManagerReferenceCard = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  /** Rule IDs or keywords to surface "why this matters" on matching assurance lines */
  relateTo?: string[];
};

export const MANAGER_REFERENCE_LAST_REVIEWED = "2026-06";

export const MANAGER_REFERENCE_CARDS: ManagerReferenceCard[] = [
  {
    id: "record-retention-vs-lookback",
    title: "Retention vs rule lookback",
    summary:
      "How long you must keep records is not the same as how far back the app scans for 14–28 day fatigue rules.",
    bullets: [
      `Legal retention: at least ${RECORD_RETENTION_YEARS} years from the last entry (WA Reg 184G) or from when the record was made (HVNL s 341).`,
      `Rule lookback: Circadia loads about ${COMPLIANCE_PRIOR_WEEKS_LOOKBACK} prior weeks of submitted sheets when evaluating rolling limits — an engineering window, not a retention standard.`,
      "Roadside produce (~28 days in a work diary) is a third horizon: what a driver carries, not how long the operator archives records.",
    ],
    relateTo: ["14-day", "28-day", "168", "lookback"],
  },
  {
    id: "cor-assurance",
    title: "Chain of responsibility & assurance",
    summary:
      "Under Australia's heavy vehicle framework, parties in the supply chain can have duties beyond the driver. Good records support due diligence — they do not replace it.",
    bullets: [
      "Focus on whether your organisation took reasonable steps to manage fatigue risk, not only whether a box was ticked.",
      "Unsigned or weakly corroborated weeks are assurance gaps: you may not be able to rely on them after an incident.",
      "Conversations and roster changes are controls; the app surfaces exposure so you can act early.",
    ],
  },
  {
    id: "circadian-science",
    title: "When fatigue likelihood rises",
    summary:
      "Sleep science and transport incident patterns align on certain windows — use them to prioritise conversations, not to blame individuals.",
    bullets: [
      "Highest general risk: roughly 02:00–06:00 and extended night driving.",
      "Cumulative factors: hours awake, short non-work between shifts, consecutive long days.",
      "Your rolling work/rest timeline in Circadia reflects exposure; weekly sheets are the attestation slice.",
    ],
  },
  {
    id: "record-corroboration",
    title: "Record strength & investigators",
    summary:
      "After serious incidents, investigators often compare stated rest with movement, odometer, and witness accounts.",
    bullets: [
      "GPS coverage and movement during alleged rest are corroboration signals — gaps invite questions.",
      "Missing End shift or long open work segments create uncertainty in both compliance and safety reviews.",
      "Treat weak records as a risk to fix collaboratively with the driver, not as automatic guilt.",
    ],
    relateTo: ["movement", "gps", "stationary"],
  },
  {
    id: "enforcement-context",
    title: "Enforcement & prosecutions (context only)",
    summary:
      "Regulators and courts have pursued fatigue-related breaches where records were false, incomplete, or systemic pressure ignored rest.",
    bullets: [
      "Examples in public reports often involve falsified diaries, pressure to drive tired, or repeat systemic breaches — not a single honest mistake.",
      "This app helps you see exposure early; it does not predict enforcement outcomes for any person.",
      "Use reference material for leadership education and SMS design — escalate to legal counsel for specific matters.",
    ],
  },
  {
    id: "just-culture",
    title: "Just culture conversations",
    summary:
      "Modern safety programs separate honest human error from reckless or wilful disregard.",
    bullets: [
      "Ask what blocked rest: traffic, roster, equipment, life events — before assuming non-compliance.",
      "Document manager outreach and agreed actions; the record supports learning loops.",
      "Reserve formal discipline for patterns or deliberate falsification, guided by your HR/legal policies.",
    ],
  },
];

export function referenceCardsForMessage(message: string): ManagerReferenceCard[] {
  const lower = message.toLowerCase();
  const out: ManagerReferenceCard[] = [];
  for (const card of MANAGER_REFERENCE_CARDS) {
    if (!card.relateTo?.length) continue;
    const hit =
      (lower.includes("movement") && card.relateTo.includes("movement")) ||
      (lower.includes("gps") && card.relateTo.includes("gps")) ||
      (lower.includes("stationary") && card.relateTo.includes("stationary")) ||
      (lower.includes("14-day") && card.relateTo.includes("14-day")) ||
      (lower.includes("28-day") && card.relateTo.includes("28-day")) ||
      (lower.includes("168") && card.relateTo.includes("168")) ||
      (lower.includes("lookback") && card.relateTo.includes("lookback"));
    if (hit) out.push(card);
  }
  return out.length ? out : [MANAGER_REFERENCE_CARDS.find((c) => c.id === "record-corroboration")!];
}
