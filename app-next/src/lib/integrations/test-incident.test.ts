import { describe, expect, it } from "vitest";
import {
  buildTestIncidentPayload,
  TEST_INCIDENT_KINDS,
} from "@/lib/integrations/test-incident";
import {
  TEST_INCIDENT_EVENT_ID_PREFIX,
  TEST_INCIDENT_REGO_PREFIX,
} from "@/lib/integrations/test-incident-config";

describe("test-incident", () => {
  it("builds Autonomise-shaped fatigue payload", () => {
    const { payload, eventId, vehicleRegistration } = buildTestIncidentPayload({
      kind: "fatigue",
      eventId: "drill-fixed-1",
      vehicleRegistration: "TEST001",
    });
    expect(eventId).toBe("drill-fixed-1");
    expect(vehicleRegistration).toBe("TEST001");
    expect(payload.alarmId).toBe("VT3600AI_ALARM_DSM_Fatigue");
    expect(payload.eventId).toBe("drill-fixed-1");
    expect(payload.source).toBe("circadia-test-desk");
  });

  it("defaults rego and event id prefixes", () => {
    const fatigue = buildTestIncidentPayload({ kind: "fatigue" });
    const distraction = buildTestIncidentPayload({ kind: "distraction" });
    expect(fatigue.vehicleRegistration.startsWith(TEST_INCIDENT_REGO_PREFIX)).toBe(true);
    expect(fatigue.eventId.startsWith(TEST_INCIDENT_EVENT_ID_PREFIX)).toBe(true);
    expect(distraction.payload.alarmId).toBe("VT3600AI_ALARM_DSM_Distracted");
  });

  it("supports both drill kinds", () => {
    expect(TEST_INCIDENT_KINDS).toEqual(["fatigue", "distraction"]);
  });
});
