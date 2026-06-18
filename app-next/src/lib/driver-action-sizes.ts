/** Driver primary action + end-shift FAB — keep diameters in sync. */

export function driverActionSizeClass(expanded: boolean, compact: boolean): string {
  if (expanded) return "size-[min(72vw,18rem)]";
  if (compact) return "size-[4.5rem] sm:size-[5rem]";
  return "size-[min(64vw,12rem)] sm:size-[12rem]";
}

/** Round end-shift control — ¼ diameter of the main action for the same layout mode. */
export function endShiftButtonSizeClass(
  expanded: boolean,
  compact: boolean,
  confirming = false
): string {
  if (confirming) return endShiftConfirmSizeClass(expanded, compact);
  if (expanded) return "size-[min(18vw,4.5rem)]";
  if (compact) return "size-[max(2.75rem,calc(4.5rem/4))] sm:size-[max(2.75rem,calc(5rem/4))]";
  return "size-[min(16vw,3rem)] sm:size-[3rem]";
}

/** Expanded end-shift confirm — ½ hero diameter so label fits. */
export function endShiftConfirmSizeClass(expanded: boolean, compact: boolean): string {
  if (expanded) return "size-[min(36vw,9rem)]";
  if (compact) return "size-[min(40vw,5rem)] sm:size-[5rem]";
  return "size-[min(32vw,6rem)] sm:size-[6rem]";
}

export function endShiftIconSizeClass(
  expanded: boolean,
  compact: boolean,
  confirming = false
): string {
  if (confirming) {
    if (expanded) return "h-9 w-9";
    if (compact) return "h-6 w-6";
    return "h-8 w-8";
  }
  if (expanded) return "h-7 w-7";
  if (compact) return "h-4 w-4";
  return "h-6 w-6";
}

/** Visible light/dark trim band around the end-shift FAB (¼-size — thinner than hero border-4). */
export function endShiftTrimPaddingClass(
  expanded: boolean,
  compact: boolean,
  confirming = false
): string {
  if (confirming) {
    if (expanded) return "p-1.5";
    if (compact) return "p-[3px]";
    return "p-1";
  }
  if (expanded) return "p-1";
  if (compact) return "p-0.5";
  return "p-[3px]";
}

export function endShiftConfirmLabelSizeClass(expanded: boolean, compact: boolean): string {
  if (expanded) return "text-sm sm:text-base";
  if (compact) return "text-[9px] leading-none";
  return "text-xs sm:text-sm";
}
