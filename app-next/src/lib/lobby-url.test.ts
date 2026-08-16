import { describe, expect, it } from "vitest";
import { lobbyBranchFromCallback } from "./lobby-url";

describe("lobbyBranchFromCallback", () => {
  it("sends Circadia desk and owner console to the owner branch", () => {
    expect(lobbyBranchFromCallback("/circadia")).toBe("owner");
    expect(lobbyBranchFromCallback("/circadia/clients/abc")).toBe("owner");
    expect(lobbyBranchFromCallback("/admin/security")).toBe("owner");
  });

  it("sends manager paths to manager", () => {
    expect(lobbyBranchFromCallback("/manager")).toBe("manager");
    expect(lobbyBranchFromCallback("/drivers")).toBe("manager");
  });

  it("defaults other paths to driver", () => {
    expect(lobbyBranchFromCallback("/driver")).toBe("driver");
    expect(lobbyBranchFromCallback(null)).toBe("driver");
  });
});
