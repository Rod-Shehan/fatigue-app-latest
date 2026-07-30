"use client";

import { useMemo } from "react";
import {
  buildWorkSafeDayPaint,
  WORKSAFE_TRACK_LABELS,
  type WorkSafeDaySegment,
  type WorkSafeTrack,
} from "@/lib/worksafe-day-sheet";
import {
  isWorkSafeHourBoundaryQuarter,
  WORKSAFE_HOUR_LABELS,
  WORKSAFE_MINUTES_PER_DAY,
  WORKSAFE_QUARTERS_PER_DAY,
  WORKSAFE_TRACKS,
} from "@/lib/worksafe-day-sheet/quarter-grid";
import { formatHoursStatistic } from "@/lib/hours";
import { formatSheetDisplayDate, getTodayLocalDateString } from "@/lib/weeks";
import { cn } from "@/lib/utils";

const LABEL_W = "108px";
const TOTAL_W = "3.5rem";
const ROW_H = 32;
/** Shared template so hour headers and 15-min cells share the same column tracks. */
const SHEET_GRID = `${LABEL_W} repeat(${WORKSAFE_QUARTERS_PER_DAY}, minmax(0, 1fr)) ${TOTAL_W}`;

const ROW_TOOLTIPS: Record<WorkSafeTrack, string> = {
  work: "WORK TIME — driving, loading/unloading, maintenance, paperwork, and other work incidental to driving.",
  break:
    "BREAKS FROM DRIVING — short rest you logged as Break (≤30 min), including napping. Longer logged breaks count as non-work.",
  non_work:
    "NON WORK TIME — End shift, logged non-work, and logged breaks longer than 30 min (rest / sleep / away).",
};

type DayDataGrid = {
  events?: { time: string; type: string }[];
  date?: string;
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  truck_rego?: string | null;
  start_location?: string | null;
  destination?: string | null;
  start_kms?: number | null;
  end_kms?: number | null;
};

function formatTotal(minutes: number): string {
  if (minutes <= 0) return "";
  return formatHoursStatistic(minutes / 60);
}

function formatKm(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "";
  return Number(n).toLocaleString("en-AU");
}

function dayNameUpper(dayLabel?: string): string {
  return (dayLabel ?? "Day").toUpperCase();
}

function trackY(track: WorkSafeTrack): number {
  return WORKSAFE_TRACKS.indexOf(track) * ROW_H + ROW_H / 2;
}

/** Step path in viewBox units: x = minutes (0–1440), y = px down the three rows. */
function buildStepPath(segments: WorkSafeDaySegment[]): string {
  if (segments.length === 0) return "";
  let d = "";
  let prev: WorkSafeDaySegment | null = null;
  for (const seg of segments) {
    const y = trackY(seg.track);
    if (!prev || prev.endMin !== seg.startMin) {
      d += `M${seg.startMin} ${y} `;
    } else if (prev.track !== seg.track) {
      d += `V${y} `;
    }
    d += `H${seg.endMin} `;
    prev = seg;
  }
  return d.trim();
}

