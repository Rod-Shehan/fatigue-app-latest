import { describe, expect, it } from "vitest";
import {
  CHECKLIST_EMAIL_MISSING_MESSAGE,
  checklistDeliveryEmailReady,
  normalizeChecklistDeliveryEmail,
  resolveChecklistDeliveryTo,
} from "./checklist-email";

describe("checklist delivery email", () => {
  it("accepts a valid address", () => {
    expect(normalizeChecklistDeliveryEmail(" records@fleet.com ")).toEqual({
      email: "records@fleet.com",
    });
    expect(checklistDeliveryEmailReady("records@fleet.com")).toBe(true);
  });

  it("clears on empty", () => {
    expect(normalizeChecklistDeliveryEmail("")).toEqual({ email: null });
    expect(normalizeChecklistDeliveryEmail(null)).toEqual({ email: null });
    expect(checklistDeliveryEmailReady(null)).toBe(false);
  });

  it("rejects invalid", () => {
    expect(normalizeChecklistDeliveryEmail("not-an-email")).toEqual({
      error: "Not a valid email address",
    });
  });

  it("prefers the saved override over login email", () => {
    expect(
      resolveChecklistDeliveryTo({
        checklistDeliveryEmail: "packs@fleet.com",
        loginEmail: "driver@fleet.com",
      })
    ).toEqual({ to: "packs@fleet.com" });
  });

  it("falls back to login email when override is empty", () => {
    expect(
      resolveChecklistDeliveryTo({
        checklistDeliveryEmail: null,
        loginEmail: "driver@fleet.com",
      })
    ).toEqual({ to: "driver@fleet.com" });
  });

  it("errors when neither is usable", () => {
    expect(resolveChecklistDeliveryTo({ checklistDeliveryEmail: null, loginEmail: null })).toEqual({
      error: CHECKLIST_EMAIL_MISSING_MESSAGE,
    });
  });
});
