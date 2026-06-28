import { describe, expect, it } from "vitest";
import { canManageOperators, isCommandRole } from "@/lib/auth/roles";
import { parseUsernameInput } from "@/lib/auth/username";

describe("command roles", () => {
  it("owner can manage operators", () => {
    expect(canManageOperators("command_owner")).toBe(true);
    expect(canManageOperators("command_operator")).toBe(false);
  });

  it("validates usernames", () => {
    expect(parseUsernameInput("ab").ok).toBe(false);
    expect(parseUsernameInput("valid.user_1").ok).toBe(true);
    expect(isCommandRole("command_owner")).toBe(true);
  });
});
