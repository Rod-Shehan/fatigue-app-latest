import { describe, expect, it } from "vitest";
import { HERO_CHOOSER_GHOST_MS, isHeroChooserGhostClick } from "./hero-chooser-guard";

describe("isHeroChooserGhostClick", () => {
  it("ignores a click that lands immediately after the split appears", () => {
    const opened = 1_000_000;
    expect(isHeroChooserGhostClick(opened, opened + 1)).toBe(true);
    expect(isHeroChooserGhostClick(opened, opened + HERO_CHOOSER_GHOST_MS - 1)).toBe(true);
  });

  it("allows a later tap on the chosen split option", () => {
    const opened = 1_000_000;
    expect(isHeroChooserGhostClick(opened, opened + HERO_CHOOSER_GHOST_MS)).toBe(false);
    expect(isHeroChooserGhostClick(opened, opened + 800)).toBe(false);
  });

  it("does not block when no chooser was opened", () => {
    expect(isHeroChooserGhostClick(0, Date.now())).toBe(false);
  });
});
