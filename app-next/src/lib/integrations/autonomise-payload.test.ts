import { describe, expect, it } from "vitest";
import {
  buildAutonomiseIdempotencyKey,
  extractAutonomiseFields,
} from "@/lib/integrations/autonomise-payload";
import { verifyAutonomiseWebhookSecret } from "@/lib/integrations/autonomise-webhook-auth";

describe("autonomise-payload", () => {
  it("extracts nested VT3600 alarm id and VRN", () => {
    const fields = extractAutonomiseFields({
      eventId: "evt-123",
      data: {
        alarmId: "VT3600AI_ALARM_DSM_Fatigue",
        vehicle: { vehicleRegistration: "1ABC123" },
        driverName: "Pat Driver",
      },
    });
    expect(fields.vendorAlarmId).toBe("VT3600AI_ALARM_DSM_Fatigue");
    expect(fields.vendorEventId).toBe("evt-123");
    expect(fields.vehicleRego).toBe("1ABC123");
    expect(fields.driverName).toBe("Pat Driver");
  });

  it("extracts media url and event link", () => {
    const fields = extractAutonomiseFields({
      eventId: "evt-456",
      videoUrl: "https://cdn.example/clip.mp4",
    });
    expect(fields.mediaUrl).toBe("https://cdn.example/clip.mp4");
    expect(fields.linkedEventId).toBe("evt-456");
  });

  it("builds event idempotency key", () => {
    const fields = extractAutonomiseFields({ eventId: "abc" });
    expect(buildAutonomiseIdempotencyKey("event", fields, {})).toBe("event:abc");
  });
});

describe("autonomise-webhook-auth", () => {
  it("accepts matching secret", () => {
    expect(verifyAutonomiseWebhookSecret("my-secret", "my-secret")).toBe(true);
  });

  it("rejects wrong secret", () => {
    expect(verifyAutonomiseWebhookSecret("wrong", "my-secret")).toBe(false);
  });
});
