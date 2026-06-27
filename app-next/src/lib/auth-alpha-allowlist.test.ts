import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isAlphaAllowlistEnabled,
  isEmailAllowedForAlphaAccess,
  resetAlphaAllowlistCacheForTests,
} from "@/lib/auth-alpha-allowlist";

describe("auth-alpha-allowlist", () => {
  const prev = process.env.CIRCADIA_ALPHA_ALLOWLIST;

  beforeEach(() => {
    resetAlphaAllowlistCacheForTests();
  });

  afterEach(() => {
    process.env.CIRCADIA_ALPHA_ALLOWLIST = prev;
    resetAlphaAllowlistCacheForTests();
  });

  it("allows all emails when allowlist env is unset", () => {
    delete process.env.CIRCADIA_ALPHA_ALLOWLIST;
    expect(isAlphaAllowlistEnabled()).toBe(false);
    expect(isEmailAllowedForAlphaAccess("anyone@example.com")).toBe(true);
  });

  it("restricts to listed emails when env is set", () => {
    process.env.CIRCADIA_ALPHA_ALLOWLIST = " Pat@Example.com , manager@test.local ";
    expect(isAlphaAllowlistEnabled()).toBe(true);
    expect(isEmailAllowedForAlphaAccess("pat@example.com")).toBe(true);
    expect(isEmailAllowedForAlphaAccess("manager@test.local")).toBe(true);
    expect(isEmailAllowedForAlphaAccess("other@example.com")).toBe(false);
  });
});
