import { describe, expect, it } from "vitest";
import {
  PROSPECTIVE_RISK_REFERENCE,
  prospectiveReferenceCardsForMessage,
} from "@/lib/manager-prospective-risk-reference";

describe("PROSPECTIVE_RISK_REFERENCE", () => {
  it("has ISO/IEC oriented cards", () => {
    const titles = PROSPECTIVE_RISK_REFERENCE.cards.map((c) => c.title);
    expect(titles).toContain("ISO 31000 in Circadia");
    expect(titles).toContain("IEC 31010 techniques");
    expect(titles).toContain("Compliance vs prospective risk");
  });

  it("prospectiveReferenceCardsForMessage matches risk-related copy", () => {
    const cards = prospectiveReferenceCardsForMessage("elevated prospective run plan on 168h");
    expect(cards.some((c) => c.id === "iso-31000-process" || c.id === "iec-31010-techniques")).toBe(
      true
    );
  });
});
