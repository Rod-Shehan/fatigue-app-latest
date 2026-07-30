import { describe, it, expect } from "vitest";
import { sanitizePdfPlainText } from "./pdf-plain-text";

describe("sanitizePdfPlainText", () => {
  it("replaces >= and x symbols used in compliance copy", () => {
    const raw =
      'Need ≥2×24h continuous non-work in any 14-day period (or meet 28-day alternative: 4×24h + ≤144h work)';
    expect(sanitizePdfPlainText(raw)).toBe(
      'Need >=2x24h continuous non-work in any 14-day period (or meet 28-day alternative: 4x24h + <=144h work)'
    );
  });

  it("normalizes bullets and quotes", () => {
    expect(sanitizePdfPlainText("• “rest” – ok…")).toBe('- "rest" - ok...');
  });
});
