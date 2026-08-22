import { describe, expect, it } from "vitest";
import { OTHER_WORK_EVENT_TYPE, PASSENGER_EVENT_TYPE, SLEEPER_BERTH_EVENT_TYPE } from "./activity-kind";
import {
  DRIVER_BREAK_FROM_DRIVING_LABEL,
  DRIVER_CONTINUE_SHIFT_LABEL,
  DRIVER_OTHER_WORK_LABEL,
  DRIVER_PASSENGER_LABEL,
  DRIVER_REST_LABEL,
  DRIVER_SLEEPER_BERTH_LABEL,
  DRIVER_START_DRIVING_LABEL,
  DRIVER_START_SHIFT_LABEL,
  DRIVER_START_WORK_LABEL,
  DRIVER_STOP_DRIVING_LABEL,
  DRIVER_WORK_LABEL,
} from "./product-copy";
import {
  resolveDriverHeroPrimaryLabel,
  resolveHeroActivityNowLabel,
  resolveWorkConfirmLabel,
} from "./driver-hero-primary";

describe("resolveDriverHeroPrimaryLabel", () => {
  it("shows Stop Driving after a driving (work) log — not Continue shift", () => {
    expect(resolveDriverHeroPrimaryLabel("work")).toBe(DRIVER_STOP_DRIVING_LABEL);
  });

  it("shows Start work on Rest", () => {
    expect(resolveDriverHeroPrimaryLabel("break")).toBe(DRIVER_START_WORK_LABEL);
  });

  it("shows Continue shift only on Other work", () => {
    expect(resolveDriverHeroPrimaryLabel(OTHER_WORK_EVENT_TYPE)).toBe(DRIVER_CONTINUE_SHIFT_LABEL);
  });

  it("shows Start shift when idle", () => {
    expect(resolveDriverHeroPrimaryLabel(null)).toBe(DRIVER_START_SHIFT_LABEL);
    expect(resolveDriverHeroPrimaryLabel("non_work")).toBe(DRIVER_START_SHIFT_LABEL);
    expect(resolveDriverHeroPrimaryLabel("stop")).toBe(DRIVER_START_SHIFT_LABEL);
  });

  it("two-up: Start work on sleeper berth, Continue shift on passenger", () => {
    expect(resolveDriverHeroPrimaryLabel(SLEEPER_BERTH_EVENT_TYPE, { twoUp: true })).toBe(
      DRIVER_START_WORK_LABEL
    );
    expect(resolveDriverHeroPrimaryLabel(PASSENGER_EVENT_TYPE, { twoUp: true })).toBe(
      DRIVER_CONTINUE_SHIFT_LABEL
    );
    expect(resolveDriverHeroPrimaryLabel("work", { twoUp: true })).toBe(DRIVER_STOP_DRIVING_LABEL);
  });
});

describe("resolveWorkConfirmLabel", () => {
  it("uses Start driving from Rest, even if the chooser flag is stale", () => {
    expect(
      resolveWorkConfirmLabel({
        startShiftChooserOpen: false,
        restWorkChooserOpen: false,
        currentType: "break",
        episodeResume: false,
        needsShiftStartSetup: false,
      })
    ).toBe(DRIVER_START_DRIVING_LABEL);
  });

  it("uses Start driving while the Rest or Start shift split is open", () => {
    expect(
      resolveWorkConfirmLabel({
        startShiftChooserOpen: false,
        restWorkChooserOpen: true,
        currentType: "break",
        episodeResume: false,
        needsShiftStartSetup: false,
      })
    ).toBe(DRIVER_START_DRIVING_LABEL);
    expect(
      resolveWorkConfirmLabel({
        startShiftChooserOpen: true,
        restWorkChooserOpen: false,
        currentType: null,
        episodeResume: false,
        needsShiftStartSetup: false,
      })
    ).toBe(DRIVER_START_DRIVING_LABEL);
  });

  it("uses Start driving from Other work — Continue shift only opens the split", () => {
    expect(
      resolveWorkConfirmLabel({
        startShiftChooserOpen: false,
        restWorkChooserOpen: false,
        otherWorkChooserOpen: false,
        currentType: OTHER_WORK_EVENT_TYPE,
        episodeResume: false,
        needsShiftStartSetup: false,
      })
    ).toBe(DRIVER_START_DRIVING_LABEL);
    expect(
      resolveWorkConfirmLabel({
        startShiftChooserOpen: false,
        restWorkChooserOpen: false,
        otherWorkChooserOpen: true,
        currentType: OTHER_WORK_EVENT_TYPE,
        episodeResume: false,
        needsShiftStartSetup: false,
      })
    ).toBe(DRIVER_START_DRIVING_LABEL);
  });
});

describe("resolveHeroActivityNowLabel", () => {
  it("names Work, Rest, and Other work so the split is not mistaken for the current state", () => {
    expect(resolveHeroActivityNowLabel("work")).toBe(DRIVER_WORK_LABEL);
    expect(resolveHeroActivityNowLabel("break")).toBe(DRIVER_REST_LABEL);
    expect(resolveHeroActivityNowLabel(OTHER_WORK_EVENT_TYPE)).toBe(DRIVER_OTHER_WORK_LABEL);
    expect(resolveHeroActivityNowLabel(null)).toBeNull();
  });

  it("two-up names Passenger, Sleeper berth, and Break from driving", () => {
    expect(resolveHeroActivityNowLabel(PASSENGER_EVENT_TYPE, { twoUp: true })).toBe(
      DRIVER_PASSENGER_LABEL
    );
    expect(resolveHeroActivityNowLabel(SLEEPER_BERTH_EVENT_TYPE, { twoUp: true })).toBe(
      DRIVER_SLEEPER_BERTH_LABEL
    );
    expect(resolveHeroActivityNowLabel("break", { twoUp: true })).toBe(DRIVER_BREAK_FROM_DRIVING_LABEL);
  });
});
