import { describe, expect, it } from "vitest";
import { commandNavIdFromPath } from "@/lib/command-nav";

describe("commandNavIdFromPath", () => {
  it("identifies each Command page and does not treat Users as Triage", () => {
    expect(commandNavIdFromPath("/triage")).toBe("triage");
    expect(commandNavIdFromPath("/tracking")).toBe("tracking");
    expect(commandNavIdFromPath("/admin/users")).toBe("users");
    expect(commandNavIdFromPath("/admin/test-desk")).toBe("test-desk");
  });
});
