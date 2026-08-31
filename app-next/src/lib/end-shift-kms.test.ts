import { describe, expect, it } from "vitest";
import {
  dayEventsIncludeStop,
  END_SHIFT_END_KM_REQUIRED_MESSAGE,
  hasWorkOrBreakAfterLastStop,
  hasWorkOrBreakBeforeLastStop,
  overnightStopCoveredByPriorEndKm,
  validateEndKmsRequiredForStop,
} from "./end-shift-kms";

describe("dayEventsIncludeStop", () => {
  it("detects stop among events", () => {
    expect(dayEventsIncludeStop([{ type: "work" }, { type: "stop" }])).toBe(true);
    expect(dayEventsIncludeStop([{ type: "work" }])).toBe(false);
    expect(dayEventsIncludeStop([])).toBe(false);
  });
});

describe("hasWorkOrBreakBeforeLastStop", () => {
  it("is true for same-day work then end shift", () => {
    expect(
      hasWorkOrBreakBeforeLastStop([
        { time: "2026-07-21T08:00:00", type: "work" },
        { time: "2026-07-21T14:00:00", type: "stop" },
      ])
    ).toBe(true);
  });

  it("is false for overnight finish card with only stop", () => {
    expect(
      hasWorkOrBreakBeforeLastStop([{ time: "2026-07-21T02:38:00", type: "stop" }])
    ).toBe(false);
  });

  it("is false when work is only after the overnight stop (new shift)", () => {
    expect(
      hasWorkOrBreakBeforeLastStop([
        { time: "2026-07-21T02:38:00", type: "stop" },
        { time: "2026-07-21T10:00:00", type: "work" },
      ])
    ).toBe(false);
    expect(
      hasWorkOrBreakAfterLastStop([
        { time: "2026-07-21T02:38:00", type: "stop" },
        { time: "2026-07-21T10:00:00", type: "work" },
      ])
    ).toBe(true);
  });
});

describe("validateEndKmsRequiredForStop", () => {
  it("allows missing end km when there is no stop", () => {
    expect(validateEndKmsRequiredForStop([{ type: "work" }], null)).toBeNull();
  });

  it("requires end km when stop is present and prior day has no end km", () => {
    expect(validateEndKmsRequiredForStop([{ type: "stop" }], null)).toBe(
      END_SHIFT_END_KM_REQUIRED_MESSAGE
    );
    expect(validateEndKmsRequiredForStop([{ type: "stop" }], -1)).toBe(
      END_SHIFT_END_KM_REQUIRED_MESSAGE
    );
    expect(validateEndKmsRequiredForStop([{ type: "stop" }], 102000)).toBeNull();
  });

  it("allows empty end km on overnight finish card when prior day holds end km", () => {
    const sheetDays = [{ end_kms: 754481 }, { start_kms: 754481, end_kms: null }];
    expect(
      validateEndKmsRequiredForStop([{ time: "2026-07-21T02:38:00", type: "stop" }], null, {
        sheetDays,
        dayIndex: 1,
      })
    ).toBeNull();
  });

  it("allows empty end km when starting a new shift after overnight stop", () => {
    const sheetDays = [{ end_kms: 754481 }, { start_kms: 754481, end_kms: null }];
    expect(
      validateEndKmsRequiredForStop(
        [
          { time: "2026-07-21T02:38:00", type: "stop" },
          { time: "2026-07-21T10:00:00", type: "work" },
        ],
        null,
        { sheetDays, dayIndex: 1, dayStartKms: 754481 }
      )
    ).toBeNull();
  });

  it("still requires end km on same-day close even when prior day has end km", () => {
    const sheetDays = [{ end_kms: 700000 }, { start_kms: 700000, end_kms: null }];
    expect(
      validateEndKmsRequiredForStop(
        [
          { time: "2026-07-21T08:00:00", type: "work" },
          { time: "2026-07-21T14:00:00", type: "stop" },
        ],
        null,
        { sheetDays, dayIndex: 1, dayStartKms: 700000 }
      )
    ).toBe(END_SHIFT_END_KM_REQUIRED_MESSAGE);
  });

  it("covers a continuing shift that logged rest and drive before End shift on the next label", () => {
    const sheetDays = [
      {
        start_kms: 700681,
        end_kms: 701482,
        events: [
          { time: "2026-08-28T11:41:00.000Z", type: "other_work" },
          { time: "2026-08-28T13:06:00.000Z", type: "work" },
        ],
      },
      {
        events: [
          { time: "2026-08-28T18:00:00.000Z", type: "break" },
          { time: "2026-08-28T18:20:00.000Z", type: "work" },
          { time: "2026-08-28T22:35:00.000Z", type: "stop" },
        ],
      },
    ];
    expect(
      validateEndKmsRequiredForStop(sheetDays[1]!.events, null, { sheetDays, dayIndex: 1 })
    ).toBeNull();
  });

  it("overnightStopCoveredByPriorEndKm matches validate helper", () => {
    const sheetDays = [{ end_kms: 754481 }, { end_kms: null }];
    expect(
      overnightStopCoveredByPriorEndKm([{ time: "2026-07-21T02:38:00", type: "stop" }], null, {
        sheetDays,
        dayIndex: 1,
      })
    ).toBe(true);
  });
});
