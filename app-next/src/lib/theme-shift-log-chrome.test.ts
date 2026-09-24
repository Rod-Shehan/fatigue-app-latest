import { describe, expect, it } from "vitest";
import { shiftLogTypeHeroChrome } from "./theme";

describe("shiftLogTypeHeroChrome", () => {
  it("uses hero puck hues for work, rest, and end shift", () => {
    expect(shiftLogTypeHeroChrome("work").trigger).toContain("driver-puck-blue");
    expect(shiftLogTypeHeroChrome("break").trigger).toContain("driver-puck-amber");
    expect(shiftLogTypeHeroChrome("stop").trigger).toContain("driver-puck-red");
  });

  it("uses slate for other work and parked, emerald for sleeper and non-work", () => {
    expect(shiftLogTypeHeroChrome("other_work").trigger).toContain("driver-puck-slate");
    expect(shiftLogTypeHeroChrome("stationary_rest").trigger).toContain("driver-puck-slate");
    expect(shiftLogTypeHeroChrome("sleeper_berth").trigger).toContain("driver-puck-emerald");
    expect(shiftLogTypeHeroChrome("non_work").trigger).toContain("driver-puck-emerald");
  });
});
