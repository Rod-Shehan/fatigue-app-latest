/**
 * Checklist form kit types (Phase 1 — no persistence).
 * Full records land in Phase 2.
 */

export type ChecklistItemValue = "unselected" | "pass" | "fail" | "na";

export type ChecklistAcknowledgeValue = "unselected" | "acknowledged";

export type ChecklistDefect = {
  description: string;
  /** Optional photo data URLs (Phase 1 local only). */
  photoDataUrls: string[];
  unsafeToDrive: boolean;
};

export type ChecklistPassFailItemState = {
  value: ChecklistItemValue;
  defect: ChecklistDefect | null;
};

export type ChecklistAcknowledgeItemState = {
  value: ChecklistAcknowledgeValue;
};

export type ChecklistSignatureCapture = {
  pngDataUrl: string;
  signedAtUtc: string;
  signedAtAwst: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
};

export type ChecklistSchemaItem = {
  code: string;
  label: string;
};

/**
 * Prestart-style group: the group itself is Pass / Fail / N/A;
 * `notes` are checklist prompts under the heading (not separately scored).
 */
export type ChecklistSchemaGroup = {
  code: string;
  label: string;
  notes: string[];
};

export function emptyDefect(): ChecklistDefect {
  return { description: "", photoDataUrls: [], unsafeToDrive: false };
}

export function emptyPassFailItem(): ChecklistPassFailItemState {
  return { value: "unselected", defect: null };
}

export function emptyAcknowledgeItem(): ChecklistAcknowledgeItemState {
  return { value: "unselected" };
}
