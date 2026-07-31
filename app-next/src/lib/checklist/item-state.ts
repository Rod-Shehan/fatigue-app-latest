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
import { emptyDefect } from "./item-types";

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
      defect: state.defect ?? emptyDefect(),
    };
  }
  return { value, defect: null };
}

export function updateDefect(
  state: ChecklistPassFailItemState,
  patch: Partial<ChecklistDefect>
): ChecklistPassFailItemState {
  if (state.value !== "fail") return state;
  const base = state.defect ?? emptyDefect();
  return {
    value: "fail",
    defect: { ...base, ...patch },
  };
}

/** FAIL requires non-empty defect description. */
export function isPassFailItemComplete(state: ChecklistPassFailItemState): boolean {
  if (state.value === "unselected") return false;
  if (state.value === "fail") {
    return Boolean(state.defect?.description?.trim());
  }
  return state.value === "pass" || state.value === "na";
}

export function isPassFailItemUnsafe(state: ChecklistPassFailItemState): boolean {
  return state.value === "fail" && state.defect?.unsafeToDrive === true;
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
    const desc = state.defect?.description?.trim() || "(no description yet)";
    const unsafe = state.defect?.unsafeToDrive ? " — UNSAFE TO DRIVE" : "";
    lines.push(`${group.label}: ${desc}${unsafe}`);
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
