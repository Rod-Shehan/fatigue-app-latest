/** RULE IP — owner approval required before changing expected rule outcomes. See .cursor/rules/time-rules-ip.mdc */
import { describe, it, expect } from "vitest";
import {
  getHours,
  findLongestContinuousBlock,
  countContinuousBlocksOfAtLeast,
  runComplianceChecks,
  getProspectiveWorkWarnings,
  type ComplianceDayData,
} from "./compliance";
import { MINUTES_PER_DAY } from "./coverage/derive-minute-coverage";

/** Minute grid: first `hours * 60` minutes marked work. */
function workSlots(hours: number): boolean[] {
  const s = Array(MINUTES_PER_DAY).fill(false);
  const mins = Math.min(MINUTES_PER_DAY, Math.max(0, hours) * 60);
  for (let i = 0; i < mins; i++) s[i] = true;
  return s;
}

/** Non-work run starting at `startSlot` half-hour index (legacy), length `hours`. */
function nonWorkSlots(hours: number, startSlot = 0): boolean[] {
  const s = Array(MINUTES_PER_DAY).fill(false);
  const startMin = startSlot * 30;
  const end = Math.min(MINUTES_PER_DAY, startMin + hours * 60);
  for (let i = startMin; i < end; i++) s[i] = true;
  return s;
}

/** One day with work only, no breaks/non-work */
function dayWorkOnly(hours: number): ComplianceDayData {
  return {
    work_time: workSlots(hours),
    breaks: Array(MINUTES_PER_DAY).fill(false),
    non_work: Array(MINUTES_PER_DAY).fill(false),
  };
}

/** Seven empty days */
function emptyWeek(): ComplianceDayData[] {
  return Array(7)
    .fill(null)
    .map(() => ({
      work_time: Array(MINUTES_PER_DAY).fill(false),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: Array(MINUTES_PER_DAY).fill(false),
    }));
}

describe("compliance helpers", () => {
  it("getHours counts minute coverage (or legacy half-hour slots)", () => {
    expect(getHours(workSlots(5))).toBe(5);
    expect(getHours(undefined)).toBe(0);
    expect(getHours([])).toBe(0);
  });

  it("getHours treats ambiguous-length arrays as minutes (no half-hour misread)", () => {
    expect(getHours(Array(100).fill(true))).toBeCloseTo(100 / 60, 5);
  });

  it("getProspectiveWorkWarnings accepts legacy 48-slot days (normalizes before inject)", () => {
    const legacyEmpty = () => ({
      work_time: Array(48).fill(false),
      breaks: Array(48).fill(false),
      non_work: Array(48).fill(false),
    });
    const week = Array(7)
      .fill(null)
      .map(() => legacyEmpty()) as ComplianceDayData[];
    expect(() =>
      getProspectiveWorkWarnings(week, 0, "2026-06-01", { driverType: "solo" })
    ).not.toThrow();
    const msgs = getProspectiveWorkWarnings(week, 0, "2026-06-01", { driverType: "solo" });
    expect(Array.isArray(msgs)).toBe(true);
  });

  it("findLongestContinuousBlock finds longest run", () => {
    const slots = Array(MINUTES_PER_DAY).fill(false);
    for (let i = 300; i < 720; i++) slots[i] = true; // 7h from 05:00
    expect(findLongestContinuousBlock(slots)).toBe(7);
  });

  it("countContinuousBlocksOfAtLeast counts 7h blocks", () => {
    const slots = [
      ...Array(480).fill(true),
      ...Array(480).fill(false),
      ...Array(480).fill(true),
    ] as boolean[];
    expect(countContinuousBlocksOfAtLeast(slots, 7)).toBe(2);
  });
});

