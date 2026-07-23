import type { DualRunFixture } from "./dual-run";

/** Shared fixtures for Phase 2 dual-run (current engines vs AMI). */
export const DUAL_RUN_FIXTURES: DualRunFixture[] = [
  {
    id: "17h-resume-ok",
    label: "17h episode resume after stop",
    asOfIso: "2026-06-11T20:30:00",
    events: [
      { time: "2026-06-10T18:00:00", type: "stop" },
      { time: "2026-06-11T06:00:00", type: "work" },
      { time: "2026-06-11T18:08:00", type: "stop" },
    ],
  },
  {
    id: "17h-exhausted",
    label: "17h budget exhausted — no resume waiver",
    asOfIso: "2026-06-11T07:00:00",
    events: [
      { time: "2026-06-10T04:00:00", type: "stop" },
      { time: "2026-06-10T12:00:00", type: "work" },
      { time: "2026-06-11T05:30:00", type: "stop" },
    ],
  },
  {
    id: "7h-rest-met",
    label: "Solo 7h rest met after stop (outside episode)",
    asOfIso: "2026-06-12T08:00:00",
    events: [
      { time: "2026-06-11T06:00:00", type: "work" },
      { time: "2026-06-11T20:00:00", type: "stop" },
    ],
  },
  {
    id: "7h-rest-short",
    label: "Solo rest short after stop",
    asOfIso: "2026-06-11T22:00:00",
    events: [
      { time: "2026-06-11T06:00:00", type: "work" },
      { time: "2026-06-11T20:00:00", type: "stop" },
    ],
  },
  {
    id: "5h-needs-break",
    label: "5h work without qualifying break",
    asOfIso: "2026-06-11T12:00:00",
    events: [{ time: "2026-06-11T06:00:00", type: "work" }],
  },
  {
    id: "5h-with-20-break",
    label: "5h window with one ≥20 break",
    asOfIso: "2026-06-11T13:00:00",
    events: [
      { time: "2026-06-11T06:00:00", type: "work" },
      { time: "2026-06-11T10:00:00", type: "break" },
      { time: "2026-06-11T10:25:00", type: "work" },
    ],
  },
  {
    id: "two-up-24h-short",
    label: "Two-up 24h non-work shortfall",
    asOfIso: "2026-06-11T18:00:00",
    events: [
      { time: "2026-06-11T06:00:00", type: "work" },
      { time: "2026-06-11T12:00:00", type: "break" },
      { time: "2026-06-11T12:30:00", type: "work" },
    ],
  },
  {
    id: "168h-light-week",
    label: "Light work week under 168h",
    asOfIso: "2026-06-14T18:00:00",
    weekStarting: "2026-06-14",
    events: [
      { time: "2026-06-14T06:00:00", type: "work" },
      { time: "2026-06-14T14:00:00", type: "stop" },
      { time: "2026-06-15T06:00:00", type: "work" },
      { time: "2026-06-15T14:00:00", type: "stop" },
    ],
  },
  {
    id: "72h-three-blocks",
    label: "72h window with three ≥7h non_work blocks",
    asOfIso: "2026-06-14T12:00:00",
    // Sunday 8 Jun so Mon–Sat cover 9–14; events on 11–12 sit on this sheet
    weekStarting: "2026-06-08",
    events: [
      { time: "2026-06-11T00:00:00", type: "non_work" },
      { time: "2026-06-11T08:00:00", type: "work" },
      { time: "2026-06-11T12:00:00", type: "non_work" },
      { time: "2026-06-11T20:00:00", type: "work" },
      { time: "2026-06-12T00:00:00", type: "non_work" },
      { time: "2026-06-12T08:00:00", type: "work" },
      { time: "2026-06-12T12:00:00", type: "stop" },
    ],
  },
  {
    id: "pattern-gap-with-break",
    label: "A→B change with short break inside 24h+ gap",
    asOfIso: "2026-06-17T12:00:00",
    weekStarting: "2026-06-14",
    shiftLabels: ["A", "A", "A", "B", "B", "B", "B"],
    events: [
      { time: "2026-06-14T06:00:00", type: "work" },
      { time: "2026-06-14T18:00:00", type: "stop" },
      { time: "2026-06-15T06:00:00", type: "work" },
      { time: "2026-06-15T18:00:00", type: "stop" },
      { time: "2026-06-16T06:00:00", type: "work" },
      { time: "2026-06-16T08:00:00", type: "stop" },
      { time: "2026-06-16T12:00:00", type: "break" },
      { time: "2026-06-16T12:20:00", type: "non_work" },
      { time: "2026-06-17T09:00:00", type: "work" },
    ],
  },
];
