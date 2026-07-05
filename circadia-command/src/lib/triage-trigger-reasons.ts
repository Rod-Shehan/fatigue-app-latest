/**
 * Unified Autonomise triage trigger categories — keep in sync with
 * app-next/src/lib/integrations/triage-trigger-reasons.ts
 */

export const TRIAGE_TRIGGER_REASONS = [
  {
    id: "driver_looking_left_mirror",
    label: "Driver looking in left mirror",
    exportHeader: "driver looking in left mirror",
  },
  {
    id: "driver_looking_right_mirror",
    label: "Driver looking in right mirror",
    exportHeader: "driver looking in right mirror",
  },
  {
    id: "driver_looking_down_at_dash",
    label: "Driver looking down at dash",
    exportHeader: "driver looking down at dash",
  },
  {
    id: "driver_looking_up_at_two_way_radio",
    label: "Driver looking up at two way radio",
    exportHeader: "driver looking up at two way radio",
  },
  {
    id: "hand_near_face",
    label: "Hand near face",
    exportHeader: "hand near face",
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
    id: "reaching_behind",
    label: "Reaching behind",
    exportHeader: "reaching behind",
  },
  {
    id: "reaching_over",
    label: "Reaching over",
    exportHeader: "reaching over",
  },
  {
    id: "sitting_forward_camera_angle",
    label: "Sitting forward (camera angle)",
    exportHeader: "sitting forward (camera angle)",
  },
  {
    id: "sitting_to_one_side_camera_angle",
    label: "Sitting to one side (camera angle)",
    exportHeader: "sitting to one side (camera angle)",
  },
  {
    id: "eating",
    label: "Eating",
    exportHeader: "eating",
  },
  {
    id: "paperwork_completing",
    label: "Paperwork - completing",
    exportHeader: "paperwork - completing",
  },
  {
    id: "paperwork_reading",
    label: "Paperwork - reading",
    exportHeader: "paperwork - reading",
  },
  {
    id: "unknown_cause",
    label: "Unknown cause",
    exportHeader: "unknown cause",
  },
  {
    id: "other",
    label: "Other (write below)",
    exportHeader: "other",
  },
] as const;

export type TriageTriggerReasonId = (typeof TRIAGE_TRIGGER_REASONS)[number]["id"];

export const TRIAGE_TRIGGER_OTHER_REASON_ID: TriageTriggerReasonId = "other";

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

export function triageTriggerReasonRequiresFreeNote(reasons: readonly TriageTriggerReasonId[]): boolean {
  return reasons.includes(TRIAGE_TRIGGER_OTHER_REASON_ID);
}

export function assertTriageTriggerFreeNoteWhenRequired(
  reasons: readonly TriageTriggerReasonId[],
  freeNote?: string | null
): void {
  if (triageTriggerReasonRequiresFreeNote(reasons) && !freeNote?.trim()) {
    throw new Error("TRIAGE_TRIGGER_FREE_NOTE_REQUIRED");
  }
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
