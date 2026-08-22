import {
  OTHER_WORK_EVENT_TYPE,
  PASSENGER_EVENT_TYPE,
  SLEEPER_BERTH_EVENT_TYPE,
} from "@/lib/activity-kind";
import {
  DRIVER_BREAK_FROM_DRIVING_LABEL,
  DRIVER_CONTINUE_SHIFT_LABEL,
  DRIVER_OTHER_WORK_LABEL,
  DRIVER_PASSENGER_LABEL,
  DRIVER_SLEEPER_BERTH_LABEL,
  DRIVER_START_DRIVING_LABEL,
  DRIVER_START_OTHER_WORK_LABEL,
  DRIVER_START_WORK_LABEL,
} from "@/lib/product-copy";

export type TwoUpHeroSplitKind = "work" | "break" | "other_work" | "passenger" | "sleeper_berth";

export type TwoUpHeroTile = {
  id: string;
  kind: TwoUpHeroSplitKind;
  label: string;
  logType: string;
  /** Unlock while the vehicle is moving (handover into passenger / berth). */
  unlockWhileMoving?: boolean;
};

/** After Stop Driving — four destinations, all still on shift. */
export function twoUpStopDrivingTiles(): TwoUpHeroTile[] {
  return [
    { id: "break", kind: "break", label: DRIVER_BREAK_FROM_DRIVING_LABEL, logType: "break" },
    {
      id: "other_work",
      kind: "other_work",
      label: DRIVER_START_OTHER_WORK_LABEL,
      logType: OTHER_WORK_EVENT_TYPE,
    },
    {
      id: "passenger",
      kind: "passenger",
      label: DRIVER_PASSENGER_LABEL,
      logType: PASSENGER_EVENT_TYPE,
      unlockWhileMoving: true,
    },
    {
      id: "sleeper_berth",
      kind: "sleeper_berth",
      label: DRIVER_SLEEPER_BERTH_LABEL,
      logType: SLEEPER_BERTH_EVENT_TYPE,
      unlockWhileMoving: true,
    },
  ];
}

/** On sleeper berth — shift still open. */
export function twoUpSleeperBerthTiles(): TwoUpHeroTile[] {
  return [
    { id: "work", kind: "work", label: DRIVER_START_DRIVING_LABEL, logType: "work" },
    {
      id: "other_work",
      kind: "other_work",
      label: DRIVER_START_OTHER_WORK_LABEL,
      logType: OTHER_WORK_EVENT_TYPE,
    },
    {
      id: "passenger",
      kind: "passenger",
      label: DRIVER_PASSENGER_LABEL,
      logType: PASSENGER_EVENT_TYPE,
      unlockWhileMoving: true,
    },
  ];
}

/** On passenger — shift still open. */
export function twoUpPassengerTiles(): TwoUpHeroTile[] {
  return [
    { id: "work", kind: "work", label: DRIVER_START_DRIVING_LABEL, logType: "work" },
    { id: "break", kind: "break", label: DRIVER_BREAK_FROM_DRIVING_LABEL, logType: "break" },
    {
      id: "sleeper_berth",
      kind: "sleeper_berth",
      label: DRIVER_SLEEPER_BERTH_LABEL,
      logType: SLEEPER_BERTH_EVENT_TYPE,
      unlockWhileMoving: true,
    },
  ];
}

export function resolveTwoUpHeroPrimaryLabel(currentType: string | null): string | null {
  if (currentType === SLEEPER_BERTH_EVENT_TYPE) return DRIVER_START_WORK_LABEL;
  if (currentType === PASSENGER_EVENT_TYPE) return DRIVER_CONTINUE_SHIFT_LABEL;
  return null;
}

export function resolveTwoUpActivityNowLabel(currentType: string | null): string | null {
  if (currentType === SLEEPER_BERTH_EVENT_TYPE) return DRIVER_SLEEPER_BERTH_LABEL;
  if (currentType === PASSENGER_EVENT_TYPE) return DRIVER_PASSENGER_LABEL;
  if (currentType === "break") return DRIVER_BREAK_FROM_DRIVING_LABEL;
  return null;
}

export function twoUpChooserAria(currentType: string | null): string {
  if (currentType === "work") return "Stop Driving — choose break from driving, Other work, Passenger, or Sleeper berth";
  if (currentType === SLEEPER_BERTH_EVENT_TYPE) {
    return `On ${DRIVER_SLEEPER_BERTH_LABEL} — choose ${DRIVER_START_DRIVING_LABEL}, ${DRIVER_OTHER_WORK_LABEL}, or ${DRIVER_PASSENGER_LABEL}`;
  }
  if (currentType === PASSENGER_EVENT_TYPE) {
    return `On ${DRIVER_PASSENGER_LABEL} — choose ${DRIVER_START_DRIVING_LABEL}, ${DRIVER_BREAK_FROM_DRIVING_LABEL}, or ${DRIVER_SLEEPER_BERTH_LABEL}`;
  }
  return "Choose next activity";
}
