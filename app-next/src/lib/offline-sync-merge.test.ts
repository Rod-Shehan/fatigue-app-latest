import { describe, expect, it } from "vitest";
import type { FatigueSheet } from "./api";
import type { PendingWrite } from "./offline";
import {
  coalesceLocalSheets,
  countSheetChecklists,
  countSheetEvents,
  findServerTwinForLocal,
  hasPendingUpdateForSheet,
  isLocalSheetTempId,
  isNotFoundError,
  mergeLocalSheetWithPendingUpdates,
  findRicherLocalSheet,
  mergeNetworkSheetListWithLocal,
  overlayLocalSheetOnNetwork,
  pendingTouchesAttestation,
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
        last_24h_break: "2026-07-17",
        last_24h_break_start: "2026-07-16T16:00:00.000Z",
        last_24h_break_end: "2026-07-17T16:00:00.000Z",
      })
    );
    expect(payload.driver_name).toBe("Jaydin Ireland");
    expect(payload.days?.[0]?.events?.[0]?.type).toBe("work");
    expect(payload.last_24h_break).toBe("2026-07-17");
    expect(payload.last_24h_break_start).toBe("2026-07-16T16:00:00.000Z");
    expect(payload.last_24h_break_end).toBe("2026-07-17T16:00:00.000Z");
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

  it("keeps local sheet when checklist count is richer but event counts match", () => {
    const checklist = {
      id: "c1",
      type: "ffw" as const,
      schemaVersion: 1,
      status: "completed" as const,
      completedAtUtc: "2026-07-14T09:00:00.000Z",
      items: [],
      signatures: [],
    };
    const local = sheet({
      id: "s1",
      days: [
        {
          events: [{ time: "2026-07-14T10:00:00.000Z", type: "work" }],
          checklists: [checklist],
        },
      ],
    });
    const server = sheet({
      id: "s1",
      days: [{ events: [{ time: "2026-07-14T10:00:00.000Z", type: "work" }], checklists: [] }],
    });
    expect(countSheetEvents(local)).toBe(countSheetEvents(server));
    expect(countSheetChecklists(local)).toBe(1);
    expect(countSheetChecklists(server)).toBe(0);
    expect(shouldPreferLocalSheet(local, server)).toBe(true);
    expect(shouldPreferLocalSheet(server, local)).toBe(false);
  });

  it("keeps an on-device current week that the network list omitted", () => {
    const localOnly = sheet({
      id: "local-week",
      driver_name: "Jaydin Ireland",
      week_starting: "2026-10-18",
      days: [{ events: [{ time: "2026-10-19T00:10:00.000Z", type: "work" }] }],
    });
    const network = [
      sheet({
        id: "past",
        driver_name: "Jaydin Ireland",
        week_starting: "2026-10-11",
        days: [],
        status: "draft",
      }),
    ];
    const merged = mergeNetworkSheetListWithLocal(network, [localOnly]);
    expect(merged.some((s) => s.id === "local-week")).toBe(true);
    expect(countSheetEvents(merged.find((s) => s.id === "local-week"))).toBe(1);
  });

  it("overlays richer local days onto a server row with empty list meta", () => {
    const network = sheet({
      id: "s1",
      driver_name: "Jaydin Ireland",
      week_starting: "2026-10-18",
      days: [],
    });
    const local = sheet({
      id: "s1",
      driver_name: "Jaydin Ireland",
      week_starting: "2026-10-18",
      days: [{ events: [{ time: "2026-10-19T00:10:00.000Z", type: "work" }] }],
    });
    const overlaid = overlayLocalSheetOnNetwork(local, network);
    expect(countSheetEvents(overlaid)).toBe(1);
    expect(findRicherLocalSheet(network, [local])?.id).toBe("s1");
  });

  it("does not treat a leftover device signature as signed when the server week is unsigned", () => {
    const network = sheet({
      id: "s1",
      driver_name: "Jaydin Ireland",
      week_starting: "2026-10-11",
      status: "draft",
      signature: null,
      signed_at: undefined,
      days: [],
    });
    const local = sheet({
      id: "s1",
      driver_name: "Jaydin Ireland",
      week_starting: "2026-10-11",
      status: "completed",
      signature: "data:image/png;base64,x",
      signed_at: "2026-10-17T08:00:00.000Z",
      days: [],
    });
    const overlaid = overlayLocalSheetOnNetwork(local, network);
    expect(overlaid.status).toBe("draft");
    expect(overlaid.signature).toBeNull();
    expect(overlaid.signed_at).toBeUndefined();
    expect(findRicherLocalSheet(network, [local])).toBeNull();
  });

  it("keeps an unsynced device signature only when a pending sign is still queued", () => {
    const network = sheet({
      id: "s1",
      driver_name: "Jaydin Ireland",
      week_starting: "2026-10-11",
      status: "draft",
      signature: null,
      days: [],
    });
    const local = sheet({
      id: "s1",
      driver_name: "Jaydin Ireland",
      week_starting: "2026-10-11",
      status: "completed",
      signature: "data:image/png;base64,x",
      signed_at: "2026-10-19T06:00:00.000Z",
      days: [],
    });
    const pending: PendingWrite[] = [
      {
        id: 1,
        type: "update",
        sheetId: "s1",
        data: {
          status: "completed",
          signature: "data:image/png;base64,x",
          signed_at: "2026-10-19T06:00:00.000Z",
        },
        at: 1,
      },
    ];
    expect(pendingTouchesAttestation(pending, "s1")).toBe(true);
    const overlaid = overlayLocalSheetOnNetwork(local, network, { keepLocalAttestation: true });
    expect(overlaid.status).toBe("completed");
    expect(overlaid.signature).toBe("data:image/png;base64,x");
  });

  it("coalesces store + list copies and keeps the richer days", () => {
    const emptyListRow = sheet({
      id: "s1",
      week_starting: "2026-10-11",
      days: [],
    });
    const stored = sheet({
      id: "s1",
      week_starting: "2026-10-11",
      days: [{ events: [{ time: "2026-10-12T18:24:00.000Z", type: "stop" }] }],
    });
    const coalesced = coalesceLocalSheets([[emptyListRow], [stored]]);
    expect(coalesced).toHaveLength(1);
    expect(countSheetEvents(coalesced[0])).toBe(1);
  });

  it("finds a server twin for a local-* week and treats local-* ids as temp", () => {
    expect(isLocalSheetTempId("local-abc")).toBe(true);
    expect(isLocalSheetTempId("cmv3lghq40001jq0484rrd94w")).toBe(false);
    const localOnly = sheet({
      id: "local-week",
      driver_name: "Jaydin Ireland",
      week_starting: "2026-10-18T00:00:00.000Z",
      days: [{ events: [{ time: "2026-10-19T00:10:00.000Z", type: "work" }] }],
    });
    const twin = sheet({
      id: "server-week",
      driver_name: "Jaydin Ireland",
      week_starting: "2026-10-18",
      days: [],
    });
    expect(findServerTwinForLocal(localOnly, [localOnly, twin])?.id).toBe("server-week");
    expect(findServerTwinForLocal(localOnly, [localOnly])).toBeUndefined();
  });
});
