import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DUAL_RUN_FIXTURES } from "./dual-run.fixtures";
import {
  formatDualRunMarkdown,
  runDualRunFixture,
  summarizeDualRun,
  type DualRunRow,
} from "./dual-run";

describe("AMI Phase 2 dual-run", () => {
  it("compares current engines vs AMI and writes DUAL_RUN_REPORT.md", () => {
    const allRows: DualRunRow[] = [];
    for (const fixture of DUAL_RUN_FIXTURES) {
      allRows.push(...runDualRunFixture(fixture));
    }
    const summary = summarizeDualRun(allRows);
    const md = formatDualRunMarkdown(DUAL_RUN_FIXTURES, allRows);
    const outPath = join(__dirname, "DUAL_RUN_REPORT.md");
    writeFileSync(outPath, md, "utf8");

    // Phase 2 deliverable: report exists and harness ran. Diffs are expected until parity decisions.
    expect(summary.match + summary.diff + summary.skip).toBe(allRows.length);
    expect(allRows.length).toBeGreaterThan(0);
    expect(md).toContain("AMI dual-run report");
  });

  it("17h resume fixtures match on canResume between engines", () => {
    const resume = runDualRunFixture(DUAL_RUN_FIXTURES.find((f) => f.id === "17h-resume-ok")!);
    const row = resume.find((r) => r.rule === "seventeen_hour_episode");
    expect(row?.status).toBe("match");
    expect(row?.ami.canResume).toBe(true);

    const exhausted = runDualRunFixture(DUAL_RUN_FIXTURES.find((f) => f.id === "17h-exhausted")!);
    const row2 = exhausted.find((r) => r.rule === "seventeen_hour_episode");
    expect(row2?.status).toBe("match");
    expect(row2?.ami.canResume).toBe(false);
  });
});
