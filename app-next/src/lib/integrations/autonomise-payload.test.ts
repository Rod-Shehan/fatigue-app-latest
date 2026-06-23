import { describe, expect, it } from "vitest";
import {
  buildAutonomiseIdempotencyKey,
  extractAutonomiseFields,
  parseFnolReference,
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

  it("does not treat Autonomise Speed eventTypes code 2 as fatigue", () => {
    const fields = extractAutonomiseFields({
      id: "MDBkMjA1NzRlYnwzZjBjZDliOC05ZTFkLTRlZjQtYTg2ZS02YTNhOGZkYWE3OWY=",
      eventTypes: [2],
      classification: 4,
    });
    expect(fields.vendorAlarmId).toBeNull();
    expect(fields.vendorEventId).toBe("3f0cd9b8-9e1d-4ef4-a86e-6a3a8fdaa79f");
  });

  it("maps MTS live fatigue eventTypes code 18 and device hardware id", () => {
    const fields = extractAutonomiseFields({
      id: "MDBkMjA1NzRlYnxhNzJlNTgxZC0zYzBkLTQyNDAtYjA5My05MDVhZjMyNTYyYTU=",
      eventTypes: [18],
      classification: 4,
      device: { hardwareId: "00d20574eb" },
    });
    expect(fields.vendorAlarmId).toBe("VT3600AI_ALARM_DSM_Fatigue");
    expect(fields.vendorEventId).toBe("a72e581d-3c0d-4240-b093-905af32562a5");
    expect(fields.deviceHardwareId).toBe("00d20574eb");
  });

  it("maps distraction and ADAS eventTypes for core_plus_adas", () => {
    expect(extractAutonomiseFields({ eventTypes: [20] }).vendorAlarmId).toBe(
      "VT3600AI_ALARM_DSM_Distracted"
    );
    expect(extractAutonomiseFields({ eventTypes: [22] }).vendorAlarmId).toBe(
      "VT3600AI_ALARM_ADAS_LaneDeparture"
    );
    expect(extractAutonomiseFields({ eventTypes: [23] }).vendorAlarmId).toBe(
      "VT3600AI_ALARM_ADAS_ForwardCollisionWarning"
    );
    expect(extractAutonomiseFields({ eventTypes: [28] }).vendorAlarmId).toBe(
      "VT3600AI_ALARM_ADAS_FollowingDistanceWarning"
    );
  });

  it("maps label-based distraction when webhook includes text type", () => {
    const fields = extractAutonomiseFields({
      event: { id: "evt-dist", type: "Distraction" },
    });
    expect(fields.vendorAlarmId).toBe("VT3600AI_ALARM_DSM_Distracted");
  });

  it("extracts MTS vehicle id when webhook has no VRN", () => {
    const fields = extractAutonomiseFields({
      id: "evt-1",
      eventTypes: [18],
      device: { hardwareId: "00d20574eb" },
      vehicle: { id: "e82f7ba8-759f-f011-8e62-6045bdfcbf17" },
    });
    expect(fields.vendorVehicleId).toBe("e82f7ba8-759f-f011-8e62-6045bdfcbf17");
    expect(fields.vehicleRego).toBeNull();
  });

  it("extracts vehicle VRN when present on webhook", () => {
    const fields = extractAutonomiseFields({
      eventId: "evt-2",
      vehicle: { vrn: "1ITY959" },
    });
    expect(fields.vehicleRego).toBe("1ITY959");
  });

  it("extracts media webhook nested event id (MTS pilot shape)", () => {
    const fields = extractAutonomiseFields(
      {
        id: "cf06a246-1674-4105-86fb-c750195eddea",
        type: 7,
        event: { id: "914543cb-7aea-4c64-a324-85f9bb9e70d3" },
      },
      "media"
    );
    expect(fields.mediaRecordId).toBe("cf06a246-1674-4105-86fb-c750195eddea");
    expect(fields.vendorEventId).toBe("914543cb-7aea-4c64-a324-85f9bb9e70d3");
    expect(fields.linkedEventId).toBe("914543cb-7aea-4c64-a324-85f9bb9e70d3");
    expect(buildAutonomiseIdempotencyKey("media", fields, {})).toBe(
      "media:cf06a246-1674-4105-86fb-c750195eddea"
    );
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

  it("parses FNOL base64 to event uuid", () => {
    const parsed = parseFnolReference(
      "MDBkMjA1NzRlYnwzZjBjZDliOC05ZTFkLTRlZjQtYTg2ZS02YTNhOGZkYWE3OWY="
    );
    expect(parsed.eventUuid).toBe("3f0cd9b8-9e1d-4ef4-a86e-6a3a8fdaa79f");
  });

  it("does not base64-decode plain event UUIDs (media webhook nested event.id)", () => {
    const eventId = "c3582234-3a49-49d7-9cd0-e89b50b48716";
    const parsed = parseFnolReference(eventId);
    expect(parsed.canonicalEventId).toBe(eventId);

    const fields = extractAutonomiseFields(
      {
        id: "16d65742-507a-4e8f-bd0e-ee078c4f72ea",
        type: 7,
        event: { id: eventId },
        device: { hardwareId: "00d2047b28" },
      },
      "media"
    );
    expect(fields.vendorEventId).toBe(eventId);
    expect(fields.linkedEventId).toBe(eventId);
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
