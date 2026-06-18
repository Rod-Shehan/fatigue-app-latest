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
    expect(chip.lines[0]).toMatch(/7h rest/);
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

  it("briefLabelFromComplianceMessage handles 14-day rest", () => {
    expect(
      briefLabelFromComplianceMessage(
        "Need ≥2×24h continuous non-work in any 14-day period (or meet 28-day alternative"
      )
    ).toMatch(/14-day rest/);
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
});
