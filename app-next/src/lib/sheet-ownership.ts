import type { FatigueSheet } from "@/lib/api";

/** True when this weekly record belongs to the named driver (not relief metadata). */
export function isSheetOwnedByDriver(
  sheet: Pick<FatigueSheet, "driver_name">,
  driverName: string
): boolean {
  const owner = (sheet.driver_name ?? "").trim();
  const who = driverName.trim();
  return owner.length > 0 && owner === who;
}

type SheetWithEvents = {
  days?: Array<{ events?: Array<{ driver?: string }> }>;
};

/** Shared-logbook sheets tagged work as primary/second — omit column on new individual records. */
export function sheetHasLegacyDriverEventTags(sheet: SheetWithEvents): boolean {
  for (const day of sheet.days ?? []) {
    for (const ev of day.events ?? []) {
      if (ev.driver) return true;
    }
  }
  return false;
}
