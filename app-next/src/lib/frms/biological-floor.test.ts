import { describe, expect, it } from "vitest";
import { biologicalFloorPct } from "./biological-floor";

describe("biologicalFloorPct", () => {
  it("equals combined when strain is zero (Rest has cleared)", () => {
    expect(biologicalFloorPct(48, 0)).toBe(48);
    expect(biologicalFloorPct(48, null)).toBe(48);
  });

  it("is below combined when strain is high, and never above combined", () => {
    const floor = biologicalFloorPct(58, 80);
    expect(floor).toBeLessThan(58);
    expect(floor).toBeGreaterThan(0);
  });

  it("round-trips the engine fusion formula", () => {
    const rTpma = 50;
    const tsi = 80;
    const combined = rTpma + (100 - rTpma) * (tsi / 100) * 0.2;
    expect(biologicalFloorPct(combined, tsi)).toBe(50);
  });
});
