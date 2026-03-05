"use client";

import { TIME_GRID_ROWS } from "@/lib/theme";
import { getTodayLocalDateString } from "@/lib/weeks";

const TOTAL_MINUTES = 24 * 60;

/** Merge overlapping/adjacent ranges and return gaps in [0, totalMin]. */
function rangesToGaps(ranges: { startMin: number; endMin: number }[], totalMin: number): { startMin: number; endMin: number }[] {
  if (ranges.length === 0) return [{ startMin: 0, endMin: totalMin }];
  const sorted = [...ranges].sort((a, b) => a.startMin - b.startMin);
  const merged: { startMin: number; endMin: number }[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.startMin <= last.endMin) last.endMin = Math.max(last.endMin, r.endMin);
    else merged.push({ startMin: r.startMin, endMin: r.endMin });
  }
  const gaps: { startMin: number; endMin: number }[] = [];
  let pos = 0;
  for (const r of merged) {
    if (r.startMin > pos) gaps.push({ startMin: pos, endMin: r.startMin });
    pos = Math.max(pos, r.endMin);
  }
  if (pos < totalMin) gaps.push({ startMin: pos, endMin: totalMin });
  return gaps;
}

/** Non-work is retrospective only: cap at now on the current day; no time for future days. */
function getEffectiveDayEndMinutes(dateStr: string): number {
  const today = getTodayLocalDateString();
  if (dateStr > today) return 0;
  if (dateStr < today) return 24 * 60;
  const dayStart = new Date(dateStr + "T00:00:00").getTime();
  return Math.min(24 * 60, Math.ceil((Date.now() - dayStart) / 60000));
}

/** Convert 48 half-hour slots to segment ranges (minutes), capping end at capAtMin. */
function slotsToRanges(slots: boolean[] | undefined, capAtMin: number): { startMin: number; endMin: number }[] {
  if (!slots || slots.length < 48) return [];
  const ranges: { startMin: number; endMin: number }[] = [];
  let start: number | null = null;
  for (let i = 0; i < 48; i++) {
    const slotStart = i * 30;
    const slotEnd = (i + 1) * 30;
    const on = !!slots[i];
    if (on && start === null) start = slotStart;
    if (!on && start !== null) {
      ranges.push({ startMin: start, endMin: Math.min(slotStart, capAtMin) });
      start = null;
    }
    if (on && i === 47) {
      ranges.push({ startMin: start!, endMin: Math.min(slotEnd, capAtMin) });
    }
  }
  return ranges;
}

function buildSegments(events: { time: string; type: string }[] | undefined, dateStr: string) {
  const segments: { work_time: { startMin: number; endMin: number }[]; breaks: { startMin: number; endMin: number }[]; non_work: { startMin: number; endMin: number }[] } = {
    work_time: [],
    breaks: [],
    non_work: [],
  };
  const dayStart = new Date(dateStr + "T00:00:00").getTime();
  const dayEnd = new Date(dateStr + "T23:59:59").getTime();
  const effectiveEndMin = getEffectiveDayEndMinutes(dateStr);

  if (!events?.length) {
    if (effectiveEndMin > 0) segments.non_work = [{ startMin: 0, endMin: effectiveEndMin }];
    return segments;
  }

  const MIN_BREAK_BLOCK_MINUTES = 10;
  const workOrBreakRanges: { startMin: number; endMin: number }[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const nextEv = events[i + 1];
    if (ev.type === "stop") continue;
    const end = nextEv ? new Date(nextEv.time).getTime() : Date.now();
    const clampedEnd = Math.min(end, dayEnd);
    const start = new Date(ev.time).getTime();
    const clampedStart = Math.max(start, dayStart);
    if (clampedStart >= clampedEnd) continue;
    let startMin = Math.floor((clampedStart - dayStart) / 60000);
    let endMin = Math.ceil((clampedEnd - dayStart) / 60000);
    endMin = Math.min(endMin, effectiveEndMin);
    if (startMin >= endMin) continue;
    const durationMinutes = endMin - startMin;
    const isCompletedBreak = ev.type === "break" && nextEv != null;
    const treatBreakAsWork = isCompletedBreak && durationMinutes < MIN_BREAK_BLOCK_MINUTES;
    if (ev.type === "work" || treatBreakAsWork) {
      segments.work_time.push({ startMin, endMin });
      workOrBreakRanges.push({ startMin, endMin });
    } else if (ev.type === "break") {
      segments.breaks.push({ startMin, endMin });
      workOrBreakRanges.push({ startMin, endMin });
    }
  }
  if (effectiveEndMin > 0) segments.non_work = rangesToGaps(workOrBreakRanges, effectiveEndMin);
  return segments;
}

