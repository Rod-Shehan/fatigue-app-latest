import { describe, expect, it } from "vitest";
import type { FatigueSheet } from "./api";
import type { PendingWrite } from "./offline";
import {
  countSheetEvents,
  hasPendingUpdateForSheet,
  isNotFoundError,
  mergeLocalSheetWithPendingUpdates,
  shouldPreferLocalSheet,
  toSheetUpdatePayload,
} from "./offline-sync-merge";

function sheet(partial: Partial<FatigueSheet> & { id: string }): FatigueSheet {
  return {
    driver_name: "Jaydin",
    week_starting: "2026-07-12",
    days: [],
    status: "draft",
    ...partial,
  } as FatigueSheet;
}

describe("offline-sync-merge", () => {
  it("detects pending updates for a sheet", () => {
    const pending: PendingWrite[] = [
      { id: 1, type: "update", sheetId: "a", data: { driver_name: "A" }, at: 1 },
      { id: 2, type: "create", tempId: "local-1", data: {}, at: 2 },
    ];
    expect(hasPendingUpdateForSheet(pending, "a")).toBe(true);
    expect(hasPendingUpdateForSheet(pending, "b")).toBe(false);
  });

  it("merges pending updates over a wiped local cache so work events are recovered", () => {
    const pending: PendingWrite[] = [
      {
        id: 1,
        type: "update",
        sheetId: "s1",
        data: {
          days: [{ events: [{ time: "2026-07-14T10:00:00.000Z", type: "work" }] }],
        },
        at: 1,
      },
      {
        id: 2,
        type: "update",
        sheetId: "s1",
        data: {
          days: [
            {
              events: [
                { time: "2026-07-14T10:00:00.000Z", type: "work" },
                { time: "2026-07-14T13:55:00.000Z", type: "break" },
              ],
            },
          ],
        },
        at: 2,
      },
    ];
    // Local cache wiped by empty network GET
    const merged = mergeLocalSheetWithPendingUpdates(
      sheet({ id: "s1", days: [{ events: [] }] }),
      pending,
      "s1"
    );
    expect(countSheetEvents(merged)).toBe(2);
    expect(merged?.days?.[0]?.events?.[1]?.type).toBe("break");
  });

  it("builds update payload from merged sheet", () => {
    const payload = toSheetUpdatePayload(
      sheet({
        id: "s1",
        driver_name: "Jaydin Ireland",
        days: [{ events: [{ time: "t", type: "work" }] }],
      })
    );
    expect(payload.driver_name).toBe("Jaydin Ireland");
    expect(payload.days?.[0]?.events?.[0]?.type).toBe("work");
    expect(payload).not.toHaveProperty("id");
  });

  it("recognises not-found sync errors", () => {
    expect(isNotFoundError(Object.assign(new Error("Not found"), { status: 404 }))).toBe(true);
    expect(isNotFoundError(new Error("Forbidden"))).toBe(false);
  });

  it("keeps richer local sheet over empty server after backup restore", () => {
    const local = sheet({
      id: "s1",
      days: [
        {
          events: [
            { time: "2026-07-14T10:00:00.000Z", type: "work" },
            { time: "2026-07-14T13:55:00.000Z", type: "break" },
          ],
        },
      ],
    });
    const server = sheet({ id: "s1", days: [{ events: [] }] });
    expect(shouldPreferLocalSheet(local, server)).toBe(true);
    expect(shouldPreferLocalSheet(server, local)).toBe(false);
  });
});
