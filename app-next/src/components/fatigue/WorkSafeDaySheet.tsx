"use client";

import { useMemo } from "react";
import {
  buildWorkSafeDayPaint,
  WORKSAFE_TRACK_LABELS,
  type WorkSafeTrack,
} from "@/lib/worksafe-day-sheet";
import { formatHoursStatistic } from "@/lib/hours";
import { getTodayLocalDateString } from "@/lib/weeks";
import { cn } from "@/lib/utils";

const MINUTES_PER_DAY = 1440;
const CHART_WIDTH = 720;
const LANE_H = 34;
const LABEL_COL = 88;
const TOTAL_COL = 44;
const DAY_COL = 52;
const HOUR_HEADER_H = 18;
const TRACKS: WorkSafeTrack[] = ["work", "break", "non_work"];

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
  if (minutes <= 0) return "—";
  return formatHoursStatistic(minutes / 60);
}

function formatKm(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "";
  return Number(n).toLocaleString("en-AU");
}

function trackY(track: WorkSafeTrack): number {
  return TRACKS.indexOf(track) * LANE_H + LANE_H / 2;
}

/** Continuous step path; gaps in paint start a new subpath (no invented connector). */
function buildStepPath(
  segments: { track: WorkSafeTrack; startMin: number; endMin: number }[]
): string {
  if (segments.length === 0) return "";
  const xOf = (m: number) => (m / MINUTES_PER_DAY) * CHART_WIDTH;
  let d = "";
  let prev: (typeof segments)[0] | null = null;
  for (const seg of segments) {
    const y = trackY(seg.track);
    const x0 = xOf(seg.startMin);
    const x1 = xOf(seg.endMin);
    if (!prev || prev.endMin !== seg.startMin) {
      d += `M${x0.toFixed(2)} ${y.toFixed(2)} `;
    } else if (prev.track !== seg.track) {
      d += `V${y.toFixed(2)} `;
    }
    d += `H${x1.toFixed(2)} `;
    prev = seg;
  }
  return d.trim();
}

function shortDayLabel(dayLabel?: string, dateStr?: string): { day: string; date: string } {
  const day = (dayLabel ?? "").slice(0, 3).toUpperCase() || "DAY";
  if (!dateStr) return { day, date: "" };
  const [, mm, dd] = dateStr.split("-");
  return { day, date: mm && dd ? `${dd}/${mm}` : dateStr };
}

