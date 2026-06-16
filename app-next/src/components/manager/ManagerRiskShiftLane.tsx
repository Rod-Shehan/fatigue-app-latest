"use client";

import { useMemo } from "react";
import {
  buildShiftLaneCells,
  shiftLaneColor,
  shiftLaneLabel,
  type ShiftLaneDayCoverage,
  type TimelineEvent,
} from "@/lib/manager-risk-shift-lane";
import type { ShiftLanePlanContext } from "@/lib/manager-shift-lane-plans";
import type { RiskTimelineBlock } from "@/lib/manager-risk-timeline";
import { RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";
import { ACTIVITY_THEME } from "@/lib/theme";

/** Match Recharts YAxis width in ManagerRiskTimelineDashboard. */
const Y_AXIS_GUTTER_PX = 36;
const RIGHT_MARGIN_PX = 12;
const BLOCK_MS = RISK_BLOCK_MINUTES * 60 * 1000;

function breakDueOverlayLeft(
  blocks: RiskTimelineBlock[],
  breakDueStartMs: number
): number | null {
  if (blocks.length === 0) return null;
  const windowStart = blocks[0].blockStartMs;
  const windowEnd = blocks[blocks.length - 1].blockStartMs + BLOCK_MS;
  const span = windowEnd - windowStart;
  if (span <= 0) return null;
  const pct = ((breakDueStartMs - windowStart) / span) * 100;
  return Math.max(0, Math.min(100, pct));
}

function breakDueOverlayWidth(
  blocks: RiskTimelineBlock[],
  breakDueStartMs: number,
  breakDueEndMs: number
): number | null {
  if (blocks.length === 0) return null;
  const windowStart = blocks[0].blockStartMs;
  const windowEnd = blocks[blocks.length - 1].blockStartMs + BLOCK_MS;
  const span = windowEnd - windowStart;
  if (span <= 0) return null;
  const start = Math.max(breakDueStartMs, windowStart);
  const end = Math.min(breakDueEndMs, windowEnd);
  if (end <= start) return null;
  return ((end - start) / span) * 100;
}

export function ManagerRiskShiftLane({
  blocks,
  events,
  dayCoverage,
  planContext,
}: {
  blocks: RiskTimelineBlock[];
  events: TimelineEvent[];
  dayCoverage?: ShiftLaneDayCoverage[];
  planContext?: ShiftLanePlanContext;
}) {
  const cells = useMemo(
    () => buildShiftLaneCells(blocks, events, { planContext, dayCoverage }),
    [blocks, events, planContext, dayCoverage]
  );

  const nowIndex = blocks.findIndex((b) => b.isNow);
  const breakDue = planContext?.breakDue ?? null;
  const breakDueLeft = breakDue ? breakDueOverlayLeft(blocks, breakDue.startMs) : null;
  const breakDueWidth =
    breakDue && breakDueLeft != null
      ? breakDueOverlayWidth(blocks, breakDue.startMs, breakDue.endMs)
      : null;

  if (cells.length === 0) return null;

  return (
    <div className="mt-0.5">
      <div
        className="relative flex h-3 overflow-hidden rounded-sm border border-slate-200/80 bg-slate-800/40 dark:border-slate-700 dark:bg-slate-800"
        style={{ marginLeft: Y_AXIS_GUTTER_PX, marginRight: RIGHT_MARGIN_PX }}
        aria-label="Timeline lane — recorded duty before now, projected risk after"
      >
        {cells.map((cell, i) => (
          <div
            key={cell.blockStartMs}
            className="min-w-0 flex-1"
            title={
              cell.generated && cell.riskPct != null
                ? `Projected risk ${cell.riskPct}% · ${shiftLaneLabel(cell.kind, cell.breakDue)}${
                    cell.planLabel ? ` · ${cell.planLabel}` : ""
                  } · ${blocks[i]?.label ?? ""}`
                : cell.planLabel
                  ? `Recorded · ${shiftLaneLabel(cell.kind, cell.breakDue)} · ${cell.planLabel} · ${blocks[i]?.label ?? ""}`
                  : `${cell.generated ? "Projected" : "Recorded"} · ${shiftLaneLabel(cell.kind, cell.breakDue)} · ${blocks[i]?.label ?? ""}`
            }
            style={{
              backgroundColor: shiftLaneColor(
                cell.kind,
                cell.generated,
                cell.breakDue,
                cell.riskPct
              ),
            }}
          />
        ))}
        {breakDueWidth != null && breakDueLeft != null ? (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[5] bg-amber-500/35 ring-1 ring-inset ring-amber-500/60"
            style={{ left: `${breakDueLeft}%`, width: `${breakDueWidth}%` }}
            aria-hidden
          />
        ) : null}
        {nowIndex >= 0 ? (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-teal-500 dark:bg-teal-400"
            style={{ left: `${((nowIndex + 0.5) / cells.length) * 100}%` }}
            aria-hidden
          />
        ) : null}
      </div>
      <div
        className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400"
        style={{ marginLeft: Y_AXIS_GUTTER_PX, marginRight: RIGHT_MARGIN_PX }}
      >
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: ACTIVITY_THEME.work.hex }} aria-hidden />
          Work
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: ACTIVITY_THEME.break.hex }} aria-hidden />
          Break
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: ACTIVITY_THEME.non_work.hex }} aria-hidden />
          Non-work
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="h-2 w-3 rounded-sm border border-amber-500/50 bg-amber-500/35"
            aria-hidden
          />
          Break due (before now)
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="h-2 w-3 rounded-sm bg-gradient-to-r from-emerald-500 via-amber-500 to-red-600"
            aria-hidden
          />
          Projected risk (after now)
        </span>
      </div>
    </div>
  );
}
