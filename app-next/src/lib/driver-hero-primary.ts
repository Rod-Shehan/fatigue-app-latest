import {
  isWorkTimeEventType,
  OTHER_WORK_EVENT_TYPE,
  PASSENGER_EVENT_TYPE,
  SLEEPER_BERTH_EVENT_TYPE,
  STATIONARY_REST_EVENT_TYPE,
} from "@/lib/activity-kind";
import {
  DRIVER_BREAK_FROM_DRIVING_LABEL,
  DRIVER_CONTINUE_SHIFT_LABEL,
  DRIVER_LOAD_CHECK_LABEL,
  DRIVER_OTHER_WORK_LABEL,
  DRIVER_REST_LABEL,
  DRIVER_START_DRIVING_LABEL,
  DRIVER_START_REST_LABEL,
  DRIVER_START_SHIFT_LABEL,
  DRIVER_START_WORK_LABEL,
  DRIVER_STOP_DRIVING_LABEL,
  DRIVER_WORK_LABEL,
} from "@/lib/product-copy";
import { resolveTwoUpActivityNowLabel, resolveTwoUpHeroPrimaryLabel } from "@/lib/two-up-hero";

/** Three Other work hub tiles — Start driving spans the top; Rest and Load check sit below. */
export type OtherWorkHeroTile = {
  id: string;
  kind: "work" | "break" | "load_check";
  label: string;
  /** `work` / `break` log after tap-again. Load check is not stored. */
  logType: "work" | "break" | null;
};

export function otherWorkHeroTiles(opts?: { twoUp?: boolean }): OtherWorkHeroTile[] {
  return [
    { id: "drive", kind: "work", label: DRIVER_START_DRIVING_LABEL, logType: "work" },
    {
      id: "rest",
      kind: "break",
      label: opts?.twoUp ? DRIVER_BREAK_FROM_DRIVING_LABEL : DRIVER_START_REST_LABEL,
      logType: "break",
    },
    { id: "load", kind: "load_check", label: DRIVER_LOAD_CHECK_LABEL, logType: null },
  ];
}

/**
 * Compact/expanded hero label from the last logged kind.
 * Other work uses the three-tile hub (this string is unused while that hub is showing).
 * Driving itself is Stop Driving.
 */
export function resolveDriverHeroPrimaryLabel(
  currentType: string | null,
  opts?: { twoUp?: boolean }
): string {
  if (opts?.twoUp) {
    const twoUp = resolveTwoUpHeroPrimaryLabel(currentType);
    if (twoUp) return twoUp;
  }
  if (isWorkTimeEventType(currentType ?? "")) return DRIVER_STOP_DRIVING_LABEL;
  if (currentType === "break") return DRIVER_START_WORK_LABEL;
  if (currentType === OTHER_WORK_EVENT_TYPE) return DRIVER_CONTINUE_SHIFT_LABEL;
  return DRIVER_START_SHIFT_LABEL;
}

/** Small hero note: what the driver is on now (not a button). */
export function resolveHeroActivityNowLabel(
  currentType: string | null,
  opts?: { twoUp?: boolean }
): string | null {
  if (opts?.twoUp) {
    const twoUp = resolveTwoUpActivityNowLabel(currentType);
    if (twoUp) return twoUp;
  }
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
  passengerChooserOpen?: boolean;
  sleeperChooserOpen?: boolean;
  parkedChooserOpen?: boolean;
  currentType: string | null;
  episodeResume: boolean;
  needsShiftStartSetup: boolean;
}): string {
  const {
    startShiftChooserOpen,
    restWorkChooserOpen,
    otherWorkChooserOpen = false,
    passengerChooserOpen = false,
    sleeperChooserOpen = false,
    parkedChooserOpen = false,
    currentType,
    episodeResume,
    needsShiftStartSetup,
  } = options;
  if (
    startShiftChooserOpen ||
    restWorkChooserOpen ||
    otherWorkChooserOpen ||
    passengerChooserOpen ||
    sleeperChooserOpen ||
    parkedChooserOpen ||
    currentType === "break" ||
    currentType === OTHER_WORK_EVENT_TYPE ||
    currentType === PASSENGER_EVENT_TYPE ||
    currentType === SLEEPER_BERTH_EVENT_TYPE ||
    currentType === STATIONARY_REST_EVENT_TYPE
  ) {
    return DRIVER_START_DRIVING_LABEL;
  }
  if (episodeResume || needsShiftStartSetup || currentType === null) {
    return DRIVER_START_SHIFT_LABEL;
  }
  return DRIVER_CONTINUE_SHIFT_LABEL;
}
