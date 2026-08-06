import { describe, expect, it } from "vitest";
import { hashPasswordResetToken } from "./password-reset";

describe("password-reset", () => {
  it("hashes tokens stably without storing the raw value", () => {
    const a = hashPasswordResetToken("abc");
    const b = hashPasswordResetToken("abc");
    const c = hashPasswordResetToken("xyz");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