function getTotalMinutes(segs: { startMin: number; endMin: number }[]) {
  return segs.reduce((sum, s) => sum + (s.endMin - s.startMin), 0);
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Minutes since midnight to "HH:MM" for labels under bars. */
function minToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type DayDataGrid = {
  events?: { time: string; type: string }[];
  date?: string;
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
};

export default function TimeGrid({ dayData }: { dayData: DayDataGrid }) {
  const events = dayData.events || [];
  const dateStr = dayData.date || getTodayLocalDateString();
  const effectiveEndMin = getEffectiveDayEndMinutes(dateStr);

  const slotBased =
    dayData.work_time != null && dayData.breaks != null && dayData.non_work != null;
  // Prefer 1-minute boundaries from events so the grid accurately reflects the shift. Fall back to 30-min slots only when no events.
  const segments =
    events.length > 0
      ? buildSegments(events, dateStr)
      : slotBased
        ? {
            work_time: slotsToRanges(
              dayData.work_time!.map((w, i) => w && !dayData.breaks![i]),
              24 * 60
            ),
            breaks: slotsToRanges(dayData.breaks, 24 * 60),
            non_work: slotsToRanges(dayData.non_work, effectiveEndMin),
          }
        : buildSegments(events, dateStr);

  const ticks = Array.from({ length: 13 }, (_, i) => i * 2);

  return (
    <div className="select-none">
      <div className="relative h-3 mb-0.5" style={{ marginLeft: 72 }}>
        {ticks.map((h) => (
          <span
            key={h}
            className="absolute text-[8px] font-mono text-slate-300 dark:text-slate-500 -translate-x-1/2"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {TIME_GRID_ROWS.map((row) => {
          const segs = segments[row.key as keyof typeof segments];
          const totalMins = getTotalMinutes(segs);
          const rowTooltip =
            row.key === "work_time"
              ? "Logged work time"
              : row.key === "breaks"
                ? "Counted as break: short gaps (≤30 min) between work; used for 20 min / 5h rule. Any break longer than 30 min is counted as non-work."
                : "Counted as non-work (recovery): time between shifts and breaks longer than 30 min.";
          return (
            <div
              key={row.key}
              className="flex items-start gap-1.5 sm:gap-2"
              title={rowTooltip}
            >
              <span className="w-[68px] shrink-0 pt-0.5 text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-right">
                {row.label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="relative h-2.5 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                  {segs.map((seg, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-full rounded-sm opacity-90"
                      style={{
                        left: `${(seg.startMin / TOTAL_MINUTES) * 100}%`,
                        width: `${Math.max(((seg.endMin - seg.startMin) / TOTAL_MINUTES) * 100, 0.2)}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  ))}
                  {ticks.slice(1, -1).map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 h-full border-l border-white/40 pointer-events-none"
                      style={{ left: `${(h / 24) * 100}%` }}
                    />
                  ))}
                </div>
                {segs.length > 0 && (
                  <div className="relative h-3.5 mt-0.5 flex items-center">
                    {segs.map((seg, i) => {
                      const pctStart = (seg.startMin / TOTAL_MINUTES) * 100;
                      const pctWidth = Math.max(((seg.endMin - seg.startMin) / TOTAL_MINUTES) * 100, 0.2);
                      const narrow = pctWidth < 12;
                      return (
                        <span
                          key={i}
                          className="absolute text-[8px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-full"
                          style={{
                            left: `${pctStart}%`,
                            width: `${pctWidth}%`,
                            paddingLeft: "1px",
                          }}
                          title={`${minToHHMM(seg.startMin)} – ${minToHHMM(seg.endMin)}`}
                        >
                          {narrow ? minToHHMM(seg.startMin) : `${minToHHMM(seg.startMin)}–${minToHHMM(seg.endMin)}`}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className="w-12 sm:w-14 shrink-0 text-right text-[10px] sm:text-[11px] font-bold font-mono text-slate-600 dark:text-slate-300 pt-0.5">
                {totalMins > 0 ? formatHours(totalMins) : <span className="text-slate-300 dark:text-slate-500">—</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
