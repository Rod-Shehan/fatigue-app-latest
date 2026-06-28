import { describe, expect, it } from "vitest";
import {
  MIN_USER_PASSWORD_LENGTH,
  parseOptionalPasswordInput,
  parseRequiredPasswordInput,
} from "@/lib/user-password";

describe("user-password", () => {
  it("requires minimum length for optional password when provided", () => {
    expect(parseOptionalPasswordInput("12345")).toEqual({
      ok: false,
      error: `Password must be at least ${MIN_USER_PASSWORD_LENGTH} characters`,
    });
  });

  it("accepts valid optional password", () => {
    expect(parseOptionalPasswordInput("  secret123  ")).toEqual({ ok: true, value: "secret123" });
  });

  it("treats blank optional password as unset", () => {
    expect(parseOptionalPasswordInput("   ")).toEqual({ ok: true, value: undefined });
  });

  it("requires password for required parser", () => {
    expect(parseRequiredPasswordInput("")).toEqual({ ok: false, error: "Password is required" });
  });
});
