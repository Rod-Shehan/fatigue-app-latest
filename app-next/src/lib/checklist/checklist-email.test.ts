import { describe, expect, it } from "vitest";
import {
  CHECKLIST_EMAIL_MISSING_MESSAGE,
  checklistDeliveryEmailReady,
  checklistPackRecipientEmails,
  formatChecklistPackToLabel,
  normalizeChecklistDeliveryEmail,
  normalizeChecklistPackPatch,
  resolveChecklistPackTo,
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
});

describe("fleet checklist PDF pack emails", () => {
  it("collects pack plus unique spare emails", () => {
    expect(
      checklistPackRecipientEmails({
        email: "packs@fleet.example",
        spareEmail1: "office@fleet.example",
        spareEmail2: "PACKS@fleet.example",
      })
    ).toEqual(["packs@fleet.example", "office@fleet.example"]);
  });

  it("resolves To from the org pack list", () => {
    expect(
      resolveChecklistPackTo({
        email: "packs@fleet.example",
        spareEmail1: "office@fleet.example",
        spareEmail2: null,
      })
    ).toEqual({ to: ["packs@fleet.example", "office@fleet.example"] });
  });

  it("errors when no pack address is set", () => {
    expect(
      resolveChecklistPackTo({
        email: null,
        spareEmail1: null,
        spareEmail2: null,
      })
    ).toEqual({ error: CHECKLIST_EMAIL_MISSING_MESSAGE });
  });

  it("formats a To label for UI copy", () => {
    expect(formatChecklistPackToLabel(["a@fleet.example", "b@fleet.example"])).toBe(
      "a@fleet.example, b@fleet.example"
    );
  });

  it("normalizes pack patch fields", () => {
    expect(
      normalizeChecklistPackPatch({
        checklistPackEmail: "  records@fleet.example  ",
        checklistPackSpareEmail1: "",
      })
    ).toEqual({
      checklistPackEmail: "records@fleet.example",
      checklistPackSpareEmail1: null,
    });
  });

  it("rejects a bad spare pack email", () => {
    expect(normalizeChecklistPackPatch({ checklistPackSpareEmail1: "nope" })).toEqual({
      error: "Spare email 1 is not a valid email address",
    });
  });
});