export default function WorkSafeDaySheet({
  dayData,
  regulatoryTodayYmd,
  dayLabel,
  driverName,
  className,
}: {
  dayData: DayDataGrid;
  /** Regulatory calendar today (YYYY-MM-DD); aligns caps with derive/compliance. */
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
  const { day, date } = shortDayLabel(dayLabel, dateStr);
  const chartH = TRACKS.length * LANE_H;
  const rego = (dayData.truck_rego ?? "").trim();
  const startKm = formatKm(dayData.start_kms);
  const endKm = formatKm(dayData.end_kms);
  const from = (dayData.start_location ?? "").trim();
  const to = (dayData.destination ?? "").trim();

  const hourMarks = Array.from({ length: 25 }, (_, h) => h);
  const quarterMarks = Array.from({ length: 24 * 4 }, (_, i) => i * 15);

  const firstWork = paint.segments.find((s) => s.track === "work");
  const lastWork = [...paint.segments].reverse().find((s) => s.track === "work");

  return (
    <div className={cn("select-none", className)} aria-label="WorkSafe WA day sheet">
      <div className="overflow-x-auto -mx-1 px-1">
        <div
          className="min-w-[720px] rounded-sm border border-stone-400/70 bg-[#f7f3e8] text-stone-900 shadow-sm dark:border-stone-600"
          style={{ fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif' }}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-stone-400/60 px-2 py-1 text-[10px] leading-tight text-stone-700">
            {driverName?.trim() ? (
              <span>
                <span className="font-semibold uppercase tracking-wide text-stone-500">Driver </span>
                {driverName.trim()}
              </span>
            ) : null}
            {rego ? (
              <span>
                <span className="font-semibold uppercase tracking-wide text-stone-500">Rego </span>
                <span className="font-mono font-semibold">{rego}</span>
              </span>
            ) : null}
            {startKm ? (
              <span>
                <span className="font-semibold uppercase tracking-wide text-stone-500">Start km </span>
                <span className="font-mono">{startKm}</span>
              </span>
            ) : null}
            {endKm ? (
              <span>
                <span className="font-semibold uppercase tracking-wide text-stone-500">End km </span>
                <span className="font-mono">{endKm}</span>
              </span>
            ) : null}
            {!driverName?.trim() && !rego && !startKm && !endKm ? (
              <span className="text-stone-500">WorkSafe WA fatigue day record</span>
            ) : null}
          </div>

          <div className="flex">
            <div
              className="flex shrink-0 flex-col items-center justify-center border-r border-stone-400/60 bg-stone-200/40 px-1"
              style={{ width: DAY_COL }}
              aria-hidden
            >
              <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Day</span>
              <span className="text-sm font-bold leading-none">{day}</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-stone-500">Date</span>
              <span className="font-mono text-[11px] font-semibold tabular-nums">{date}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex border-b border-stone-400/50" style={{ height: HOUR_HEADER_H }}>
                <div className="shrink-0" style={{ width: LABEL_COL }} />
                <div className="relative min-w-0 flex-1">
                  {hourMarks.map((h) => (
                    <span
                      key={h}
                      className="absolute top-0.5 -translate-x-1/2 font-mono text-[8px] tabular-nums text-stone-600"
                      style={{ left: `${(h / 24) * 100}%` }}
                    >
                      {h === 24 ? "24.00" : `${h}.00`}
                    </span>
                  ))}
                </div>
                <div
                  className="flex shrink-0 items-center justify-center text-[7px] font-bold uppercase tracking-wide text-stone-500"
                  style={{ width: TOTAL_COL }}
                >
                  Total
                </div>
              </div>

              <div className="flex">
                <div className="shrink-0 border-r border-stone-400/50" style={{ width: LABEL_COL }}>
                  {TRACKS.map((track) => (
                    <div
                      key={track}
                      className="flex items-center justify-end border-b border-stone-300/80 px-1.5 text-right last:border-b-0"
                      style={{ height: LANE_H }}
                      title={ROW_TOOLTIPS[track]}
                    >
                      <span className="text-[8px] font-bold uppercase leading-tight tracking-wide text-stone-700 sm:text-[9px]">
                        {WORKSAFE_TRACK_LABELS[track]}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="relative min-w-0 flex-1">
                  <svg
                    width="100%"
                    height={chartH}
                    viewBox={`0 0 ${CHART_WIDTH} ${chartH}`}
                    preserveAspectRatio="none"
                    className="block"
                    role="img"
                    aria-label="Activity step line across the day"
                  >
                    {TRACKS.map((track, i) => (
                      <rect
                        key={track}
                        x={0}
                        y={i * LANE_H}
                        width={CHART_WIDTH}
                        height={LANE_H}
                        fill={i % 2 === 0 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.03)"}
                      />
                    ))}
                    {quarterMarks.map((m) => {
                      const isHour = m % 60 === 0;
                      const x = (m / MINUTES_PER_DAY) * CHART_WIDTH;
                      return (
                        <line
                          key={m}
                          x1={x}
                          y1={0}
                          x2={x}
                          y2={chartH}
                          stroke={isHour ? "rgba(68,64,60,0.45)" : "rgba(68,64,60,0.18)"}
                          strokeWidth={isHour ? 1 : 0.5}
                        />
                      );
                    })}
                    {TRACKS.slice(1).map((_, i) => (
                      <line
                        key={i}
                        x1={0}
                        y1={(i + 1) * LANE_H}
                        x2={CHART_WIDTH}
                        y2={(i + 1) * LANE_H}
                        stroke="rgba(68,64,60,0.55)"
                        strokeWidth={1}
                      />
                    ))}
                    {dateStr === todayYmd &&
                    paint.paintedUntilMinute > 0 &&
                    paint.paintedUntilMinute < MINUTES_PER_DAY ? (
                      <line
                        x1={(paint.paintedUntilMinute / MINUTES_PER_DAY) * CHART_WIDTH}
                        y1={0}
                        x2={(paint.paintedUntilMinute / MINUTES_PER_DAY) * CHART_WIDTH}
                        y2={chartH}
                        stroke="rgba(180,83,9,0.7)"
                        strokeWidth={1.25}
                        strokeDasharray="3 2"
                      />
                    ) : null}
                    {stepPath ? (
                      <path
                        d={stepPath}
                        fill="none"
                        stroke="#1c1917"
                        strokeWidth={2.25}
                        strokeLinejoin="miter"
                        strokeLinecap="square"
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                  </svg>

                  {from && firstWork && firstWork.startMin > 40 ? (
                    <span
                      className="pointer-events-none absolute truncate text-[8px] font-medium text-stone-600"
                      style={{
                        top: LANE_H + 4,
                        left: `2%`,
                        maxWidth: `${Math.max(8, ((firstWork.startMin - 16) / MINUTES_PER_DAY) * 100)}%`,
                      }}
                    >
                      {from}
                    </span>
                  ) : null}
                  {to && lastWork && lastWork.endMin < MINUTES_PER_DAY - 40 ? (
                    <span
                      className="pointer-events-none absolute truncate text-right text-[8px] font-medium text-stone-600"
                      style={{
                        top: LANE_H + 4,
                        left: `${((lastWork.endMin + 8) / MINUTES_PER_DAY) * 100}%`,
                        maxWidth: `${Math.max(8, ((MINUTES_PER_DAY - lastWork.endMin - 16) / MINUTES_PER_DAY) * 100)}%`,
                      }}
                    >
                      {to}
                    </span>
                  ) : null}
                </div>

                <div className="shrink-0 border-l border-stone-400/60" style={{ width: TOTAL_COL }}>
                  {TRACKS.map((track) => (
                    <div
                      key={track}
                      className="flex items-center justify-center border-b border-stone-300/80 font-mono text-[11px] font-bold tabular-nums text-stone-800 last:border-b-0"
                      style={{ height: LANE_H }}
                      title={ROW_TOOLTIPS[track]}
                    >
                      {formatTotal(paint.totalsMinutes[track])}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
