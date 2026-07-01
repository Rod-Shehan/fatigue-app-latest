/**
 * Normalised false-positive trigger reasons for DSM fatigue/distraction dismissals.
 * Stable ids map to fixed export column headers for spreadsheet analysis.
 */

export const FALSE_POSITIVE_REASONS = [
  {
    id: "driver_looking_left",
    label: "Driver looking left",
    exportHeader: "driver looking left",
  },
  {
    id: "driver_looking_right",
    label: "Driver looking right",
    exportHeader: "driver looking right",
  },
  {
    id: "driver_looking_down",
    label: "Driver looking down",
    exportHeader: "driver looking down",
  },
  {
    id: "driver_looking_up",
    label: "Driver looking up",
    exportHeader: "driver looking up",
  },
  {
    id: "hand_over_face",
    label: "Hand over face",
    exportHeader: "hand over face",
  },
  {
    id: "undetermined",
    label: "Undetermined",
    exportHeader: "undetermined",
  },
] as const;

export type FalsePositiveReasonId = (typeof FALSE_POSITIVE_REASONS)[number]["id"];

const REASON_ID_SET = new Set<string>(FALSE_POSITIVE_REASONS.map((r) => r.id));

export function isFalsePositiveReasonId(value: string): value is FalsePositiveReasonId {
  return REASON_ID_SET.has(value);
}

/** Parse and dedupe stored JSON / API payload into canonical reason ids. */
export function normalizeFalsePositiveReasons(raw: unknown): FalsePositiveReasonId[] {
  if (!Array.isArray(raw)) return [];
  const out: FalsePositiveReasonId[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!isFalsePositiveReasonId(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function falsePositiveReasonLabels(ids: readonly FalsePositiveReasonId[]): string[] {
  const labels: string[] = [];
  for (const id of ids) {
    const label = FALSE_POSITIVE_REASONS.find((r) => r.id === id)?.label;
    if (label) labels.push(label);
  }
  return labels;
}

export function formatFalsePositiveReasonsForNote(
  reasons: readonly FalsePositiveReasonId[],
  freeNote?: string | null
): string | null {
  const labels = falsePositiveReasonLabels(reasons);
  const parts: string[] = [];
  if (labels.length > 0) {
    parts.push(`Trigger: ${labels.join(", ")}`);
  }
  const trimmed = freeNote?.trim();
  if (trimmed) parts.push(trimmed);
  return parts.length > 0 ? parts.join(" — ") : null;
}

export function requireFalsePositiveReasonsForDismiss(
  decision: "authorized" | "dismissed",
  raw: unknown
): FalsePositiveReasonId[] {
  if (decision !== "dismissed") return [];
  const reasons = normalizeFalsePositiveReasons(raw);
  if (reasons.length === 0) {
    throw new Error("FALSE_POSITIVE_REASONS_REQUIRED");
  }
  return reasons;
}
