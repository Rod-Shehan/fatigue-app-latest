import {
  OTHER_WORK_EVENT_TYPE,
  PASSENGER_EVENT_TYPE,
  SLEEPER_BERTH_EVENT_TYPE,
  STATIONARY_REST_EVENT_TYPE,
} from "@/lib/activity-kind";
import {
  DRIVER_BREAK_FROM_DRIVING_LABEL,
  DRIVER_OTHER_WORK_LABEL,
  DRIVER_PARKED_LABEL,
  DRIVER_PASSENGER_LABEL,
  DRIVER_SLEEPER_BERTH_LABEL,
  DRIVER_START_DRIVING_LABEL,
  DRIVER_START_OTHER_WORK_LABEL,
  DRIVER_START_SHIFT_LABEL,
  DRIVER_START_WORK_LABEL,
} from "@/lib/product-copy";

export type TwoUpHeroSplitKind =
  | "work"
  | "break"
  | "other_work"
  | "passenger"
  | "sleeper_berth"
  | "parked";

export type TwoUpHeroTile = {
  id: string;
  kind: TwoUpHeroSplitKind;
  label: string;
  logType: string;
  /** Unlock while the vehicle is moving (handover into passenger / berth). */
  unlockWhileMoving?: boolean;
};

function otherWorkTile(): TwoUpHeroTile {
  return {
    id: "other_work",
    kind: "other_work",
    label: DRIVER_START_OTHER_WORK_LABEL,
    logType: OTHER_WORK_EVENT_TYPE,
  };
}

function passengerTile(unlockWhileMoving = true): TwoUpHeroTile {
  return {
    id: "passenger",
    kind: "passenger",
    label: DRIVER_PASSENGER_LABEL,
    logType: PASSENGER_EVENT_TYPE,
    unlockWhileMoving,
  };
}

/** After Stop Driving — four destinations, all still on shift. Parked is the dock puck. */
export function twoUpStopDrivingTiles(): TwoUpHeroTile[] {
  return [
    passengerTile(),
    {
      id: "sleeper_berth",
      kind: "sleeper_berth",
      label: DRIVER_SLEEPER_BERTH_LABEL,
      logType: SLEEPER_BERTH_EVENT_TYPE,
      unlockWhileMoving: true,
    },
    { id: "break", kind: "break", label: DRIVER_BREAK_FROM_DRIVING_LABEL, logType: "break" },
    otherWorkTile(),
  ];
}

/** Idle Start shift — FFW / Set up day already ran. No Sleeper (that is on-trip only). */
export function twoUpStartShiftTiles(): TwoUpHeroTile[] {
  return [
    { id: "work", kind: "work", label: DRIVER_START_DRIVING_LABEL, logType: "work" },
    passengerTile(),
    otherWorkTile(),
  ];
}

/** On sleeper berth — shift still open. Parked is the dock, not this split. */
export function twoUpSleeperBerthTiles(): TwoUpHeroTile[] {
  return [
    { id: "work", kind: "work", label: DRIVER_START_DRIVING_LABEL, logType: "work" },
    passengerTile(),
    otherWorkTile(),
  ];
}

/** On passenger — shift still open. Parked is the dock, not this split. */
export function twoUpPassengerTiles(): TwoUpHeroTile[] {
  return [
    { id: "work", kind: "work", label: DRIVER_START_DRIVING_LABEL, logType: "work" },
    {
      id: "sleeper_berth",
      kind: "sleeper_berth",
      label: DRIVER_SLEEPER_BERTH_LABEL,
      logType: SLEEPER_BERTH_EVENT_TYPE,
      unlockWhileMoving: true,
    },
    { id: "break", kind: "break", label: DRIVER_BREAK_FROM_DRIVING_LABEL, logType: "break" },
  ];
}

/** On Parked — shift still open. GPS already proved stationary. */
export function twoUpParkedTiles(): TwoUpHeroTile[] {
  return [
    { id: "work", kind: "work", label: DRIVER_START_DRIVING_LABEL, logType: "work" },
    {
      id: "sleeper_berth",
      kind: "sleeper_berth",
      label: DRIVER_SLEEPER_BERTH_LABEL,
      logType: SLEEPER_BERTH_EVENT_TYPE,
      unlockWhileMoving: true,
    },
    passengerTile(),
    otherWorkTile(),
  ];
}

export function resolveTwoUpHeroPrimaryLabel(currentType: string | null): string | null {
  if (currentType === SLEEPER_BERTH_EVENT_TYPE) return DRIVER_START_WORK_LABEL;
  if (currentType === STATIONARY_REST_EVENT_TYPE) return DRIVER_START_WORK_LABEL;
  if (currentType === PASSENGER_EVENT_TYPE) return DRIVER_START_WORK_LABEL;
  return null;
}

export function resolveTwoUpActivityNowLabel(currentType: string | null): string | null {
  if (currentType === SLEEPER_BERTH_EVENT_TYPE) return DRIVER_SLEEPER_BERTH_LABEL;
  if (currentType === STATIONARY_REST_EVENT_TYPE) return DRIVER_PARKED_LABEL;
  if (currentType === PASSENGER_EVENT_TYPE) return DRIVER_PASSENGER_LABEL;
  if (currentType === "break") return DRIVER_BREAK_FROM_DRIVING_LABEL;
  return null;
}

export function twoUpChooserAria(currentType: string | null): string {
  if (currentType === null) {
    return `${DRIVER_START_SHIFT_LABEL} — choose ${DRIVER_START_DRIVING_LABEL}, ${DRIVER_PASSENGER_LABEL}, or ${DRIVER_START_OTHER_WORK_LABEL}`;
  }
  if (currentType === "work") {
    return "Stop Driving — choose Passenger, Sleeper berth, break from driving, or Other work";
  }
  if (currentType === SLEEPER_BERTH_EVENT_TYPE) {
    return `On ${DRIVER_SLEEPER_BERTH_LABEL} — choose ${DRIVER_START_DRIVING_LABEL}, ${DRIVER_PASSENGER_LABEL}, or ${DRIVER_OTHER_WORK_LABEL}`;
  }
  if (currentType === PASSENGER_EVENT_TYPE) {
    return `On ${DRIVER_PASSENGER_LABEL} — choose ${DRIVER_START_DRIVING_LABEL}, ${DRIVER_SLEEPER_BERTH_LABEL}, or ${DRIVER_BREAK_FROM_DRIVING_LABEL}`;
  }
  if (currentType === STATIONARY_REST_EVENT_TYPE) {
    return `On ${DRIVER_PARKED_LABEL} — choose ${DRIVER_START_DRIVING_LABEL}, ${DRIVER_SLEEPER_BERTH_LABEL}, ${DRIVER_PASSENGER_LABEL}, or ${DRIVER_OTHER_WORK_LABEL}`;
  }
  return "Choose next activity";
}
