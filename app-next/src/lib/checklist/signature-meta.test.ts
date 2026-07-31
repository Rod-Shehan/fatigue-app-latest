import { describe, it, expect } from "vitest";
import { buildSignatureCapture, formatSignedAtUtc } from "./signature-meta";

describe("buildSignatureCapture", () => {
  it("stores UTC ISO and AWST label with optional geo", () => {
    const now = new Date("2026-07-31T02:30:00.000Z");
    const cap = buildSignatureCapture({
      pngDataUrl: "data:image/png;base64,abc",
      now,
      lat: -31.95,
      lng: 115.86,
      accuracyM: 12,
    });
    expect(cap.pngDataUrl).toBe("data:image/png;base64,abc");
    expect(cap.signedAtUtc).toBe(formatSignedAtUtc(now));
    expect(cap.signedAtAwst).toMatch(/2026/);
    expect(cap.lat).toBe(-31.95);
    expect(cap.lng).toBe(115.86);
    expect(cap.accuracyM).toBe(12);
  });

  it("allows null geo when permission denied", () => {
    const cap = buildSignatureCapture({ pngDataUrl: "data:image/png;base64,x" });
    expect(cap.lat).toBeNull();
    expect(cap.lng).toBeNull();
  });
});
