/**
 * Dismiss (F1) trigger reasons — aliases unified triage-trigger-reasons catalog.
 */

import {
  TRIAGE_TRIGGER_REASONS,
  formatTriageTriggerReasonsForNote,
  normalizeTriageTriggerReasons,
  requireTriageTriggerReasons,
  triageTriggerReasonLabels,
  type TriageTriggerReasonId,
} from "@/lib/triage-trigger-reasons";

export const FALSE_POSITIVE_REASONS = TRIAGE_TRIGGER_REASONS;

export type FalsePositiveReasonId = TriageTriggerReasonId;

export const normalizeFalsePositiveReasons = normalizeTriageTriggerReasons;
export const falsePositiveReasonLabels = triageTriggerReasonLabels;

export function formatFalsePositiveReasonsForNote(
  reasons: readonly FalsePositiveReasonId[],
  freeNote?: string | null
): string | null {
  return formatTriageTriggerReasonsForNote(reasons, freeNote);
}

export function requireFalsePositiveReasonsForDismiss(
  action: string,
  raw: unknown
): FalsePositiveReasonId[] {
  if (action !== "VERIFIED_FALSE_POSITIVE") return [];
  return requireTriageTriggerReasons(raw, "FALSE_POSITIVE_REASONS_REQUIRED");
}
