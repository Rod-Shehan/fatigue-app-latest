import { describe, expect, it } from "vitest";
import {
  isRestNapTagged,
  openRestIsNapping,
  patchOpenRestNapFrom,
  restNapOverlapsBlock,
  taggedRestNapWindowsFromEvents,
} from "./rest-nap";

describe("rest-nap", () => {
  it("tags only Rest events that have napFrom", () => {
    expect(isRestNapTagged({ time: "2026-08-16T10:00:00.000Z", type: "break" })).toBe(false);
    expect(
      isRestNapTagged({
        time: "2026-08-16T10:00:00.000Z",
        type: "break",
        napFrom: "2026-08-16T10:15:00.000Z",
      })
    ).toBe(true);
    expect(
      isRestNapTagged({
        time: "2026-08-16T10:00:00.000Z",
        type: "work",
        napFrom: "2026-08-16T10:15:00.000Z",
      })
    ).toBe(false);
  });

  it("patches napFrom on the open Rest and clears it on undo", () => {
    const restAt = "2026-08-16T02:00:00.000Z";
    const days = [
      { events: [{ time: restAt, type: "break" }] },
      { events: [] as { time: string; type: string }[] },
    ];
    const tagged = patchOpenRestNapFrom(days, "2026-08-16T02:20:00.000Z");
    expect(tagged[0].events?.[0]?.napFrom).toBe("2026-08-16T02:20:00.000Z");
    expect(openRestIsNapping(tagged.flatMap((d) => d.events ?? []))).toBe(true);

    const cleared = patchOpenRestNapFrom(tagged, null);
    expect(cleared[0].events?.[0]?.napFrom).toBeUndefined();
    expect(openRestIsNapping(cleared.flatMap((d) => d.events ?? []))).toBe(false);
  });

  it("does not start nap before the Rest tap", () => {
    const restAt = "2026-08-16T02:00:00.000Z";
    const days = [{ events: [{ time: restAt, type: "break" }] }];
    const tagged = patchOpenRestNapFrom(days, "2026-08-16T01:00:00.000Z");
    expect(tagged[0].events?.[0]?.napFrom).toBe(restAt);
  });

  it("leaves work-open days unchanged", () => {
    const days = [{ events: [{ time: "2026-08-16T02:00:00.000Z", type: "work" }] }];
    expect(patchOpenRestNapFrom(days, "2026-08-16T02:20:00.000Z")).toBe(days);
  });

  it("builds a nap window from napFrom until the next event", () => {
    const events = [
      { time: "2026-08-16T02:00:00.000Z", type: "break", napFrom: "2026-08-16T02:10:00.000Z" },
      { time: "2026-08-16T03:00:00.000Z", type: "work" },
    ];
    const windows = taggedRestNapWindowsFromEvents(events, Date.parse("2026-08-16T04:00:00.000Z"));
    expect(windows).toEqual([
      {
        startMs: Date.parse("2026-08-16T02:10:00.000Z"),
        endMs: Date.parse("2026-08-16T03:00:00.000Z"),
      },
    ]);
    expect(restNapOverlapsBlock(Date.parse("2026-08-16T02:15:00.000Z"), 15 * 60 * 1000, windows)).toBe(
      true
    );
    expect(restNapOverlapsBlock(Date.parse("2026-08-16T02:00:00.000Z"), 15 * 60 * 1000, windows)).toBe(
      false
    );
  });
});
