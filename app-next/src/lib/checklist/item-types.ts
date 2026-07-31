/**
 * Checklist form kit types (Phase 1 — no persistence).
 * Full records land in Phase 2.
 */

export type ChecklistItemValue = "unselected" | "pass" | "fail" | "na";

export type ChecklistAcknowledgeValue = "unselected" | "acknowledged";

/** Fault driveability choice (exclusive). */
export type ChecklistFaultMobility = "can_drive" | "need_advice" | "cannot_move";

export const CHECKLIST_FAULT_MOBILITY_OPTIONS: {
  value: ChecklistFaultMobility;
  label: string;
}[] = [
  { value: "can_drive", label: "Vehicle can still be driven" },
  { value: "need_advice", label: "Need advice to move" },
  { value: "cannot_move", label: "Can not be moved/unroadworthy" },
];

export function checklistFaultMobilityLabel(
  status: ChecklistFaultMobility | null | undefined
): string | null {
  if (!status) return null;
  return CHECKLIST_FAULT_MOBILITY_OPTIONS.find((o) => o.value === status)?.label ?? null;
}

export type ChecklistDefect = {
  description: string;
  /** Optional photo data URLs (Phase 1 local only). */
  photoDataUrls: string[];
  /** Required when Fault is selected. */
  mobilityStatus: ChecklistFaultMobility | null;
  /**
   * Legacy boolean from early builds — prefer mobilityStatus.
   * If present without mobilityStatus, treat true as cannot_move.
   */
  unsafeToDrive?: boolean;
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
  return { description: "", photoDataUrls: [], mobilityStatus: null };
}

/** Normalize legacy unsafeToDrive into mobilityStatus. */
export function normalizeDefect(defect: ChecklistDefect): ChecklistDefect {
  if (defect.mobilityStatus) {
    return { ...defect, unsafeToDrive: undefined };
  }
  if (defect.unsafeToDrive === true) {
    return { ...defect, mobilityStatus: "cannot_move", unsafeToDrive: undefined };
  }
  if (defect.unsafeToDrive === false) {
    return { ...defect, mobilityStatus: null, unsafeToDrive: undefined };
  }
  return defect;
}

export function emptyPassFailItem(): ChecklistPassFailItemState {
  return { value: "unselected", defect: null };
}

export function emptyAcknowledgeItem(): ChecklistAcknowledgeItemState {
  return { value: "unselected" };
}
