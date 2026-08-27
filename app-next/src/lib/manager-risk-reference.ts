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

export type ManagerReferenceLibrary = {
  id: string;
  title: string;
  lastReviewed: string;
  cards: ManagerReferenceCard[];
};

export const MANAGER_REFERENCE_LAST_REVIEWED = "2026-06";

/** Regulations, codes of practice, and industry context — separate from live compliance outcomes. */
export const REGULATORY_REQUIREMENTS_REFERENCE: ManagerReferenceLibrary = {
  id: "regulatory-requirements",
  title: "Regulatory requirements & references",
  lastReviewed: MANAGER_REFERENCE_LAST_REVIEWED,
  cards: [
    {
      id: "wa-184e-hours",
      title: "WA commercial vehicle hours (Reg 184E)",
      summary:
        "Primary time-based rules implemented in Circadia for Western Australia — work diary and break structure.",
      bullets: [
        "Reg 184E(1)(a): Min 20 min of breaks for every 5h of work (maximum 5h continuous work block).",
        "Reg 184E(1)(b): Max 168h work in any 14-day period (48h continuous non-work resets app segments).",
        "Solo 184E(2)(b): ≥2×24h non-work in any 14 days, or the 28-day alternative (4×24h and ≤144h work in any 14 days inside that 28).",
        "Two-up 184E(3): always ≥7h non-work in any 24h (may be moving); then either ≥7h continuous stationary non-work in 48h, or the 7-day package (48h non-work including 24h, no piece under 7h).",
        "Solo Drivers: Min 7h continuous non-work in 24h; min 27h non-work in 72h.",
        "Source mapping: docs/regulatory/wa-commercial-vehicle-hours.md in this product.",
      ],
      relateTo: ["14-day", "28-day", "168", "5-hour", "break"],
    },
    {
      id: "record-retention-hvnl",
      title: "Record retention (WA Reg 184G · HVNL s 341)",
      summary: "How long attested records must be kept — distinct from how far back rule checks load.",
      bullets: [
        `Retention: at least ${RECORD_RETENTION_YEARS} years (WA Reg 184G; HVNL s 341).`,
        `Rule lookback in Circadia: about ${COMPLIANCE_PRIOR_WEEKS_LOOKBACK} prior submitted weeks for rolling 14/28-day math — not a retention standard.`,
        "Roadside produce (~28 days, NHVR work diary context) is what drivers carry; archive retention is separate.",
      ],
      relateTo: ["lookback", "retention"],
    },
    {
      id: "nhvr-cor",
      title: "NHVR · chain of responsibility",
      summary:
        "Heavy Vehicle National Law and CoR — parties in the supply chain owe duties beyond the driver.",
      bullets: [
        "Reasonable steps to manage fatigue risk; records support due diligence but do not replace it.",
        "Align SMS procedures with WorkSafe WA, Main Roads WA (WAHVA), and NHVR interstate guidance.",
        "Circadia compliance outcomes reflect the attested diary; legal interpretation stays with your counsel.",
      ],
    },
    {
      id: "codes-of-practice-industry",
      title: "Codes of practice & industry guidance",
      summary:
        "Non-statutory material commonly used in fatigue programs — coaching context, not automatic breach.",
      bullets: [
        "WorkSafe WA / industry fatigue management guidance on rest, roster design, and verification.",
        "Sleep science: elevated crash risk in early-morning and extended night windows (use for conversation, not blame).",
        "ISO 31000 / IEC 31010: structure for prospective risk (see Risk analysis section) — separate from compliance math.",
      ],
    },
    {
      id: "record-corroboration",
      title: "Record corroboration expectations",
      summary:
        "What investigators and auditors commonly compare to the attested diary.",
      bullets: [
        "Movement during alleged rest, odometer continuity, GPS coverage, witness accounts.",
        "Missing End shift or long open work segments weaken both compliance and incident reviews.",
        "Fix gaps collaboratively; weak records are an assurance problem, not proof of intent.",
      ],
      relateTo: ["movement", "gps", "stationary"],
    },
    {
      id: "enforcement-context",
      title: "Enforcement context (not legal advice)",
      summary:
        "Public prosecution patterns — for leadership education only.",
      bullets: [
        "Cases often involve falsified diaries, systemic pressure to drive tired, or repeat breaches — not isolated honest error.",
        "Use this library for SMS design and manager education; escalate specific matters to legal counsel.",
      ],
    },
  ],
};

export function referenceCardsForMessage(message: string): ManagerReferenceCard[] {
  const lower = message.toLowerCase();
  const out: ManagerReferenceCard[] = [];
  for (const card of REGULATORY_REQUIREMENTS_REFERENCE.cards) {
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
  return out.length ? out : [REGULATORY_REQUIREMENTS_REFERENCE.cards.find((c) => c.id === "record-corroboration")!];
}
