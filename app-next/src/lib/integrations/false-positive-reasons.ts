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
} from "@/lib/integrations/triage-trigger-reasons";

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
  decision: "authorized" | "dismissed",
  raw: unknown
): FalsePositiveReasonId[] {
  if (decision !== "dismissed") return [];
  return requireTriageTriggerReasons(raw, "FALSE_POSITIVE_REASONS_REQUIRED");
}
