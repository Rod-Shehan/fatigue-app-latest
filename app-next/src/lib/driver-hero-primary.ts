import { isWorkTimeEventType, OTHER_WORK_EVENT_TYPE } from "@/lib/activity-kind";
import {
  DRIVER_CONTINUE_SHIFT_LABEL,
  DRIVER_START_DRIVING_LABEL,
  DRIVER_START_SHIFT_LABEL,
  DRIVER_START_WORK_LABEL,
  DRIVER_STOP_DRIVING_LABEL,
} from "@/lib/product-copy";

/**
 * Compact/expanded hero label from the last logged kind.
 * Continue shift is only for Other work → driving. Driving itself is Stop Driving.
 */
export function resolveDriverHeroPrimaryLabel(currentType: string | null): string {
  if (isWorkTimeEventType(currentType ?? "")) return DRIVER_STOP_DRIVING_LABEL;
  if (currentType === "break") return DRIVER_START_WORK_LABEL;
  if (currentType === OTHER_WORK_EVENT_TYPE) return DRIVER_CONTINUE_SHIFT_LABEL;
  return DRIVER_START_SHIFT_LABEL;
}

/** Tap-again / warning copy when arming a driving (`work`) log. */
export function resolveWorkConfirmLabel(options: {
  startShiftChooserOpen: boolean;
  restWorkChooserOpen: boolean;
  currentType: string | null;
  episodeResume: boolean;
  needsShiftStartSetup: boolean;
}): string {
  const { startShiftChooserOpen, restWorkChooserOpen, currentType, episodeResume, needsShiftStartSetup } =
    options;
  if (startShiftChooserOpen || restWorkChooserOpen || currentType === "break") {
    return DRIVER_START_DRIVING_LABEL;
  }
  if (currentType === OTHER_WORK_EVENT_TYPE) return DRIVER_CONTINUE_SHIFT_LABEL;
  if (episodeResume || needsShiftStartSetup || currentType === null) {
    return DRIVER_START_SHIFT_LABEL;
  }
  return DRIVER_CONTINUE_SHIFT_LABEL;
}
