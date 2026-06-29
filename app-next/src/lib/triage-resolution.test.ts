import { describe, expect, it } from "vitest";
import {
  formatResolutionAuditNote,
  isIncidentResolutionActionType,
  resolutionActionLabel,
} from "@/lib/triage-resolution";

describe("triage-resolution", () => {
  it("validates action types", () => {
    expect(isIncidentResolutionActionType("call_driver")).toBe(true);
    expect(isIncidentResolutionActionType("invalid")).toBe(false);
  });

  it("formats audit notes", () => {
    expect(formatResolutionAuditNote("toolboxed", "Driver stood down until Monday")).toBe(
      "Toolboxed — Driver stood down until Monday"
    );
    expect(resolutionActionLabel("request_rest_break")).toBe("Ordered Rest Break");
  });
});
