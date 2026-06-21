import { describe, expect, it } from "vitest";
import { buildCameraAlertsFromRows } from "@/lib/integrations/autonomise-alerts";

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
      ]
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].eventWebhookPending).toBe(true);
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
});
