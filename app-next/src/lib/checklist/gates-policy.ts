/**
 * Form gates. Fitness for Work is required before Start shift.
 * Pre-departure, load, hook-up, and fault report stay optional — shift mix is unknown.
 */

import { workLogRequiresShiftStartSetup } from "@/lib/shift-start-gate";
import { FFW_START_SHIFT_BLOCK_MESSAGE } from "@/lib/product-copy";

/** Prestart / load / unsafe sheet gates stay off (shift arrangements vary). */
export const CHECKLIST_SHEET_GATES_ENABLED: boolean = false;

export function checklistSheetGatesEnabled(): boolean {
  return CHECKLIST_SHEET_GATES_ENABLED;
}

/** Signed FFW for this day is required before a new Start shift. */
export const FFW_START_SHIFT_GATE_ENABLED: boolean = true;

export function ffwStartShiftGateEnabled(): boolean {
  return FFW_START_SHIFT_GATE_ENABLED;
}

export function getFfwStartShiftBlockReason(
  events: { time: string; type: string }[],
  checklists: Array<{ type?: string; status?: string }> | null | undefined,
  asOfMs: number = Date.now()
): string | null {
  if (!ffwStartShiftGateEnabled()) return null;
  if (!workLogRequiresShiftStartSetup(events, asOfMs)) return null;
  const signed = (checklists ?? []).some((c) => c?.status === "completed" && c.type === "ffw");
  if (signed) return null;
  return FFW_START_SHIFT_BLOCK_MESSAGE;
}
