/**
 * Verified distraction (F3) trigger reasons — aliases unified triage-trigger-reasons catalog.
 */

import {
  TRIAGE_TRIGGER_REASONS,
  normalizeTriageTriggerReasons,
  requireTriageTriggerReasons,
  triageTriggerReasonLabels,
  type TriageTriggerReasonId,
} from "@/lib/triage-trigger-reasons";

export const VERIFIED_DISTRACTION_REASONS = TRIAGE_TRIGGER_REASONS;

export type VerifiedDistractionReasonId = TriageTriggerReasonId;

export const VERIFIED_DISTRACTION_ACTION_TYPE = "verified_distraction" as const;

export const normalizeVerifiedDistractionReasons = normalizeTriageTriggerReasons;
export const verifiedDistractionReasonLabels = triageTriggerReasonLabels;

export function formatVerifiedDistractionReasonsForNote(
  reasons: readonly VerifiedDistractionReasonId[],
  freeNote?: string | null
): string {
  const labels = verifiedDistractionReasonLabels(reasons);
  const parts: string[] = ["Verified distraction"];
  if (labels.length > 0) {
    parts.push(`Trigger: ${labels.join(", ")}`);
  }
  const trimmed = freeNote?.trim();
  if (trimmed) parts.push(trimmed);
  return parts.join(" — ");
}

export function requireVerifiedDistractionReasons(raw: unknown): VerifiedDistractionReasonId[] {
  return requireTriageTriggerReasons(raw, "VERIFIED_DISTRACTION_REASONS_REQUIRED");
}
