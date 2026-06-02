import { describe, it, expect } from "vitest";
import { resolveIdlePrimaryLogAction } from "./primary-log-action";

describe("resolveIdlePrimaryLogAction", () => {
  it("returns Continue rest when <7h", () => {
    const out = resolveIdlePrimaryLogAction({ restRunMinutes: 6 * 60, minRestMinutes: 7 * 60 });
    expect(out.type).toBe("non_work");
    expect(out.label).toContain("rest");
    expect(out.helper).toContain("remaining");
  });

  it("returns Start shift when >=7h", () => {
    const out = resolveIdlePrimaryLogAction({ restRunMinutes: 7 * 60, minRestMinutes: 7 * 60 });
    expect(out.type).toBe("work");
    expect(out.label).toContain("Start shift");
  });
});

