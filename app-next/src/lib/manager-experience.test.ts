import { describe, expect, it } from "vitest";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";

describe("manager experience copy", () => {
  it("hero intro does not repeat page subtitle", () => {
    expect(MANAGER_EXPERIENCE.HERO_WEEK_INTRO).not.toBe(MANAGER_EXPERIENCE.PAGE_SUBTITLE);
    expect(MANAGER_EXPERIENCE.HERO_WEEK_INTRO).not.toContain("Identify fatigue exposure early");
  });

  it("assurance empty copy matches each week section", () => {
    expect(MANAGER_EXPERIENCE.EMPTY_ASSURANCE_PRIOR).not.toContain("this week");
    expect(MANAGER_EXPERIENCE.EMPTY_ASSURANCE_PRIOR).toContain("week before");
    expect(MANAGER_EXPERIENCE.SNAPSHOT_SUBTITLE).not.toContain("What the record shows");
    expect(MANAGER_EXPERIENCE.SNAPSHOT_SUBTITLE).toContain("Violations");
    expect(MANAGER_EXPERIENCE.SNAPSHOT_SUBTITLE).toContain("hard compliance");
  });
});
