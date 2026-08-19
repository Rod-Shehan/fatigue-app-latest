import { isWorkTimeEventType, OTHER_WORK_EVENT_TYPE } from "@/lib/activity-kind";
import {
  DRIVER_CONTINUE_SHIFT_LABEL,
  DRIVER_OTHER_WORK_LABEL,
  DRIVER_REST_LABEL,
  DRIVER_START_DRIVING_LABEL,
  DRIVER_START_SHIFT_LABEL,
  DRIVER_START_WORK_LABEL,
  DRIVER_STOP_DRIVING_LABEL,
  DRIVER_WORK_LABEL,
} from "@/lib/product-copy";

/**
 * Compact/expanded hero label from the last logged kind.
 * Continue shift is the Other work opener (chooser only). Driving itself is Stop Driving.
 */
export function resolveDriverHeroPrimaryLabel(currentType: string | null): string {
  if (isWorkTimeEventType(currentType ?? "")) return DRIVER_STOP_DRIVING_LABEL;
  if (currentType === "break") return DRIVER_START_WORK_LABEL;
  if (currentType === OTHER_WORK_EVENT_TYPE) return DRIVER_CONTINUE_SHIFT_LABEL;
  return DRIVER_START_SHIFT_LABEL;
}

/** Small hero note: what the driver is on now (not a button). */
export function resolveHeroActivityNowLabel(currentType: string | null): string | null {
  if (isWorkTimeEventType(currentType ?? "")) return DRIVER_WORK_LABEL;
  if (currentType === "break") return DRIVER_REST_LABEL;
  if (currentType === OTHER_WORK_EVENT_TYPE) return DRIVER_OTHER_WORK_LABEL;
  return null;
}

/** Tap-again / warning copy when arming a driving (`work`) log. */
export function resolveWorkConfirmLabel(options: {
  startShiftChooserOpen: boolean;
  restWorkChooserOpen: boolean;
  otherWorkChooserOpen?: boolean;
  currentType: string | null;
  episodeResume: boolean;
  needsShiftStartSetup: boolean;
}): string {
  const {
    startShiftChooserOpen,
    restWorkChooserOpen,
    otherWorkChooserOpen = false,
    currentType,
    episodeResume,
    needsShiftStartSetup,
  } = options;
  if (
    startShiftChooserOpen ||
    restWorkChooserOpen ||
    otherWorkChooserOpen ||
    currentType === "break" ||
    currentType === OTHER_WORK_EVENT_TYPE
  ) {
    return DRIVER_START_DRIVING_LABEL;
  }
  if (episodeResume || needsShiftStartSetup || currentType === null) {
    return DRIVER_START_SHIFT_LABEL;
  }
  return DRIVER_CONTINUE_SHIFT_LABEL;
}