describe("compliance scenarios — what the logic produces", () => {
  it("empty week: no violations or warnings", () => {
    const results = runComplianceChecks(emptyWeek(), { driverType: "solo" });
    expect(results).toHaveLength(0);
  });

  it("5h work in one day with no breaks: break warning (solo)", () => {
    const days = emptyWeek();
    days[0] = dayWorkOnly(5); // Sun 5h work, no break
    const results = runComplianceChecks(days, { driverType: "solo" });
    const breakWarning = results.find((r) => r.message.includes("20 min rest") && r.type === "warning");
    expect(breakWarning).toBeDefined();
    expect(breakWarning!.day).toBe("Sun");
  });

  it("5h break rule does not reset at midnight (rolling events)", () => {
    const days = emptyWeek();
    // Work starts late Sunday and continues into Monday without a qualifying break.
    // Total continuous work > 5h across the midnight boundary should trigger a violation.
    days[0] = {
      ...days[0],
      events: [{ time: "2026-03-08T20:00:00.000Z", type: "work" }],
    };
    days[1] = {
      ...days[1],
      events: [{ time: "2026-03-09T02:30:00.000Z", type: "work" }, { time: "2026-03-09T02:31:00.000Z", type: "stop" }],
    };
    const results = runComplianceChecks(days, { driverType: "solo" });
    const fiveHourViolation = results.find((r) => r.type === "violation" && r.message.includes("5h work"));
    expect(fiveHourViolation).toBeDefined();
  });

  it("14-day work > 168h with prev week: violation", () => {
    const thisWeek = emptyWeek();
    for (let i = 0; i < 7; i++) thisWeek[i] = dayWorkOnly(15);
    const prevWeek = emptyWeek();
    for (let i = 0; i < 7; i++) prevWeek[i] = dayWorkOnly(15);
    prevWeek[0] = {
      work_time: Array(MINUTES_PER_DAY).fill(false),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: Array(MINUTES_PER_DAY).fill(true),
    };
    prevWeek[1] = {
      work_time: Array(MINUTES_PER_DAY).fill(false),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: Array(MINUTES_PER_DAY).fill(true),
    };
    const results = runComplianceChecks(thisWeek, { driverType: "solo", prevWeekDays: prevWeek });
    const violation = results.find(
      (r) => r.day === "14-day" && r.type === "violation" && r.message.includes("168")
    );
    expect(violation).toBeDefined();
  });

  it("14-day rule resets after ≥48h continuous non-work: no violation when each segment ≤168h", () => {
    const thisWeek = emptyWeek();
    for (let i = 0; i < 7; i++) thisWeek[i] = dayWorkOnly(14); // 98h this week
    const prevWeek = emptyWeek();
    for (let i = 0; i < 7; i++) prevWeek[i] = dayWorkOnly(14); // 98h prev; 196h total but split by 48h
    prevWeek[6] = {
      work_time: Array(MINUTES_PER_DAY).fill(false),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: Array(MINUTES_PER_DAY).fill(true),
    };
    thisWeek[0] = {
      work_time: Array(MINUTES_PER_DAY).fill(false),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: Array(MINUTES_PER_DAY).fill(true),
    };
    const results = runComplianceChecks(thisWeek, { driverType: "solo", prevWeekDays: prevWeek });
    const violation = results.find((r) => r.day === "14-day" && r.type === "violation");
    expect(violation).toBeUndefined();
  });

  it("two-up: <7h non-work in 24h with 16h+ recorded: violation", () => {
    const days = emptyWeek();
    days[2] = {
      work_time: workSlots(16),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: nonWorkSlots(5), // only 5h non-work
    };
    const results = runComplianceChecks(days, { driverType: "two_up" });
    const v = results.find((r) => r.message.includes("7h non-work") && r.message.includes("24h") && r.type === "violation");
    expect(v).toBeDefined();
  });

  it("two-up 184E(3)(b): no GPS-proven Parked or End shift is a violation", () => {
    const days = emptyWeek();
    for (let i = 0; i < 2; i++) {
      days[i] = {
        ...dayWorkOnly(6),
        non_work: Array(MINUTES_PER_DAY).fill(false),
        breaks: Array(MINUTES_PER_DAY).fill(false),
        events: [] as ComplianceDayData["events"],
      };
    }
    const results = runComplianceChecks(days, { driverType: "two_up" });
    const v = results.find(
      (r) => r.message.includes("GPS-proven Parked or End shift") && r.type === "violation"
    );
    expect(v).toBeDefined();
  });

  it("two-up 184E(3)(b): GPS End shift meets 48h option; End shift without GPS fails", () => {
    const weekStarting = "2026-07-19";
    const addDays = (ymd: string, n: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    };
    const perthIso = (ymd: string, hour: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d, hour - 8, 0, 0)).toISOString();
    };
    const makeWeek = (withGps: boolean): ComplianceDayData[] => {
      const days = emptyWeek();
      for (let i = 0; i < 7; i++) {
        const ymd = addDays(weekStarting, i);
        const work = Array(MINUTES_PER_DAY).fill(false);
        const nw = Array(MINUTES_PER_DAY).fill(false);
        for (let m = 8 * 60; m < 18 * 60; m++) work[m] = true;
        for (let m = 0; m < 8 * 60; m++) nw[m] = true;
        for (let m = 18 * 60; m < 1440; m++) nw[m] = true;
        days[i] = {
          work_time: work,
          breaks: Array(MINUTES_PER_DAY).fill(false),
          non_work: nw,
          events: [
            { type: "work", time: perthIso(ymd, 8) },
            withGps
              ? { type: "stop", time: perthIso(ymd, 18), lat: -31.95, lng: 115.86 }
              : { type: "stop", time: perthIso(ymd, 18) },
          ],
        };
      }
      return days;
    };
    const asOf = {
      driverType: "two_up" as const,
      weekStarting,
      currentDayIndex: 6,
      slotOffsetWithinToday: 18 * 60,
    };
    const pass = runComplianceChecks(makeWeek(true), asOf);
    expect(pass.some((r) => r.message.includes("48h option") || r.message.includes("7-day option"))).toBe(
      false
    );
    const fail = runComplianceChecks(makeWeek(false), asOf);
    expect(fail.some((r) => r.message.includes("GPS-proven Parked or End shift"))).toBe(true);
  });

  it("shift change (A↔B) after 120h+ same pattern: requires 24h between stop and next work", () => {
    const days = emptyWeek();
    days[0] = {
      ...dayWorkOnly(1),
      shift_label: "A",
      events: [
        { time: "2026-01-01T00:00:00.000Z", type: "work" },
        { time: "2026-01-06T10:00:00.000Z", type: "stop" },
      ],
    };
    days[1] = {
      ...dayWorkOnly(1),
      shift_label: "B",
      events: [{ time: "2026-01-06T11:00:00.000Z", type: "work" }],
    };

    const results = runComplianceChecks(days, { driverType: "solo" });
    const v = results.find((r) => r.ruleId === "shift_change_24h" && r.type === "violation");
    expect(v).toBeDefined();
    expect(v?.message).toContain("24");
    expect(v?.shiftChange?.gapHours).toBeLessThan(24);
  });

  it("shift change under 120h same pattern: no 24h violation", () => {
    const days = emptyWeek();
    days[0] = {
      shift_label: "A",
      ...dayWorkOnly(1),
      events: [
        { time: "2026-01-01T00:00:00.000Z", type: "work" },
        { time: "2026-01-01T10:00:00.000Z", type: "stop" },
      ],
    };
    days[1] = {
      shift_label: "B",
      ...dayWorkOnly(1),
      events: [{ time: "2026-01-01T11:00:00.000Z", type: "work" }],
    };
    const results = runComplianceChecks(days, { driverType: "solo" });
    const v = results.find((r) => r.ruleId === "shift_change_24h" && r.type === "violation");
    expect(v).toBeUndefined();
  });

  it("120h+ unlabeled shifts on timeline: education warning", () => {
    const days = emptyWeek();
    days[0] = {
      ...dayWorkOnly(1),
      shift_label: "",
      events: [
        { time: "2026-01-01T00:00:00.000Z", type: "work" },
        { time: "2026-01-06T10:00:00.000Z", type: "stop" },
      ],
    };
    const results = runComplianceChecks(days, { driverType: "solo" });
    const w = results.find((r) => r.ruleId === "shift_change_education");
    expect(w).toBeDefined();
  });

  it("solo 28-day alternative (4×24h + ≤144h work in any 14 days) satisfies the 24h-break requirement", () => {
    const days = emptyWeek();
    // Current week has work, but only ONE 24h non-work day inside the last 14 days.
    for (let i = 0; i < 7; i++) {
      const w = workSlots(10);
      const nw = Array(MINUTES_PER_DAY).fill(false);
      for (let m = 10 * 60; m < MINUTES_PER_DAY; m++) nw[m] = true;
      days[i] = { work_time: w, breaks: Array(MINUTES_PER_DAY).fill(false), non_work: nw };
    }
    days[6] = {
      work_time: Array(MINUTES_PER_DAY).fill(false),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: Array(MINUTES_PER_DAY).fill(true), // one 24h block inside last14
    };

    // Provide 21 prior days to make a full 28-day horizon.
    // Include 3 additional 24h non-work blocks in the earlier 14 days (outside the last14).
    const historyDays = Array.from({ length: 21 }, (_, idx) => {
      if (idx === 0 || idx === 6 || idx === 12) {
        return {
          work_time: Array(MINUTES_PER_DAY).fill(false),
          breaks: Array(MINUTES_PER_DAY).fill(false),
          non_work: Array(MINUTES_PER_DAY).fill(true),
        };
      }
      const w = workSlots(10);
      const nw = Array(MINUTES_PER_DAY).fill(false);
      for (let m = 10 * 60; m < MINUTES_PER_DAY; m++) nw[m] = true;
      return { work_time: w, breaks: Array(MINUTES_PER_DAY).fill(false), non_work: nw }; // 10h/day ensures ≤140h in any 14-day window
    });

    const combinedNonWork = [...historyDays, ...days].flatMap((d) => d.non_work || Array(MINUTES_PER_DAY).fill(false));
    expect(countContinuousBlocksOfAtLeast(combinedNonWork, 24)).toBeGreaterThanOrEqual(4);

    const results = runComplianceChecks(days, {
      driverType: "solo",
      historyDays,
    });

    const v = results.find((r) => r.type === "violation" && r.message.includes("28-day alternative"));
    expect(v).toBeUndefined();
  });

  it("solo 14-day 24h blocks: a 48h continuous non-work run counts as 2×24h", () => {
    const days = emptyWeek();
    // Ensure there is some work somewhere so the solo rules run.
    days[0] = dayWorkOnly(1);

    // Provide 21 prior days so the "last14" window is well-defined.
    // Make the last 2 history days a continuous 48h non-work run.
    const historyDays = Array.from({ length: 21 }, (_, idx) => {
      const base: ComplianceDayData = {
        work_time: Array(MINUTES_PER_DAY).fill(false),
        breaks: Array(MINUTES_PER_DAY).fill(false),
        non_work: Array(MINUTES_PER_DAY).fill(false),
      };
      if (idx >= 19) {
        return { ...base, non_work: Array(MINUTES_PER_DAY).fill(true) };
      }
      // Some mixed days earlier.
      if (idx % 3 === 0) return dayWorkOnly(4);
      return base;
    });

    const results = runComplianceChecks(days, {
      driverType: "solo",
      historyDays,
    });

    const v = results.find((r) => r.day === "14-day" && r.type === "violation");
    expect(v).toBeUndefined();
  });

  it("solo rolling audit: warns when a recent 14-day window lacks 2×24h even if 28-day alternative passes at now", () => {
    const days = emptyWeek();
    for (let i = 0; i < 7; i++) {
      const w = workSlots(10);
      const nw = Array(MINUTES_PER_DAY).fill(false);
      for (let m = 10 * 60; m < MINUTES_PER_DAY; m++) nw[m] = true;
      days[i] = { work_time: w, breaks: Array(MINUTES_PER_DAY).fill(false), non_work: nw };
    }
    days[6] = {
      work_time: Array(MINUTES_PER_DAY).fill(false),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: Array(MINUTES_PER_DAY).fill(true),
    };

    const historyDays = Array.from({ length: 21 }, (_, idx) => {
      if (idx === 0 || idx === 6 || idx === 12) {
        return {
          work_time: Array(MINUTES_PER_DAY).fill(false),
          breaks: Array(MINUTES_PER_DAY).fill(false),
          non_work: Array(MINUTES_PER_DAY).fill(true),
        };
      }
      const w = workSlots(10);
      const nw = Array(MINUTES_PER_DAY).fill(false);
      for (let m = 10 * 60; m < MINUTES_PER_DAY; m++) nw[m] = true;
      return { work_time: w, breaks: Array(MINUTES_PER_DAY).fill(false), non_work: nw };
    });

    const results = runComplianceChecks(days, { driverType: "solo", historyDays });
    const violation = results.find(
      (r) => r.day === "14-day" && r.type === "violation" && r.message.includes("2×24h")
    );
    const warning = results.find(
      (r) => r.day === "14-day" && r.type === "warning" && r.message.includes("Rolling 14-day non-work gap")
    );
    expect(violation).toBeUndefined();
    expect(warning).toBeDefined();
  });

  it("168h on minute timeline: uses historyDays beyond prev week for rolling 14-day work", () => {
    const days = emptyWeek();
    for (let i = 0; i < 7; i++) {
      days[i] = {
        work_time: Array(MINUTES_PER_DAY).fill(false),
        breaks: Array(MINUTES_PER_DAY).fill(false),
        non_work: Array(MINUTES_PER_DAY).fill(true),
      };
    }
    const historyDays = Array.from({ length: 14 }, () => dayWorkOnly(13));
    const resultsWithout = runComplianceChecks(days, { driverType: "solo" });
    const resultsWith = runComplianceChecks(days, { driverType: "solo", historyDays });
    const violationWithout = resultsWithout.find(
      (r) => r.day === "14-day" && r.type === "violation" && r.message.includes("168")
    );
    const violationWith = resultsWith.find(
      (r) => r.day === "14-day" && r.type === "violation" && r.message.includes("168")
    );
    expect(violationWithout).toBeUndefined();
    expect(violationWith).toBeDefined();
  });

  it("168h on minute timeline: rolling 14-day window exceeds 168h within one 48h-reset segment", () => {
    const thisWeek = emptyWeek();
    const prevWeek = emptyWeek();
    for (let i = 0; i < 7; i++) {
      thisWeek[i] = dayWorkOnly(15);
      prevWeek[i] = dayWorkOnly(15);
    }
    prevWeek[0] = {
      work_time: Array(MINUTES_PER_DAY).fill(false),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: Array(MINUTES_PER_DAY).fill(true),
    };
    prevWeek[1] = {
      work_time: Array(MINUTES_PER_DAY).fill(false),
      breaks: Array(MINUTES_PER_DAY).fill(false),
      non_work: Array(MINUTES_PER_DAY).fill(true),
    };
    const results = runComplianceChecks(thisWeek, { driverType: "solo", prevWeekDays: prevWeek });
    const violation = results.find(
      (r) => r.day === "14-day" && r.type === "violation" && r.message.includes("168")
    );
    expect(violation).toBeDefined();
  });

  it("this week >84h and no prev week: 14-day warning", () => {
    const days = emptyWeek();
    for (let i = 0; i < 7; i++) days[i] = dayWorkOnly(13); // 91h
    const results = runComplianceChecks(days, { driverType: "solo" });
    const w = results.find((r) => r.day === "14-day" && r.type === "warning" && r.message.includes("no previous sheet"));
    expect(w).toBeDefined();
  });

  it("scenario: print sample results (manual inspection)", () => {
    const days = emptyWeek();
    days[0] = dayWorkOnly(6); // Sun: 6h work, no break
    days[1] = { ...dayWorkOnly(10), breaks: workSlots(0.5) }; // Mon: 10h work, 30min break (invalid length)
    const results = runComplianceChecks(days, { driverType: "solo" });
    console.log("\n--- Sample compliance output ---");
    console.log("Scenario: Sun 6h work no break; Mon 10h work, 30min break (solo)");
    results.forEach((r) => console.log(`[${r.type}] ${r.day}: ${r.message}`));
    console.log("--------------------------------\n");
    expect(results.length).toBeGreaterThan(0);
  });
});
