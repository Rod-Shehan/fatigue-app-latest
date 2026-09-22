import { describe, expect, it } from "vitest";
import {
  EWD_INSTALL_ANDROID_STEPS,
  EWD_INSTALL_GUIDE_BLURB,
  EWD_INSTALL_IPHONE_STEPS,
  EWD_INSTALL_PROMPT_TITLE_IOS,
} from "@/lib/ewd-install";

describe("ewd-install copy", () => {
  it("keeps iPhone Share → Add to Home Screen as the visible prompt", () => {
    expect(EWD_INSTALL_PROMPT_TITLE_IOS).toMatch(/iPhone/i);
    expect(EWD_INSTALL_IPHONE_STEPS.join(" ")).toMatch(/Safari/i);
    expect(EWD_INSTALL_IPHONE_STEPS.join(" ")).toMatch(/Share/i);
    expect(EWD_INSTALL_IPHONE_STEPS.join(" ")).toMatch(/Add to Home Screen/i);
  });

  it("keeps Android steps next to iPhone in the shared blurb", () => {
    expect(EWD_INSTALL_ANDROID_STEPS.join(" ")).toMatch(/Chrome/i);
    expect(EWD_INSTALL_ANDROID_STEPS.join(" ")).toMatch(/Install app|Add to Home screen/i);
    expect(EWD_INSTALL_GUIDE_BLURB).toMatch(/iPhone/);
    expect(EWD_INSTALL_GUIDE_BLURB).toMatch(/Android/);
  });
});
