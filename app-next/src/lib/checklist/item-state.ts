/**
 * Pure item state machine for Pass / Fail / N/A and FFW acknowledge.
 * Presentation only — no compliance rule IP.
 */

import type {
  ChecklistAcknowledgeItemState,
  ChecklistAcknowledgeValue,
  ChecklistDefect,
  ChecklistItemValue,
  ChecklistPassFailItemState,
} from "./item-types";
import {
  checklistFaultMobilityLabel,
  emptyDefect,
  normalizeDefect,
} from "./item-types";

/** Standard single-tap from Unselected → Pass (scope F1). */
export function tapPassFailItem(current: ChecklistItemValue): ChecklistItemValue {
  if (current === "unselected") return "pass";
  return current;
}

export function setPassFailValue(
  state: ChecklistPassFailItemState,
  value: ChecklistItemValue
): ChecklistPassFailItemState {
  if (value === "fail") {
    return {
      value: "fail",
      defect: state.defect ? normalizeDefect(state.defect) : emptyDefect(),
    };
  }
  return { value, defect: null };
}

export function updateDefect(
  state: ChecklistPassFailItemState,
  patch: Partial<ChecklistDefect>
): ChecklistPassFailItemState {
  if (state.value !== "fail") return state;
  const base = normalizeDefect(state.defect ?? emptyDefect());
  return {
    value: "fail",
    defect: normalizeDefect({ ...base, ...patch }),
  };
}

/** Fault requires description + driveability choice. */
export function isPassFailItemComplete(state: ChecklistPassFailItemState): boolean {
  if (state.value === "unselected") return false;
  if (state.value === "fail") {
    const d = state.defect ? normalizeDefect(state.defect) : null;
    return Boolean(d?.description?.trim() && d.mobilityStatus);
  }
  return state.value === "pass" || state.value === "na";
}

/** Unroadworthy / cannot be moved. */
export function isPassFailItemUnsafe(state: ChecklistPassFailItemState): boolean {
  if (state.value !== "fail" || !state.defect) return false;
  const d = normalizeDefect(state.defect);
  return d.mobilityStatus === "cannot_move";
}

/**
 * Draft workshop email body from Prestart Fault groups (editable before sign).
 */
export function buildPrestartActionedFaultDraft(
  items: Record<string, ChecklistPassFailItemState>,
  groups: { code: string; label: string }[]
): string {
  const lines: string[] = [];
  for (const group of groups) {
    const state = items[group.code];
    if (!state || state.value !== "fail") continue;
    const d = state.defect ? normalizeDefect(state.defect) : null;
    const desc = d?.description?.trim() || "(no description yet)";
    const mobility = checklistFaultMobilityLabel(d?.mobilityStatus);
    const suffix = mobility ? ` — ${mobility}` : "";
    lines.push(`${group.label}: ${desc}${suffix}`);
  }
  return lines.join("\n");
}

export function setAcknowledgeValue(
  _state: ChecklistAcknowledgeItemState,
  value: ChecklistAcknowledgeValue
): ChecklistAcknowledgeItemState {
  return { value };
}

export function toggleAcknowledge(
  state: ChecklistAcknowledgeItemState
): ChecklistAcknowledgeItemState {
  return {
    value: state.value === "acknowledged" ? "unselected" : "acknowledged",
  };
}

export function isAcknowledgeItemComplete(state: ChecklistAcknowledgeItemState): boolean {
  return state.value === "acknowledged";
}
