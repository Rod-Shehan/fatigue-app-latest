import { describe, expect, it } from "vitest";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";

describe("manager experience copy", () => {
  it("hero intro does not repeat page subtitle", () => {
    expect(MANAGER_EXPERIENCE.HERO_WEEK_INTRO).not.toBe(MANAGER_EXPERIENCE.PAGE_SUBTITLE);
    expect(MANAGER_EXPERIENCE.HERO_WEEK_INTRO).not.toContain("Identify fatigue exposure early");
  });
});
