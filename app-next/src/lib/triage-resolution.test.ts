import { describe, expect, it } from "vitest";
import {
  formatResolutionAuditNote,
  isIncidentResolutionActionType,
  resolutionActionLabel,
} from "@/lib/triage-resolution";

describe("triage-resolution", () => {
  it("validates current action types", () => {
    expect(isIncidentResolutionActionType("driver_contacted_confirmed_ok")).toBe(true);
    expect(isIncidentResolutionActionType("other_outcome")).toBe(true);
    expect(isIncidentResolutionActionType("call_driver")).toBe(false);
    expect(isIncidentResolutionActionType("invalid")).toBe(false);
  });

  it("formats audit notes", () => {
    expect(
      formatResolutionAuditNote("driver_contacted_7h_break", "Driver agreed to rest at depot")
    ).toBe("Driver - contacted by phone, instructed to have 7 hour break — Driver agreed to rest at depot");
    expect(resolutionActionLabel("manager_no_contact")).toBe("Manager - not able to make contact");
  });

  it("labels legacy action types for historical rows", () => {
    expect(resolutionActionLabel("call_driver")).toBe("Phoned Driver");
    expect(resolutionActionLabel("toolboxed")).toBe("Toolboxed");
  });
});
