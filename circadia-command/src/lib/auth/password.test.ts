import { describe, expect, it } from "vitest";
import { hashOperatorPassword, parsePasswordInput, verifyOperatorPassword } from "@/lib/auth/password";

describe("operator password", () => {
  it("rejects short passwords", () => {
    const parsed = parsePasswordInput("short");
    expect(parsed.ok).toBe(false);
  });

  it("hashes and verifies", async () => {
    const plain = "valid-password-12";
    const hash = await hashOperatorPassword(plain);
    expect(await verifyOperatorPassword(plain, hash)).toBe(true);
    expect(await verifyOperatorPassword("wrong-password", hash)).toBe(false);
  });
});
