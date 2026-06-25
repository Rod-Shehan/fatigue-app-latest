import { describe, expect, it } from "vitest";
import type { DayData } from "@/lib/api";
import {
  resolveDriverFromSheetDutyLocal,
  workMinutesInBlock,
} from "@/lib/integrations/autonomise-sheet-attribution";

const WEEK = "2026-06-15"; // Sunday

function dayWithRegoAndWork(rego: string, workFromMinute: number, workToMinute: number): DayData {
  const work_time = Array.from({ length: 1440 }, () => false);
  for (let m = workFromMinute; m < workToMinute; m++) work_time[m] = true;
  return { truck_rego: rego, work_time };
}

describe("workMinutesInBlock", () => {
  it("counts work minutes inside a 15-min block", () => {
    const day = dayWithRegoAndWork("1ABC123", 8 * 60, 10 * 60);
    const blockStartMs = Date.parse("2026-06-16T01:00:00.000Z"); // 09:00 Perth
    const work = workMinutesInBlock(WEEK, 1, day, blockStartMs);
    expect(work).toBe(15);
  });
});

describe("resolveDriverFromSheetDutyLocal", () => {
  it("attributes when one driver has rego and work in block", () => {
    const blockStartMs = Date.parse("2026-06-16T01:00:00.000Z");
    const result = resolveDriverFromSheetDutyLocal({
      vehicleRego: "1ABC123",
      blockStartMs,
      sheets: [
        {
          driverName: "Pat Driver",
          weekStarting: WEEK,
          days: [
            dayWithRegoAndWork("", 0, 0),
            dayWithRegoAndWork("1ABC123", 8 * 60, 12 * 60),
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.driverName).toBe("Pat Driver");
    }
  });

  it("fails when rego matches but driver not on duty in block", () => {
    const blockStartMs = Date.parse("2026-06-16T05:00:00.000Z"); // 13:00 Perth
    const result = resolveDriverFromSheetDutyLocal({
      vehicleRego: "1ABC123",
      blockStartMs,
      sheets: [
        {
          driverName: "Pat Driver",
          weekStarting: WEEK,
          days: [
            dayWithRegoAndWork("", 0, 0),
            dayWithRegoAndWork("1ABC123", 8 * 60, 10 * 60),
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_on_duty");
  });

  it("matches rego ignoring spaces", () => {
    const blockStartMs = Date.parse("2026-06-16T01:00:00.000Z");
    const result = resolveDriverFromSheetDutyLocal({
      vehicleRego: "1ABC123",
      blockStartMs,
      sheets: [
        {
          driverName: "Pat Driver",
          weekStarting: WEEK,
          days: [dayWithRegoAndWork("", 0, 0), dayWithRegoAndWork("1ABC 123", 8 * 60, 12 * 60)],
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("fails when two drivers match same rego and block", () => {
    const blockStartMs = Date.parse("2026-06-16T01:00:00.000Z");
    const result = resolveDriverFromSheetDutyLocal({
      vehicleRego: "1ABC123",
      blockStartMs,
      sheets: [
        {
          driverName: "Pat Driver",
          weekStarting: WEEK,
          days: [dayWithRegoAndWork("", 0, 0), dayWithRegoAndWork("1ABC123", 8 * 60, 12 * 60)],
        },
        {
          driverName: "Sam Driver",
          weekStarting: WEEK,
          days: [dayWithRegoAndWork("", 0, 0), dayWithRegoAndWork("1ABC123", 8 * 60, 12 * 60)],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("ambiguous_drivers");
  });
});
