import { describe, expect, it } from "vitest";
import { FFW_START_SHIFT_BLOCK_MESSAGE } from "@/lib/product-copy";
import { getFfwStartShiftBlockReason } from "./gates-policy";

describe("getFfwStartShiftBlockReason", () => {
  const idle: { time: string; type: string }[] = [];
  const onBreak = [{ time: "2026-06-11T09:00:00", type: "break" }];
  const asOf = Date.parse("2026-06-11T10:00:00");

  it("blocks a new Start shift until a signed FFW exists for the day", () => {
    expect(getFfwStartShiftBlockReason(idle, [], asOf)).toBe(FFW_START_SHIFT_BLOCK_MESSAGE);
    expect(getFfwStartShiftBlockReason(idle, [{ type: "ffw", status: "draft" }], asOf)).toBe(
      FFW_START_SHIFT_BLOCK_MESSAGE
    );
  });

  it("does not count a week-PDF tick as Fitness for Work", () => {
    expect(getFfwStartShiftBlockReason(idle, undefined, asOf)).toBe(FFW_START_SHIFT_BLOCK_MESSAGE);
  });

  it("allows Start shift after a completed FFW", () => {
    expect(
      getFfwStartShiftBlockReason(idle, [{ type: "ffw", status: "completed" }], asOf)
    ).toBeNull();
  });

  it("does not require FFW while the shift is already open", () => {
    expect(getFfwStartShiftBlockReason(onBreak, [], asOf)).toBeNull();
  });

  it("does not require prestart or load to start", () => {
    expect(
      getFfwStartShiftBlockReason(idle, [{ type: "ffw", status: "completed" }], asOf)
    ).toBeNull();
  });
});
