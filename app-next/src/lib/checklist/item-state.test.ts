import { describe, it, expect } from "vitest";
import {
  buildPrestartActionedFaultDraft,
  isAcknowledgeItemComplete,
  isPassFailItemComplete,
  isPassFailItemUnsafe,
  setPassFailValue,
  tapPassFailItem,
  toggleAcknowledge,
  updateDefect,
} from "./item-state";
import { emptyAcknowledgeItem, emptyPassFailItem } from "./item-types";

describe("tapPassFailItem", () => {
  it("sets Pass from Unselected on single tap", () => {
    expect(tapPassFailItem("unselected")).toBe("pass");
  });

  it("does not cycle when already set (Fail/NA are explicit)", () => {
    expect(tapPassFailItem("pass")).toBe("pass");
    expect(tapPassFailItem("fail")).toBe("fail");
    expect(tapPassFailItem("na")).toBe("na");
  });
});

describe("setPassFailValue / defect", () => {
  it("opens defect card state when Fail selected", () => {
    const next = setPassFailValue(emptyPassFailItem(), "fail");
    expect(next.value).toBe("fail");
    expect(next.defect).toEqual({ description: "", photoDataUrls: [], unsafeToDrive: false });
  });

  it("clears defect when leaving Fail", () => {
    const failed = setPassFailValue(emptyPassFailItem(), "fail");
    const withText = updateDefect(failed, { description: "Soft tyre" });
    expect(setPassFailValue(withText, "pass").defect).toBeNull();
  });

  it("requires defect description to complete a Fail item", () => {
    const failed = setPassFailValue(emptyPassFailItem(), "fail");
    expect(isPassFailItemComplete(failed)).toBe(false);
    expect(isPassFailItemComplete(updateDefect(failed, { description: "  " }))).toBe(false);
    expect(isPassFailItemComplete(updateDefect(failed, { description: "Crack in lens" }))).toBe(
      true
    );
  });

  it("tracks unsafe-to-drive on Fail", () => {
    const failed = setPassFailValue(emptyPassFailItem(), "fail");
    const unsafe = updateDefect(failed, { description: "No brakes", unsafeToDrive: true });
    expect(isPassFailItemUnsafe(unsafe)).toBe(true);
    expect(isPassFailItemUnsafe(updateDefect(failed, { description: "Ok", unsafeToDrive: false }))).toBe(
      false
    );
  });

  it("treats Pass and N/A as complete without defect", () => {
    expect(isPassFailItemComplete(setPassFailValue(emptyPassFailItem(), "pass"))).toBe(true);
    expect(isPassFailItemComplete(setPassFailValue(emptyPassFailItem(), "na"))).toBe(true);
    expect(isPassFailItemComplete(emptyPassFailItem())).toBe(false);
  });
});

describe("acknowledge (FFW)", () => {
  it("toggles acknowledge and reports completeness", () => {
    const on = toggleAcknowledge(emptyAcknowledgeItem());
    expect(on.value).toBe("acknowledged");
    expect(isAcknowledgeItemComplete(on)).toBe(true);
    expect(isAcknowledgeItemComplete(toggleAcknowledge(on))).toBe(false);
  });
});

describe("buildPrestartActionedFaultDraft", () => {
  it("summarises Fault groups for workshop email", () => {
    const wheels = updateDefect(setPassFailValue(emptyPassFailItem(), "fail"), {
      description: "Soft tyre",
      unsafeToDrive: true,
    });
    const draft = buildPrestartActionedFaultDraft(
      { wheels, vision: emptyPassFailItem() },
      [
        { code: "wheels", label: "Wheels & tyres" },
        { code: "vision", label: "Vision & glass" },
      ]
    );
    expect(draft).toContain("Wheels & tyres: Soft tyre");
    expect(draft).toContain("UNSAFE TO DRIVE");
    expect(draft).not.toContain("Vision");
  });
});
