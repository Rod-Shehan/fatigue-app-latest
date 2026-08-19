import { describe, expect, it } from "vitest";
import { isOpenWorkOrBreakAt, getLastRollingEventAt } from "@/lib/rolling-events";
import {
  getShiftStartSetupMissing,
  getWorkLogBlockReason,
  workLogRequiresShiftStartSetup,
} from "@/lib/shift-start-gate";

describe("shift-start-gate", () => {
  const completeFields = {
    truck_rego: "ABC123",
    start_location: "Perth",
    destination: "Kalgoorlie",
    start_kms: 1000,
  };

  it("requires setup when timeline is idle", () => {
    expect(workLogRequiresShiftStartSetup([])).toBe(true);
    expect(workLogRequiresShiftStartSetup([{ time: "2026-06-11T08:00:00", type: "stop" }])).toBe(true);
    expect(workLogRequiresShiftStartSetup([{ time: "2026-06-11T08:00:00", type: "non_work" }])).toBe(true);
  });

  it("does not require setup when resuming from other work", () => {
    const events = [
      { time: "2026-06-11T08:00:00", type: "work" },
      { time: "2026-06-11T09:00:00", type: "other_work" },
    ];
    expect(workLogRequiresShiftStartSetup(events, Date.parse("2026-06-11T10:00:00"))).toBe(false);
  });

  it("requires setup when idle even if the next tap will be other work", () => {
    expect(workLogRequiresShiftStartSetup([])).toBe(true);
  });

  it("blocks work when setup fields are missing", () => {
    const reason = getWorkLogBlockReason([], { truck_rego: "ABC123" });
    expect(reason).toMatch(/shift setup/i);
    expect(getShiftStartSetupMissing({ truck_rego: "ABC123" })).toEqual(["Start KM"]);
  });

  it("allows work when setup is complete and timeline is open on break", () => {
    const events = [{ time: "2026-06-11T09:00:00", type: "break" }];
    expect(getWorkLogBlockReason(events, completeFields, Date.parse("2026-06-11T10:00:00"))).toBeNull();
  });
});

describe("isOpenWorkOrBreakAt", () => {
  it("uses the last event at or before asOfMs", () => {
    const events = [
      { time: "2026-06-11T08:00:00", type: "work" },
      { time: "2026-06-11T12:00:00", type: "stop" },
    ];
    expect(getLastRollingEventAt(events, Date.parse("2026-06-11T10:00:00"))?.type).toBe("work");
    expect(isOpenWorkOrBreakAt(events, Date.parse("2026-06-11T10:00:00"))).toBe(true);
    expect(isOpenWorkOrBreakAt(events, Date.parse("2026-06-11T13:00:00"))).toBe(false);
  });
});
