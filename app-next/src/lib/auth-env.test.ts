import { describe, expect, it, afterEach, vi } from "vitest";
import { isSharedLoginPasswordAllowed, useSecureAuthCookies } from "@/lib/auth-env";

describe("auth-env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses secure cookies when NEXTAUTH_URL is https", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://www.circadia24.com");
    expect(useSecureAuthCookies()).toBe(true);
  });

  it("blocks shared login password in production by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CIRCADIA_ALLOW_SHARED_LOGIN_PASSWORD", "");
    expect(isSharedLoginPasswordAllowed()).toBe(false);
  });

  it("allows shared login password in production when explicitly opted in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CIRCADIA_ALLOW_SHARED_LOGIN_PASSWORD", "true");
    expect(isSharedLoginPasswordAllowed()).toBe(true);
  });
});
