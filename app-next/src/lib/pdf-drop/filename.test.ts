import { describe, expect, it } from "vitest";
import {
  clientDropFolderPath,
  safePdfDropSegment,
  weekFolderLabel,
  weekTripSheetDropPath,
} from "@/lib/pdf-drop/filename";
import { parsePdfDropProvider, pdfDropStatus } from "@/lib/pdf-drop/config";
import { parseWeekStarting } from "@/lib/pdf-drop/drop-week";
import { assertCircadiaDriveMailbox } from "@/lib/pdf-drop/google-auth";
import { CIRCADIA_DRIVE_GMAIL, googleDriveMailbox } from "@/lib/pdf-drop/mailbox";

describe("pdf-drop filename", () => {
  it("uses a company folder the client will recognise", () => {
    expect(clientDropFolderPath("Acme Haul", "acme-haul")).toBe("Circadia PDF drop/Acme Haul");
    expect(clientDropFolderPath("Acme/Haul", "acme")).toBe("Circadia PDF drop/Acme Haul");
  });

  it("names week folders and driver PDFs in plain language", () => {
    expect(weekFolderLabel("2026-08-23")).toBe("week 23 Aug 2026");
    expect(
      weekTripSheetDropPath({
        legalName: "Acme Haul",
        slug: "acme-haul",
        weekStarting: "2026-08-23",
        driverName: "Rob Sherman",
      })
    ).toBe("Circadia PDF drop/Acme Haul/week 23 Aug 2026/Rob Sherman.pdf");
    expect(safePdfDropSegment("a/b\\c")).toBe("a-b-c");
  });
});

describe("pdf-drop config", () => {
  it("defaults to off and leaves Dropbox unwired", () => {
    const prev = process.env.PDF_DROP_PROVIDER;
    delete process.env.PDF_DROP_PROVIDER;
    expect(parsePdfDropProvider()).toBe("off");
    process.env.PDF_DROP_PROVIDER = "dropbox";
    const status = pdfDropStatus({
      legalName: "Acme",
      slug: "acme",
      shareEmail: "records@acme.test",
    });
    expect(status.configured).toBe(false);
    expect(status.missing.join(" ")).toMatch(/Dropbox/i);
    expect(status.mailbox).toBe(CIRCADIA_DRIVE_GMAIL);
    if (prev === undefined) delete process.env.PDF_DROP_PROVIDER;
    else process.env.PDF_DROP_PROVIDER = prev;
  });

  it("accepts a calendar week starting date only", () => {
    expect(parseWeekStarting("2026-08-23")).toBe("2026-08-23");
    expect(parseWeekStarting("23/08/2026")).toBeNull();
  });

  it("locks the Drive mailbox to circadia24@gmail.com", () => {
    expect(googleDriveMailbox()).toBe("circadia24@gmail.com");
    expect(() => assertCircadiaDriveMailbox("other@gmail.com")).toThrow(/circadia24@gmail.com/);
    expect(() => assertCircadiaDriveMailbox("circadia24@gmail.com")).not.toThrow();
  });
});
