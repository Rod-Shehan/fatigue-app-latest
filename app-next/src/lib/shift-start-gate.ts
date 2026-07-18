/**
 * Shift-start setup gate — UI enforcement only (rego, route, start km before work).
 * Rolling timeline decides whether the driver is already in open work/break.
 */

import { isOpenWorkOrBreakAt } from "@/lib/rolling-events";

export type ShiftStartSetupFields = {
  truck_rego?: string | null;
  start_location?: string | null;
  destination?: string | null;
  start_kms?: number | null;
};

export function getShiftStartSetupMissing(fields: ShiftStartSetupFields): string[] {
  const missing: string[] = [];
  if (!(fields.truck_rego ?? "").toString().trim()) missing.push("Rego");
  if (!(fields.start_location ?? "").toString().trim()) missing.push("Start location");
  if (!(fields.destination ?? "").toString().trim()) missing.push("Destination");
  if (fields.start_kms == null || Number.isNaN(Number(fields.start_kms))) missing.push("Start KM");
  return missing;
}

export function isShiftStartSetupComplete(fields: ShiftStartSetupFields): boolean {
  return getShiftStartSetupMissing(fields).length === 0;
}

/** Work log needs day-card setup when the rolling timeline is not in open work/break. */
export function workLogRequiresShiftStartSetup(
  events: { time: string; type: string }[],
  asOfMs: number = Date.now()
): boolean {
  return !isOpenWorkOrBreakAt(events, asOfMs);
}

/** Block reason for logging work now, or null when allowed. */
export function getWorkLogBlockReason(
  events: { time: string; type: string }[],
  fields: ShiftStartSetupFields,
  asOfMs: number = Date.now()
): string | null {
  if (!workLogRequiresShiftStartSetup(events, asOfMs)) return null;
  const missing = getShiftStartSetupMissing(fields);
  if (missing.length > 0) {
    return `Please complete shift setup before starting work: ${missing.join(", ")}.`;
  }
  return null;
}
