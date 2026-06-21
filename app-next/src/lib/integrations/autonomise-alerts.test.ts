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
});
