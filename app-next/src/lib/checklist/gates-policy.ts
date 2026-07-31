/** Trial / marketing: checklists are available but never block Start shift or load flow. */
export const CHECKLIST_SHEET_GATES_ENABLED = false;

/**
 * When false (default for trial), FFW / Prestart / Load forms may be completed
 * voluntarily. Sheet gates (C/D/E/L/M) stay off until a customer opts in —
 * see compliance-checklist-modules-project-scope.md decision **P**.
 */
export function checklistSheetGatesEnabled(): boolean {
  return CHECKLIST_SHEET_GATES_ENABLED === true;
}
