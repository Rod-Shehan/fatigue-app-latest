import { describe, expect, it } from "vitest";
import { shouldClearDirtyAfterSave } from "./sheet-save-dirty";

describe("shouldClearDirtyAfterSave", () => {
  it("clears when no edits landed during save", () => {
    expect(shouldClearDirtyAfterSave(3, 3)).toBe(true);
  });

  it("keeps dirty when Start shift (or other edit) landed during in-flight save", () => {
    expect(shouldClearDirtyAfterSave(4, 3)).toBe(false);
  });
});