export default function WorkSafeDaySheet({
  dayData,
  regulatoryTodayYmd,
  dayLabel,
  className,
}: {
  dayData: DayDataGrid;
  regulatoryTodayYmd?: string;
  dayLabel?: string;
  driverName?: string | null;
  className?: string;
}) {
  const todayYmd = regulatoryTodayYmd ?? getTodayLocalDateString();
  const dateStr = dayData.date || todayYmd;

  const paint = useMemo(
    () =>
      buildWorkSafeDayPaint({
        dateStr,
        todayStr: todayYmd,
        events: dayData.events,
        work_time: dayData.work_time,
        breaks: dayData.breaks,
        non_work: dayData.non_work,
      }),
    [dateStr, todayYmd, dayData.events, dayData.work_time, dayData.breaks, dayData.non_work]
  );

  const stepPath = useMemo(() => buildStepPath(paint.segments), [paint.segments]);
  const chartH = WORKSAFE_TRACKS.length * ROW_H;

  const startKm = formatKm(dayData.start_kms);
  const endKm = formatKm(dayData.end_kms);
  const from = (dayData.start_location ?? "").trim();
  const to = (dayData.destination ?? "").trim();
  const dayName = dayNameUpper(dayLabel);
  const dateDisplay = formatSheetDisplayDate(dateStr);

  return (
    <div className={cn("select-none", className)} aria-label="WorkSafe WA day sheet">
      <div className="overflow-x-auto -mx-1 px-1">
        <div
          className="min-w-[860px] border border-black bg-white text-black dark:border-stone-500"
          style={{ fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif' }}
        >
          <div className="grid grid-cols-4 border-b border-black text-[10px] leading-none sm:text-[11px]">
            <div className="flex min-h-[28px] border-r border-black">
              <span className="flex shrink-0 items-center bg-stone-200 px-1.5 font-bold">Odometer Start</span>
              <span className="flex flex-1 items-center px-1.5 font-mono tabular-nums">{startKm}</span>
            </div>
            <div className="flex min-h-[28px] border-r border-black">
              <span className="flex shrink-0 items-center bg-stone-200 px-1.5 font-bold">Start Location</span>
              <span className="flex flex-1 items-center truncate px-1.5">{from}</span>
            </div>
            <div className="flex min-h-[28px] border-r border-black">
              <span className="flex shrink-0 items-center bg-stone-200 px-1.5 font-bold">Finish Location</span>
              <span className="flex flex-1 items-center truncate px-1.5">{to}</span>
            </div>
            <div className="flex min-h-[28px]">
              <span className="flex shrink-0 items-center bg-stone-200 px-1.5 font-bold">Odometer Finish</span>
              <span className="flex flex-1 items-center px-1.5 font-mono tabular-nums">{endKm}</span>
            </div>
          </div>

          <div className="grid border-b border-black" style={{ gridTemplateColumns: SHEET_GRID }}>
            <div className="flex flex-col justify-center border-r border-black px-1.5 py-0.5 leading-tight">
              <span className="text-[9px] font-bold underline decoration-1 underline-offset-2 sm:text-[10px]">
                {dayName}
              </span>
              {dateDisplay ? (
                <span className="text-[8px] font-medium tabular-nums text-stone-700 sm:text-[9px]">
                  {dateDisplay}
                </span>
              ) : null}
            </div>
            {WORKSAFE_HOUR_LABELS.map((label, h) => (
              <div
                key={`h-${h}`}
                className={cn(
                  "flex items-center justify-center border-r border-black py-0.5 font-mono text-[8px] tabular-nums sm:text-[9px]",
                  h % 2 === 0 ? "bg-stone-200" : "bg-white"
                )}
                style={{ gridColumn: "span 4" }}
              >
                {label}
              </div>
            ))}
            <div className="flex items-center justify-center bg-stone-200 text-[9px] font-bold sm:text-[10px]">
              Total
            </div>
          </div>

          <div className="relative">
            {WORKSAFE_TRACKS.map((track, rowIdx) => (
              <div
                key={track}
                className={cn("grid", rowIdx < WORKSAFE_TRACKS.length - 1 && "border-b border-black")}
                style={{ gridTemplateColumns: SHEET_GRID, height: ROW_H }}
                title={ROW_TOOLTIPS[track]}
              >
                <div className="flex items-center border-r border-black px-1.5">
                  <span className="text-[8px] font-semibold leading-tight sm:text-[9px]">
                    {WORKSAFE_TRACK_LABELS[track]}
                  </span>
                </div>
                {Array.from({ length: WORKSAFE_QUARTERS_PER_DAY }, (_, q) => (
                  <div
                    key={q}
                    className={cn(
                      "border-r",
                      isWorkSafeHourBoundaryQuarter(q) ? "border-black" : "border-stone-300"
                    )}
                  />
                ))}
                <div className="flex items-center justify-center border-l border-black font-mono text-[10px] font-bold tabular-nums sm:text-[11px]">
                  {formatTotal(paint.totalsMinutes[track])}
                </div>
              </div>
            ))}

            <div
              className="pointer-events-none absolute top-0 bottom-0"
              style={{ left: LABEL_W, right: TOTAL_W }}
              aria-hidden
            >
              <svg
                className="block h-full w-full"
                viewBox={`0 0 ${WORKSAFE_MINUTES_PER_DAY} ${chartH}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Activity step line"
              >
                {stepPath ? (
                  <path
                    d={stepPath}
                    fill="none"
                    stroke="#111"
                    strokeWidth={2.5}
                    strokeLinejoin="miter"
                    strokeLinecap="square"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
