/** RULE IP — owner approval required before changing expected rule outcomes. See .cursor/rules/time-rules-ip.mdc */
import { describe, it, expect } from "vitest";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import { nhvrProvisionalEngine } from "./nhvr-provisional-engine";

describe("nhvrProvisionalEngine", () => {
  it("prepends a non-EWD banner and delegates math to WA", () => {
    const emptyWeek = () =>
      Array(7)
        .fill(null)
        .map(() => ({
          work_time: Array(MINUTES_PER_DAY).fill(false),
          breaks: Array(MINUTES_PER_DAY).fill(false),
          non_work: Array(MINUTES_PER_DAY).fill(false),
        }));
    const results = nhvrProvisionalEngine.run(emptyWeek(), { driverType: "solo" });
    expect(results[0]?.type).toBe("warning");
    expect(results[0]?.day).toBe("Sheet");
    expect(results[0]?.message).toMatch(/not an approved Electronic Work Diary/i);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
