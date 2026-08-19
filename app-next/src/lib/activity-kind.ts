/**
 * Logged event types vs coverage / AMI kinds.
 * See docs/product/activity-glossary.md.
 *
 * Rest (`break`) is a break from driving; 31+ minutes becomes non-work.
 * Other work is also a break from driving on the sheet, but never becomes non-work.
 * Other work is still work time for 168h (work associated with driving).
 */

export const OTHER_WORK_EVENT_TYPE = "other_work";

/** Driving work only — the 5h work clock. Other work is a break from driving. */
export function isWorkTimeEventType(type: string): boolean {
  return type === "work";
}

/** Rest or Other work — WorkSafe BREAKS FROM DRIVING. */
export function isBreakFromDrivingEventType(type: string): boolean {
  return type === "break" || type === OTHER_WORK_EVENT_TYPE;
}

/** Shift is open: Work, Rest, or Other work (not End shift / idle). */
export function isOpenShiftEventType(type: string | null | undefined): boolean {
  return type === "work" || type === "break" || type === OTHER_WORK_EVENT_TYPE;
}

/** Day-sheet / AMI paint kind. `stop` does not paint. Unknown types are ignored. */
export function toCoverageKind(type: string): "work" | "break" | "other_work" | "non_work" | null {
  if (type === "break") return "break";
  if (type === OTHER_WORK_EVENT_TYPE) return "other_work";
  if (type === "non_work") return "non_work";
  if (type === "work") return "work";
  return null;
}

export function toAmiEventType(
  type: string
): "work" | "break" | "other_work" | "non_work" | "stop" | null {
  if (type === "stop") return "stop";
  return toCoverageKind(type);
}
