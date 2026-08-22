import { describe, expect, it } from "vitest";
import {
  OTHER_WORK_EVENT_TYPE,
  PASSENGER_EVENT_TYPE,
  SLEEPER_BERTH_EVENT_TYPE,
} from "./activity-kind";
import {
  DRIVER_BREAK_FROM_DRIVING_LABEL,
  DRIVER_CONTINUE_SHIFT_LABEL,
  DRIVER_PASSENGER_LABEL,
  DRIVER_SLEEPER_BERTH_LABEL,
  DRIVER_START_DRIVING_LABEL,
  DRIVER_START_OTHER_WORK_LABEL,
  DRIVER_START_WORK_LABEL,
} from "./product-copy";
import {
  resolveTwoUpActivityNowLabel,
  resolveTwoUpHeroPrimaryLabel,
  twoUpChooserAria,
  twoUpPassengerTiles,
  twoUpSleeperBerthTiles,
  twoUpStopDrivingTiles,
} from "./two-up-hero";

describe("two-up-hero tiles", () => {
  it("Stop Driving offers break from driving, Other work, Passenger, and Sleeper berth", () => {
    const tiles = twoUpStopDrivingTiles();
    expect(tiles.map((t) => t.logType)).toEqual([
      "break",
      OTHER_WORK_EVENT_TYPE,
      PASSENGER_EVENT_TYPE,
      SLEEPER_BERTH_EVENT_TYPE,
    ]);
    expect(tiles.map((t) => t.label)).toEqual([
      DRIVER_BREAK_FROM_DRIVING_LABEL,
      DRIVER_START_OTHER_WORK_LABEL,
      DRIVER_PASSENGER_LABEL,
      DRIVER_SLEEPER_BERTH_LABEL,
    ]);
    expect(tiles.find((t) => t.logType === PASSENGER_EVENT_TYPE)?.unlockWhileMoving).toBe(true);
    expect(tiles.find((t) => t.logType === SLEEPER_BERTH_EVENT_TYPE)?.unlockWhileMoving).toBe(true);
  });

  it("on sleeper berth: Start work → driving / Other work / Passenger — not End shift", () => {
    const tiles = twoUpSleeperBerthTiles();
    expect(tiles.map((t) => t.logType)).toEqual([
      "work",
      OTHER_WORK_EVENT_TYPE,
      PASSENGER_EVENT_TYPE,
    ]);
    expect(tiles.some((t) => t.logType === "stop")).toBe(false);
    expect(tiles.find((t) => t.logType === "work")?.label).toBe(DRIVER_START_DRIVING_LABEL);
  });

  it("on passenger: Continue shift → driving / break from driving / sleeper berth", () => {
    const tiles = twoUpPassengerTiles();
    expect(tiles.map((t) => t.logType)).toEqual([
      "work",
      "break",
      SLEEPER_BERTH_EVENT_TYPE,
    ]);
    expect(tiles.find((t) => t.logType === "break")?.label).toBe(DRIVER_BREAK_FROM_DRIVING_LABEL);
  });

  it("does not use Rest or Nap words on two-up labels", () => {
    const labels = [
      ...twoUpStopDrivingTiles().map((t) => t.label),
      ...twoUpSleeperBerthTiles().map((t) => t.label),
      ...twoUpPassengerTiles().map((t) => t.label),
      resolveTwoUpHeroPrimaryLabel(SLEEPER_BERTH_EVENT_TYPE),
      resolveTwoUpHeroPrimaryLabel(PASSENGER_EVENT_TYPE),
      resolveTwoUpActivityNowLabel("break"),
      twoUpChooserAria("work"),
    ];
    for (const label of labels) {
      expect(label).not.toMatch(/rest/i);
      expect(label).not.toMatch(/nap/i);
    }
    expect(resolveTwoUpHeroPrimaryLabel(SLEEPER_BERTH_EVENT_TYPE)).toBe(DRIVER_START_WORK_LABEL);
    expect(resolveTwoUpHeroPrimaryLabel(PASSENGER_EVENT_TYPE)).toBe(DRIVER_CONTINUE_SHIFT_LABEL);
  });
});
