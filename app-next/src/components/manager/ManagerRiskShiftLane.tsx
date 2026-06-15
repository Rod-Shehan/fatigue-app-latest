"use client";

import { useMemo } from "react";
import {
  buildShiftLaneCells,
  shiftLaneColor,
  shiftLaneLabel,
  type TimelineEvent,
} from "@/lib/manager-risk-shift-lane";
import type { ShiftWorkProjection } from "@/lib/manager-shift-lane-plans";
import type { RiskTimelineBlock } from "@/lib/manager-risk-timeline";
import { ACTIVITY_THEME } from "@/lib/theme";

/** Match Recharts YAxis width in ManagerRiskTimelineDashboard. */
const Y_AXIS_GUTTER_PX = 36;
const RIGHT_MARGIN_PX = 12;

export function ManagerRiskShiftLane({
  blocks,
  events,
  projections = [],
}: {
  blocks: RiskTimelineBlock[];
  events: TimelineEvent[];
  projections?: ShiftWorkProjection[];
}) {
  const cells = useMemo(
    () => buildShiftLaneCells(blocks, events, { projections }),
    [blocks, events, projections]
  );

  const nowIndex = blocks.findIndex((b) => b.isNow);

  if (cells.length === 0) return null;

  return (
    <div className="mt-0.5">
      <div
        className="relative flex h-3 overflow-hidden rounded-sm border border-slate-200/80 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
        style={{ marginLeft: Y_AXIS_GUTTER_PX, marginRight: RIGHT_MARGIN_PX }}
        aria-label="Shift duty lane — recorded before now, projected after"
      >
        {cells.map((cell, i) => (
          <div
            key={cell.blockStartMs}
            className="min-w-0 flex-1"
            title={
              cell.planLabel
                ? `Projected · ${shiftLaneLabel(cell.kind)} · ${cell.planLabel} · ${blocks[i]?.label ?? ""}`
                : `${cell.generated ? "Projected" : "Recorded"} · ${shiftLaneLabel(cell.kind)} · ${blocks[i]?.label ?? ""}`
            }
            style={{ backgroundColor: shiftLaneColor(cell.kind, cell.generated) }}
          />
        ))}
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
            className="h-2 w-3 rounded-sm border border-slate-300 dark:border-slate-600"
            style={{ backgroundColor: "rgba(59, 130, 246, 0.42)" }}
            aria-hidden
          />
          Projected from run plan / manual km·h
        </span>
      </div>
    </div>
  );
}
