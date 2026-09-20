/**
 * Org maintenance contact + outbound mail pathway tests (no network).
 */

import { describe, it, expect } from "vitest";
import {
  buildMaintenanceMailtoHref,
  isValidMaintenanceEmail,
  maintenanceContactEmailReady,
  maintenanceContactRecipientEmails,
  normalizeMaintenanceContactPatch,
} from "./maintenance-contact";
import { outboundEmailConfigured } from "./email/outbound";

describe("maintenance contact", () => {
  it("validates emails", () => {
    expect(isValidMaintenanceEmail("workshop@fleet.example")).toBe(true);
    expect(isValidMaintenanceEmail("not-an-email")).toBe(false);
  });

  it("normalizes empty strings to null", () => {
    const patch = normalizeMaintenanceContactPatch({
      maintenanceContactName: "  ",
      maintenanceContactEmail: "shop@example.com",
      maintenanceContactCompany: "ACME Workshop",
      maintenanceContactPhone: null,
    });
    expect(patch).toEqual({
      maintenanceContactName: null,
      maintenanceContactEmail: "shop@example.com",
      maintenanceContactCompany: "ACME Workshop",
      maintenanceContactPhone: null,
    });
  });

  it("rejects a bad spare email", () => {
    expect(normalizeMaintenanceContactPatch({ maintenanceSpareEmail1: "nope" })).toEqual({
      error: "Spare email 1 is not a valid email address",
    });
  });

  it("builds mailto when email ready", () => {
    const href = buildMaintenanceMailtoHref({
      contact: {
        name: "Sam",
        company: "Workshop Co",
        email: "shop@example.com",
        phone: null,
        spareEmail1: null,
        spareEmail2: null,
      },
      subject: "Prestart fault",
      body: "Tyres failed",
    });
    expect(href).toContain("mailto:shop@example.com");
    expect(href).toContain("subject=Prestart");
    expect(maintenanceContactEmailReady({ name: null, company: null, email: "shop@example.com", phone: null, spareEmail1: null, spareEmail2: null })).toBe(
      true
    );
  });

  it("collects workshop plus unique spare emails", () => {
    expect(
      maintenanceContactRecipientEmails({
        name: null,
        company: null,
        email: "workshop@fleet.example",
        phone: null,
        spareEmail1: "office@fleet.example",
        spareEmail2: "WORKSHOP@fleet.example",
      })
    ).toEqual(["workshop@fleet.example", "office@fleet.example"]);
  });
});

describe("outbound email config", () => {
  it("reports not configured without env", () => {
    const prevResend = process.env.RESEND_API_KEY;
    const prevFrom = process.env.EMAIL_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(outboundEmailConfigured()).toBe(false);
    if (prevResend !== undefined) process.env.RESEND_API_KEY = prevResend;
    if (prevFrom !== undefined) process.env.EMAIL_FROM = prevFrom;
  });
});
