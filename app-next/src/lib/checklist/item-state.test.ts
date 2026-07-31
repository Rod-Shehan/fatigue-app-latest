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
    expect(next.defect).toEqual({ description: "", photoDataUrls: [], mobilityStatus: null });
  });

  it("clears defect when leaving Fail", () => {
    const failed = setPassFailValue(emptyPassFailItem(), "fail");
    const withText = updateDefect(failed, { description: "Soft tyre" });
    expect(setPassFailValue(withText, "pass").defect).toBeNull();
  });

  it("requires description and mobility for Fault complete", () => {
    const failed = setPassFailValue(emptyPassFailItem(), "fail");
    expect(isPassFailItemComplete(failed)).toBe(false);
    expect(isPassFailItemComplete(updateDefect(failed, { description: "  " }))).toBe(false);
    expect(
      isPassFailItemComplete(updateDefect(failed, { description: "Crack in lens" }))
    ).toBe(false);
    expect(
      isPassFailItemComplete(
        updateDefect(failed, { description: "Crack in lens", mobilityStatus: "can_drive" })
      )
    ).toBe(true);
  });

  it("tracks cannot_move as unsafe", () => {
    const failed = setPassFailValue(emptyPassFailItem(), "fail");
    const unsafe = updateDefect(failed, {
      description: "No brakes",
      mobilityStatus: "cannot_move",
    });
    expect(isPassFailItemUnsafe(unsafe)).toBe(true);
    expect(
      isPassFailItemUnsafe(
        updateDefect(failed, { description: "Ok", mobilityStatus: "can_drive" })
      )
    ).toBe(false);
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
      mobilityStatus: "cannot_move",
    });
    const draft = buildPrestartActionedFaultDraft(
      { wheels, vision: emptyPassFailItem() },
      [
        { code: "wheels", label: "Wheels & tyres" },
        { code: "vision", label: "Vision & glass" },
      ]
    );
    expect(draft).toContain("Wheels & tyres: Soft tyre");
    expect(draft).toContain("Can not be moved/unroadworthy");
    expect(draft).not.toContain("Vision");
  });
});
