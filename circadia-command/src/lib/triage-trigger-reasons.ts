/**
 * Unified Autonomise triage trigger categories — keep in sync with
 * app-next/src/lib/integrations/triage-trigger-reasons.ts
 */

export const TRIAGE_TRIGGER_REASONS = [
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
    id: "mobile_phone_use",
    label: "Mobile phone use",
    exportHeader: "mobile phone use",
  },
  {
    id: "eating",
    label: "Eating",
    exportHeader: "eating",
  },
  {
    id: "paperwork",
    label: "Paperwork",
    exportHeader: "paperwork",
  },
  {
    id: "undetermined",
    label: "Undetermined",
    exportHeader: "undetermined",
  },
] as const;

export type TriageTriggerReasonId = (typeof TRIAGE_TRIGGER_REASONS)[number]["id"];

const REASON_ID_SET = new Set<string>(TRIAGE_TRIGGER_REASONS.map((r) => r.id));

export function isTriageTriggerReasonId(value: string): value is TriageTriggerReasonId {
  return REASON_ID_SET.has(value);
}

export function normalizeTriageTriggerReasons(raw: unknown): TriageTriggerReasonId[] {
  if (!Array.isArray(raw)) return [];
  const out: TriageTriggerReasonId[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!isTriageTriggerReasonId(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function triageTriggerReasonLabels(ids: readonly TriageTriggerReasonId[]): string[] {
  const labels: string[] = [];
  for (const id of ids) {
    const label = TRIAGE_TRIGGER_REASONS.find((r) => r.id === id)?.label;
    if (label) labels.push(label);
  }
  return labels;
}

export function formatTriageTriggerReasonsForNote(
  reasons: readonly TriageTriggerReasonId[],
  freeNote?: string | null,
  prefix = "Trigger"
): string | null {
  const labels = triageTriggerReasonLabels(reasons);
  const parts: string[] = [];
  if (labels.length > 0) {
    parts.push(`${prefix}: ${labels.join(", ")}`);
  }
  const trimmed = freeNote?.trim();
  if (trimmed) parts.push(trimmed);
  return parts.length > 0 ? parts.join(" — ") : null;
}

export function requireTriageTriggerReasons(
  raw: unknown,
  errorCode = "TRIAGE_TRIGGER_REASONS_REQUIRED"
): TriageTriggerReasonId[] {
  const reasons = normalizeTriageTriggerReasons(raw);
  if (reasons.length === 0) {
    throw new Error(errorCode);
  }
  return reasons;
}
