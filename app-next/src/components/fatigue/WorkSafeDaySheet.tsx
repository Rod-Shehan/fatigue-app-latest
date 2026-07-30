"use client";

import { useMemo } from "react";
import {
  buildWorkSafeDayPaint,
  WORKSAFE_TRACK_LABELS,
  type WorkSafeTrack,
} from "@/lib/worksafe-day-sheet";
import {
  quarterTracksFromPaint,
  WORKSAFE_HOUR_LABELS,
  WORKSAFE_QUARTERS_PER_DAY,
  WORKSAFE_TRACKS,
} from "@/lib/worksafe-day-sheet/quarter-grid";
import { formatHoursStatistic } from "@/lib/hours";
import { getTodayLocalDateString } from "@/lib/weeks";
import { cn } from "@/lib/utils";

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

export default function WorkSafeDaySheet({
  dayData,
  regulatoryTodayYmd,
  dayLabel,
  className,
}: {
  dayData: DayDataGrid;
  /** Regulatory calendar today (YYYY-MM-DD); aligns caps with derive/compliance. */
  regulatoryTodayYmd?: string;
  dayLabel?: string;
  /** Kept for API compatibility; paper day row does not show driver name. */
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

  const quarterTracks = useMemo(() => quarterTracksFromPaint(paint), [paint]);

  const startKm = formatKm(dayData.start_kms);
  const endKm = formatKm(dayData.end_kms);
  const from = (dayData.start_location ?? "").trim();
  const to = (dayData.destination ?? "").trim();
  const dayName = dayNameUpper(dayLabel);

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

          <div className="flex border-b border-black">
            <div className="w-[108px] shrink-0 border-r border-black px-1.5 py-1">
              <span className="text-[11px] font-bold underline decoration-1 underline-offset-2">{dayName}</span>
            </div>
            <div className="flex min-w-0 flex-1">
              {WORKSAFE_HOUR_LABELS.map((label, h) => (
                <div
                  key={label}
                  className={cn(
                    "flex flex-1 items-center justify-center border-r border-black py-0.5 font-mono text-[8px] tabular-nums sm:text-[9px]",
                    h % 2 === 0 ? "bg-stone-200" : "bg-white"
                  )}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="flex w-12 shrink-0 items-center justify-center bg-stone-200 text-[9px] font-bold sm:w-14 sm:text-[10px]">
              Total
            </div>
          </div>

          {WORKSAFE_TRACKS.map((track, rowIdx) => (
            <div
              key={track}
              className={cn("flex", rowIdx < WORKSAFE_TRACKS.length - 1 && "border-b border-black")}
              title={ROW_TOOLTIPS[track]}
            >
              <div className="flex w-[108px] shrink-0 items-center border-r border-black px-1.5 py-0.5">
                <span className="text-[8px] font-semibold leading-tight sm:text-[9px]">
                  {WORKSAFE_TRACK_LABELS[track]}
                </span>
              </div>
              <div className="flex min-w-0 flex-1" role="img" aria-label={`${WORKSAFE_TRACK_LABELS[track]} grid`}>
                {Array.from({ length: WORKSAFE_QUARTERS_PER_DAY }, (_, q) => {
                  const filled = quarterTracks[q] === track;
                  const hourEdge = q % 4 === 0;
                  return (
                    <div
                      key={q}
                      className={cn(
                        "h-7 flex-1 border-r sm:h-8",
                        hourEdge ? "border-black" : "border-stone-300",
                        filled ? "bg-stone-900" : "bg-white"
                      )}
                    />
                  );
                })}
              </div>
              <div className="flex w-12 shrink-0 items-center justify-center border-l border-black font-mono text-[10px] font-bold tabular-nums sm:w-14 sm:text-[11px]">
                {formatTotal(paint.totalsMinutes[track])}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
