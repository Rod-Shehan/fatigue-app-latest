import { describe, expect, it } from "vitest";
import { getThisWeekSunday } from "@/lib/weeks";
import {
  applyShiftLogEventPatch,
  canEditShiftLog,
  shiftLogEditMessages,
  sortShiftLogDayEvents,
} from "./shift-log-edit";

describe("canEditShiftLog", () => {
  const thisWeek = getThisWeekSunday();
  const pastWeek = "2020-01-05";

  it("lets a driver edit an unsigned week", () => {
    expect(
      canEditShiftLog({
        isManager: false,
        status: "draft",
        signature: null,
        weekStarting: thisWeek,
      })
    ).toBe(true);
    expect(
      canEditShiftLog({
        isManager: false,
        status: "draft",
        signature: null,
        weekStarting: pastWeek,
      })
    ).toBe(true);
  });

  it("locks after sign or completed", () => {
    expect(
      canEditShiftLog({
        isManager: false,
        status: "completed",
        signature: "data:image/png;base64,x",
        weekStarting: pastWeek,
      })
    ).toBe(false);
    expect(
      canEditShiftLog({
        isManager: false,
        status: "completed",
        signature: null,
        weekStarting: pastWeek,
      })
    ).toBe(false);
  });

  it("does not let a manager edit a past unsigned week from the shift log", () => {
    expect(
      canEditShiftLog({
        isManager: true,
        status: "draft",
        signature: null,
        weekStarting: pastWeek,
      })
    ).toBe(false);
  });
});

describe("applyShiftLogEventPatch", () => {
  it("updates time and type and keeps location", () => {
    const days = [
      {
        events: [{ time: "2026-05-25T06:00:00.000Z", type: "work", lat: -32, lng: 115 }],
      },
    ];
    const next = applyShiftLogEventPatch(days, 0, 0, {
      time: "2026-05-25T07:15:00.000Z",
      type: "break",
    });
    expect(next[0]?.events?.[0]).toEqual({
      time: "2026-05-25T07:15:00.000Z",
      type: "break",
      lat: -32,
      lng: 115,
    });
    expect(days[0]?.events?.[0]?.type).toBe("work");
  });

  it("strips napFrom when the type is no longer rest", () => {
    const days = [
      {
        events: [{ time: "2026-05-25T08:00:00.000Z", type: "break", napFrom: "work" }],
      },
    ];
    const next = applyShiftLogEventPatch(days, 0, 0, { type: "work" });
    expect(next[0]?.events?.[0]?.napFrom).toBeUndefined();
  });
});

describe("shiftLogEditMessages", () => {
  it("blocks rest after end shift", () => {
    const messages = shiftLogEditMessages(
      [
        {
          events: [
            { time: "2026-05-25T06:00:00.000Z", type: "work" },
            { time: "2026-05-25T14:00:00.000Z", type: "stop" },
            { time: "2026-05-25T15:00:00.000Z", type: "break" },
          ],
        },
      ],
      "2026-05-24"
    );
    expect(messages.some((m) => m.toLowerCase().includes("rest"))).toBe(true);
  });
});

describe("sortShiftLogDayEvents", () => {
  it("orders events by time within each day", () => {
    const sorted = sortShiftLogDayEvents([
      {
        events: [
          { time: "2026-05-25T10:00:00.000Z", type: "stop" },
          { time: "2026-05-25T06:00:00.000Z", type: "work" },
        ],
      },
    ]);
    expect(sorted[0]?.events?.map((e) => e.type)).toEqual(["work", "stop"]);
  });
});
