/** Driver primary action + end-shift FAB — keep diameters in sync. */

export function driverActionSizeClass(expanded: boolean, compact: boolean): string {
  if (expanded) return "size-[min(72vw,18rem)]";
  if (compact) return "size-[4.5rem] sm:size-[5rem]";
  return "size-[min(64vw,12rem)] sm:size-[12rem]";
}

/** Round end-shift control — ¼ diameter of the main action for the same layout mode. */
export function endShiftButtonSizeClass(expanded: boolean, compact: boolean): string {
  if (expanded) return "size-[min(18vw,4.5rem)]";
  if (compact) return "size-[max(2.75rem,calc(4.5rem/4))] sm:size-[max(2.75rem,calc(5rem/4))]";
  return "size-[min(16vw,3rem)] sm:size-[3rem]";
}

export function endShiftIconSizeClass(expanded: boolean, compact: boolean): string {
  if (expanded) return "h-7 w-7";
  if (compact) return "h-4 w-4";
  return "h-6 w-6";
}
