import { describe, expect, it } from "vitest";
import {
  briefLabelFromComplianceMessage,
  resolveUpcomingComplianceChip,
  shouldShowUpcomingComplianceChip,
} from "@/lib/upcoming-compliance-chip";

describe("upcoming-compliance-chip", () => {
  it("returns all clear when idle with no issues", () => {
    const chip = resolveUpcomingComplianceChip({
      prospectiveWorkWarnings: [],
      complianceResults: [],
      rolling168h: {
        maxRollingWorkHours: 40,
        headroomHours: 128,
        inWarningBand: false,
        wouldExceed168: false,
      },
    });
    expect(chip.tone).toBe("clear");
    expect(chip.lines[0]).toMatch(/all clear/i);
  });

  it("surfaces 7h rest countdown", () => {
    const chip = resolveUpcomingComplianceChip({
      prospectiveWorkWarnings: [],
      complianceResults: [],
      idleRestBlocked: true,
      idleRestRemainingMinutes: 260,
    });
    expect(chip.tone).toBe("attention");
    expect(chip.lines[0]).toMatch(/Rest required before work/);
  });

  it("summarises prospective 72h warning", () => {
    const chip = resolveUpcomingComplianceChip({
      prospectiveWorkWarnings: [
        "Need ≥27 hrs non-work in any rolling 72hr period (24h non-work resets; this window: 20h)",
      ],
      complianceResults: [],
    });
    expect(chip.lines.some((l) => l.includes("72h"))).toBe(true);
  });

  it("shows 168h headroom when tight", () => {
    const chip = resolveUpcomingComplianceChip({
      prospectiveWorkWarnings: [],
      complianceResults: [],
      rolling168h: {
        maxRollingWorkHours: 152,
        headroomHours: 16,
        inWarningBand: true,
        wouldExceed168: false,
      },
    });
    expect(chip.lines.some((l) => l.includes("168"))).toBe(true);
    expect(chip.tone).toBe("caution");
  });

  it("briefLabelFromComplianceMessage names both 14-day and 28-day rest options", () => {
    expect(
      briefLabelFromComplianceMessage(
        "Need ≥2×24h continuous non-work in any 14-day period (or meet 28-day alternative"
      )
    ).toBe("14-day or 28-day rest option needed");
  });

  it("briefLabelFromComplianceMessage names both two-up 48h and 7-day options", () => {
    expect(
      briefLabelFromComplianceMessage(
        "Need ≥7h continuous non-work in any rolling 48h (Two-Up 48h option) or 7-day option (≥48h non-work including ≥24h, no period under 7h)"
      )
    ).toBe("48h or 7-day rest option needed");
    expect(
      briefLabelFromComplianceMessage(
        "Need ≥7h continuous GPS-proven Parked or End shift in any rolling 48h (Two-Up 48h option) or 7-day option (≥48h GPS-proven non-work including ≥24h, no period under 7h)"
      )
    ).toBe("48h or 7-day rest option needed");
  });

  it("shows the 5h violation wording, not a generic review-first line", () => {
    const chip = resolveUpcomingComplianceChip({
      prospectiveWorkWarnings: [],
      complianceResults: [
        {
          type: "violation",
          iconKey: "AlertTriangle",
          day: "Sun",
          message:
            "20 min rest per 5h work not met (11:24 pm). Last 5h work (5.9h). Longest rest in that block: 19 min (need one more 10 min, or 20 min continuous).",
        },
      ],
    });
    expect(chip.tone).toBe("attention");
    expect(chip.lines[0]).toContain("19 min");
    expect(chip.lines[0]).not.toMatch(/review first/i);
  });

  it("shouldShowUpcomingComplianceChip always on idle live sheet", () => {
    expect(
      shouldShowUpcomingComplianceChip({
        isLiveNow: true,
        shiftIdle: true,
        chip: { tone: "clear", lines: ["All clear"] },
      })
    ).toBe(true);
  });

  it("hides on shift when all clear", () => {
    expect(
      shouldShowUpcomingComplianceChip({
        isLiveNow: true,
        shiftIdle: false,
        chip: { tone: "clear", lines: ["All clear"] },
      })
    ).toBe(false);
  });

  it("shows record issues even when not on the live day card", () => {
    expect(
      shouldShowUpcomingComplianceChip({
        isLiveNow: false,
        shiftIdle: false,
        chip: { tone: "attention", lines: ["20 min rest per 5h work not met"] },
      })
    ).toBe(true);
  });

  it("does not put the 5h rest-due reminder on the chip (hero colour/countdown only)", () => {
    const chip = resolveUpcomingComplianceChip({
      prospectiveWorkWarnings: [],
      complianceResults: [],
      nearTermLines: [
        { line: "Rest due by 14:20 — plan a stop", tone: "caution" },
        { line: "Rest overdue — was due 01:46. Stop when safe", tone: "attention" },
      ],
    });
    expect(chip.lines.some((l) => /rest due|rest overdue/i.test(l))).toBe(false);
    expect(chip.tone).toBe("clear");
  });

  it("still names shift-still-open on the chip", () => {
    const chip = resolveUpcomingComplianceChip({
      prospectiveWorkWarnings: [],
      complianceResults: [],
      nearTermLines: [
        { line: "Shift still open — End shift if you have finished", tone: "attention" },
      ],
    });
    expect(chip.tone).toBe("attention");
    expect(chip.lines[0]).toMatch(/Shift still open/);
  });
});
