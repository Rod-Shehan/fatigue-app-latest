import { describe, expect, it } from "vitest";
import {
  commandOperatorDisplayName,
  lifecycleStatusToManagerDecision,
  mergeTriageByIngestId,
} from "@/lib/integrations/command-triage-sync";
import type { CameraAlertTriageRecord } from "@/lib/integrations/camera-alert-triage";

function triageRecord(ingestEventId: string, decision: "authorized" | "dismissed"): CameraAlertTriageRecord {
  return {
    ingestEventId,
    vendorEventId: null,
    decision,
    note: null,
    falsePositiveReasons: [],
    decidedByUserId: "u1",
    decidedByEmail: "test@example.com",
    decidedAt: new Date("2026-06-29T10:00:00Z"),
  };
}

describe("lifecycleStatusToManagerDecision", () => {
  it("maps pending to null", () => {
    expect(lifecycleStatusToManagerDecision("PENDING_TRIAGE")).toBeNull();
  });

  it("maps false positive to dismissed", () => {
    expect(lifecycleStatusToManagerDecision("VERIFIED_FALSE_POSITIVE")).toBe("dismissed");
  });

  it("maps verified fatigue and downstream to authorized", () => {
    expect(lifecycleStatusToManagerDecision("VERIFIED_TRUE_FATIGUE")).toBe("authorized");
    expect(lifecycleStatusToManagerDecision("INTERVENTION_SENT")).toBe("authorized");
    expect(lifecycleStatusToManagerDecision("CLOSED")).toBe("authorized");
  });
});

describe("mergeTriageByIngestId", () => {
  it("prefers existing manager triage over command overlay", () => {
    const manager = new Map([["e1", triageRecord("e1", "dismissed")]]);
    const command = new Map([["e1", triageRecord("e1", "authorized")]]);
    const merged = mergeTriageByIngestId(manager, command);
    expect(merged.get("e1")?.decision).toBe("dismissed");
  });

  it("fills command triage when manager has not decided", () => {
    const manager = new Map<string, CameraAlertTriageRecord>();
    const command = new Map([["e2", triageRecord("e2", "authorized")]]);
    const merged = mergeTriageByIngestId(manager, command);
    expect(merged.get("e2")?.decision).toBe("authorized");
  });
});

describe("commandOperatorDisplayName", () => {
  it("formats operator name for manager UI", () => {
    expect(commandOperatorDisplayName({ fullName: "Rod", email: null })).toBe("Rod (Command)");
  });
});
