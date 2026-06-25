import { describe, expect, it } from "vitest";
import {
  buildCameraAlertsFromRows,
  linkedEventKeysFromMediaRows,
  missingEventKeysForMedia,
} from "@/lib/integrations/autonomise-alerts";

const base = {
  vendorAlarmId: "VT3600AI_ALARM_DSM_Fatigue",
  vehicleRego: "1ABC123",
  driverName: "Pat",
  linkedEventId: null,
  mediaUrl: null,
  accepted: true,
  rejectReason: null,
};

describe("buildCameraAlertsFromRows", () => {
  it("attaches media by vendor event id", () => {
    const events = [
      {
        ...base,
        id: "e1",
        kind: "event",
        vendorEventId: "evt-1",
        receivedAt: new Date("2026-06-21T10:00:00Z"),
      },
    ];
    const media = [
      {
        ...base,
        id: "m1",
        kind: "media",
        vendorEventId: null,
        linkedEventId: "evt-1",
        mediaUrl: "https://example.com/clip.mp4",
        receivedAt: new Date("2026-06-21T10:01:00Z"),
      },
    ];
    const alerts = buildCameraAlertsFromRows(events, media);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].mediaUrl).toBe("https://example.com/clip.mp4");
    expect(alerts[0].mediaPending).toBe(false);
    expect(alerts[0].displayName).toBe("Fatigue");
  });

  it("marks media pending when accepted event has no clip", () => {
    const alerts = buildCameraAlertsFromRows(
      [
        {
          ...base,
          id: "e1",
          kind: "event",
          vendorEventId: "evt-2",
          receivedAt: new Date(),
        },
      ],
      []
    );
    expect(alerts[0].mediaPending).toBe(true);
    expect(alerts[0].triageStatus).toBe("pending");
  });

  it("maps triage decisions onto alerts", () => {
    const decidedAt = new Date("2026-06-22T08:00:00Z");
    const alerts = buildCameraAlertsFromRows(
      [
        {
          ...base,
          id: "e1",
          kind: "event",
          vendorEventId: "evt-3",
          receivedAt: new Date(),
        },
      ],
      [],
      undefined,
      new Map([
        [
          "e1",
          {
            decision: "authorized",
            note: "Coaching booked",
            decidedByEmail: "mgr@example.com",
            decidedAt,
          },
        ],
      ])
    );
    expect(alerts[0].triageStatus).toBe("authorized");
    expect(alerts[0].triageNote).toBe("Coaching booked");
    expect(alerts[0].triageDecidedBy).toBe("mgr@example.com");
  });

  it("surfaces orphan media when event webhook never arrived", () => {
    const alerts = buildCameraAlertsFromRows(
      [],
      [
        {
          ...base,
          id: "m-orphan",
          kind: "media",
          vendorEventId: "914543cb-7aea-4c64-a324-85f9bb9e70d3",
          linkedEventId: "914543cb-7aea-4c64-a324-85f9bb9e70d3",
          receivedAt: new Date("2026-06-21T12:05:00Z"),
        },
      ],
      undefined,
      undefined,
      true
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].eventWebhookPending).toBe(true);
  });

  it("does not surface orphan media by default", () => {
    const alerts = buildCameraAlertsFromRows(
      [],
      [
        {
          ...base,
          id: "m-orphan",
          kind: "media",
          vendorEventId: "914543cb-7aea-4c64-a324-85f9bb9e70d3",
          linkedEventId: "914543cb-7aea-4c64-a324-85f9bb9e70d3",
          mediaUrl: "https://example.com/clip.mp4",
          receivedAt: new Date("2026-06-21T12:05:00Z"),
        },
      ]
    );
    expect(alerts).toHaveLength(0);
  });

  it("does not treat rejected event webhook as orphan media", () => {
    const eventId = "a72e581d-3c0d-4240-b093-905af32562a5";
    const alerts = buildCameraAlertsFromRows(
      [
        {
          ...base,
          id: "e-rejected",
          kind: "event",
          vendorEventId: eventId,
          accepted: false,
          rejectReason: "missing_alarm_id",
          receivedAt: new Date("2026-06-21T13:22:00Z"),
        },
      ],
      [
        {
          ...base,
          id: "m-paired",
          kind: "media",
          vendorEventId: eventId,
          linkedEventId: eventId,
          receivedAt: new Date("2026-06-21T13:23:00Z"),
        },
      ],
      [eventId]
    );
    expect(alerts.filter((a) => a.eventWebhookPending)).toHaveLength(0);
  });

  it("pairs ADAS media with hydrated event outside the initial event batch", () => {
    const eventId = "4d9bedfc-hydrated-outside-batch";
    const media = [
      {
        ...base,
        id: "m1",
        kind: "media",
        vendorEventId: eventId,
        linkedEventId: eventId,
        mediaUrl: "https://video.autonomise.ai/clip.mp4",
        receivedAt: new Date("2026-06-24T00:47:00Z"),
      },
    ];
    const hydratedEvent = {
      ...base,
      id: "e-hydrated",
      kind: "event",
      vendorAlarmId: "VT3600AI_ALARM_ADAS_FollowingDistanceWarning",
      vendorEventId: eventId,
      receivedAt: new Date("2026-06-24T00:46:00Z"),
    };

    expect(missingEventKeysForMedia(media, [])).toEqual([eventId]);

    const alerts = buildCameraAlertsFromRows([hydratedEvent], media, [eventId]);
    expect(alerts.filter((a) => a.eventWebhookPending)).toHaveLength(0);
    expect(alerts[0].displayName).toBe("Following Distance Warning");
    expect(alerts[0].mediaUrl).toBe("https://video.autonomise.ai/clip.mp4");
  });

  it("collects linked event ids from media payload fields", () => {
    const keys = linkedEventKeysFromMediaRows([
      {
        ...base,
        id: "m1",
        kind: "media",
        vendorEventId: null,
        linkedEventId: null,
        receivedAt: new Date(),
        payload: { linkedEventId: "from-payload" },
      },
    ]);
    expect(keys).toEqual(["from-payload"]);
  });
});
