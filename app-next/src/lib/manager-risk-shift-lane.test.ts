import { describe, expect, it } from "vitest";
import {
  buildShiftLaneCells,
  dominantKindFromMinuteGrids,
  recordedKindForBlock,
} from "@/lib/manager-risk-shift-lane";
import { findNowBlockStartMs, RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";

const BLOCK_MS = RISK_BLOCK_MINUTES * 60 * 1000;

describe("manager-risk-shift-lane", () => {
  it("records work across a block from logged events", () => {
    const nowBlock = findNowBlockStartMs(Date.parse("2026-06-11T14:00:00+08:00"));
    const blockStart = nowBlock - 2 * BLOCK_MS;
    const events = [
      { time: new Date(blockStart).toISOString(), type: "work" },
    ];

    expect(recordedKindForBlock(blockStart, events, nowBlock)).toBe("work");
  });

  it("marks blocks at/after now as generated", () => {
    const nowMs = Date.parse("2026-06-11T14:07:00+08:00");
    const nowBlock = findNowBlockStartMs(nowMs);
    const blocks = [
      {
        blockStartMs: nowBlock - BLOCK_MS,
        label: "13:45",
        baselinePct: 30,
        livePct: 32,
      },
      {
        blockStartMs: nowBlock,
        label: "14:00",
        baselinePct: 35,
        livePct: 36,
        isNow: true,
      },
      {
        blockStartMs: nowBlock + BLOCK_MS,
        label: "14:15",
        baselinePct: 40,
      },
    ];

    const cells = buildShiftLaneCells(blocks, [], { nowMs });
    expect(cells[0].generated).toBe(false);
    expect(cells[0].kind).toBe("non_work");
    expect(cells[1].generated).toBe(false);
    expect(cells[2].generated).toBe(true);
  });

  it("defaults past blocks without events to non_work (not idle)", () => {
    const nowMs = Date.parse("2026-06-11T14:07:00+08:00");
    const nowBlock = findNowBlockStartMs(nowMs);
    const blocks = [{ blockStartMs: nowBlock - BLOCK_MS, label: "13:45", baselinePct: 30 }];
    const cells = buildShiftLaneCells(blocks, [], { nowMs });
    expect(cells[0].kind).toBe("non_work");
  });

  it("uses minute coverage when events do not overlap a block", () => {
    const nowMs = Date.parse("2026-06-11T14:07:00+08:00");
    const nowBlock = findNowBlockStartMs(nowMs);
    const blockStart = nowBlock - BLOCK_MS;
    const ymd = "2026-06-11";
    const dayStart = new Date(`${ymd}T00:00:00`).getTime();
    const workMinute = Math.floor((blockStart - dayStart) / 60_000);

    const work_time = Array(1440).fill(false);
    const breaks = Array(1440).fill(false);
    const non_work = Array(1440).fill(true);
    for (let m = workMinute; m < workMinute + 15; m++) {
      work_time[m] = true;
      non_work[m] = false;
    }

    const cells = buildShiftLaneCells(
      [{ blockStartMs: blockStart, label: "13:45", baselinePct: 30 }],
      [],
      {
        nowMs,
        dayCoverage: [{ ymd, work_time, breaks, non_work }],
      }
    );
    expect(cells[0].kind).toBe("work");
    expect(dominantKindFromMinuteGrids(blockStart, [{ ymd, work_time, breaks, non_work }], nowMs)).toBe(
      "work"
    );
  });

  it("carries work from events before the visible window", () => {
    const nowMs = Date.parse("2026-06-11T14:07:00+08:00");
    const nowBlock = findNowBlockStartMs(nowMs);
    const blockStart = nowBlock - 4 * BLOCK_MS;
    const workStart = blockStart - 2 * BLOCK_MS;
    const cells = buildShiftLaneCells(
      [{ blockStartMs: blockStart, label: "12:45", baselinePct: 30 }],
      [{ time: new Date(workStart).toISOString(), type: "work" }],
      { nowMs }
    );
    expect(cells[0].kind).toBe("work");
  });

  it("prefers rollover coverage over open event segments (forgot end shift)", () => {
    const nowMs = Date.parse("2026-06-11T10:00:00+08:00");
    const nowBlock = findNowBlockStartMs(nowMs);
    const ymd = "2026-06-11";
    const dayStart = new Date(`${ymd}T00:00:00`).getTime();
    const blockStart = nowBlock - BLOCK_MS;

    const work_time = Array(1440).fill(false);
    const breaks = Array(1440).fill(false);
    const non_work = Array(1440).fill(true);

    const cells = buildShiftLaneCells(
      [{ blockStartMs: blockStart, label: "09:45", baselinePct: 30 }],
      [{ time: new Date(dayStart - 2 * 60 * 60 * 1000).toISOString(), type: "work" }],
      {
        nowMs,
        dayCoverage: [{ ymd, work_time, breaks, non_work }],
      }
    );
    expect(cells[0].kind).toBe("non_work");
  });

  it("uses cycled run plan segments for future blocks", () => {
    const nowMs = Date.parse("2026-06-11T14:07:00+08:00");
    const nowBlock = findNowBlockStartMs(nowMs);
    const blocks = [
      { blockStartMs: nowBlock, label: "14:00", baselinePct: 35, livePct: 36, isNow: true },
      { blockStartMs: nowBlock + BLOCK_MS, label: "14:15", baselinePct: 40 },
      { blockStartMs: nowBlock + 2 * BLOCK_MS, label: "14:30", baselinePct: 42 },
    ];

    const cells = buildShiftLaneCells(blocks, [], {
      nowMs,
      planContext: {
        segments: [
          {
            startMs: nowBlock + BLOCK_MS,
            endMs: nowBlock + 3 * BLOCK_MS,
            kind: "work",
            generated: true,
            planLabel: "Kalgoorlie",
          },
        ],
        breakDue: null,
      },
    });
    expect(cells[1].kind).toBe("work");
    expect(cells[1].planLabel).toBe("Kalgoorlie");
    expect(cells[1].riskPct).toBe(40);
  });

  it("falls back to sawtooth when no plan segments", () => {
    const nowMs = Date.parse("2026-06-11T14:07:00+08:00");
    const nowBlock = findNowBlockStartMs(nowMs);
    const blocks = [
      { blockStartMs: nowBlock, label: "14:00", baselinePct: 35, isNow: true },
      { blockStartMs: nowBlock + BLOCK_MS, label: "14:15", baselinePct: 40 },
    ];
    const cells = buildShiftLaneCells(blocks, [], { nowMs, planContext: { segments: [], breakDue: null } });
    expect(cells[1].generated).toBe(true);
    expect(["work", "break"]).toContain(cells[1].kind);
  });

  it("flags break due on recorded work blocks", () => {
    const nowMs = Date.parse("2026-06-11T12:00:00+08:00");
    const nowBlock = findNowBlockStartMs(nowMs);
    const workStart = nowMs - 5.5 * 60 * 60 * 1000;
    const blocks = [{ blockStartMs: nowBlock - BLOCK_MS, label: "11:45", baselinePct: 30 }];
    const cells = buildShiftLaneCells(
      blocks,
      [{ time: new Date(workStart).toISOString(), type: "work" }],
      {
        nowMs,
        planContext: {
          segments: [],
          breakDue: { startMs: nowMs - 30 * 60 * 1000, endMs: nowMs },
        },
      }
    );
    expect(cells[0].breakDue).toBe(true);
  });
});
