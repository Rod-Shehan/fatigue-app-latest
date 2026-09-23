import { describe, expect, it } from "vitest";
import { parseEmailInput } from "@/lib/auth/email";

describe("parseEmailInput", () => {
  it("accepts a normal email and lowercases it", () => {
    expect(parseEmailInput("Rod@Example.com")).toEqual({
      ok: true,
      value: "rod@example.com",
    });
  });

  it("treats blank as no email", () => {
    expect(parseEmailInput("  ")).toEqual({ ok: true, value: null });
    expect(parseEmailInput(null)).toEqual({ ok: true, value: null });
  });

  it("rejects a malformed email", () => {
    expect(parseEmailInput("not-an-email").ok).toBe(false);
  });
});
