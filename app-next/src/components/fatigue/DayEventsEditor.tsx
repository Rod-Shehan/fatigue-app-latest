"use client";

import React from "react";
import Link from "next/link";
import { Briefcase, Coffee, Moon, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActivityKey } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type DayEventDraft = {
  time: string;
  type: string;
  driver?: "primary" | "second";
};

/** Event types drivers may add or change when correcting a day. */
export const EDITABLE_DAY_EVENT_TYPES: ActivityKey[] = ["work", "break", "non_work", "stop"];

const TYPE_LABELS: Record<ActivityKey, string> = {
  work: "Work",
  break: "Break",
  non_work: "Non-work",
  stop: "End shift",
};

const TYPE_ICONS: Record<ActivityKey, React.ComponentType<{ className?: string }>> = {
  work: Briefcase,
  break: Coffee,
  non_work: Moon,
  stop: Square,
};

function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function hhmmToIsoOnDate(dayYmd: string, hhmm: string): string {
  return new Date(`${dayYmd}T${hhmm}:00`).toISOString();
}

function defaultTimeForNewEvent(dayYmd: string, existing: DayEventDraft[]): string {
  if (existing.length === 0) return `${dayYmd}T06:00:00`;
  const sorted = [...existing].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const last = sorted[sorted.length - 1]!;
  const next = new Date(new Date(last.time).getTime() + 30 * 60 * 1000);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  const hh = String(next.getHours()).padStart(2, "0");
  const mm = String(next.getMinutes()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00`).toISOString();
}

function isActivityKey(type: string): type is ActivityKey {
  return (EDITABLE_DAY_EVENT_TYPES as string[]).includes(type);
}

export function normalizeDayEvents(events: DayEventDraft[]): DayEventDraft[] {
  return [...events]
    .filter((e) => e && typeof e.time === "string" && typeof e.type === "string")
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

export function DayEventsEditor({
  sheetDayYmd,
  events,
  onChange,
  readOnly = false,
  sheetId,
  driverType,
}: {
  sheetDayYmd: string;
  events: DayEventDraft[];
  onChange: (events: DayEventDraft[]) => void;
  readOnly?: boolean;
  /** Link to full-week shift log below the editor. */
  sheetId?: string;
  /** When two_up, work events can be tagged primary/second. */
  driverType?: string;
}) {
  const sorted = normalizeDayEvents(events);

  const addEvent = (type: ActivityKey) => {
    onChange([...events, { type, time: defaultTimeForNewEvent(sheetDayYmd, events) }]);
  };

  const updateAt = (eventIndex: number, patch: Partial<DayEventDraft>) => {
    onChange(events.map((item, j) => (j === eventIndex ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Work, break &amp; non-work times
        </Label>
        {sheetId && (
          <Link
            href={`/sheets/${sheetId}/shift-log`}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 underline underline-offset-2"
          >
            Full week log
          </Link>
        )}
      </div>

      {readOnly ? (
        sorted.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No events logged this day.</p>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((ev, i) => (
              <li
                key={`${ev.time}-${ev.type}-${i}`}
                className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <span className="font-mono tabular-nums w-14 shrink-0">{isoToHHMM(ev.time)}</span>
                <span className="font-medium">{TYPE_LABELS[isActivityKey(ev.type) ? ev.type : "stop"] ?? ev.type}</span>
                {ev.driver ? <span className="text-xs text-slate-500">({ev.driver})</span> : null}
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
            Correct work, break, non-work, or end-shift times for this day. Use{" "}
            <span className="font-medium text-slate-600 dark:text-slate-300">break</span> for rest during a shift
            (counts toward 5h rules),{" "}
            <span className="font-medium text-slate-600 dark:text-slate-300">non-work</span> when off duty or between
            shifts (7h / 24h recovery), and{" "}
            <span className="font-medium text-slate-600 dark:text-slate-300">end shift</span> when you finished for the
            day.
          </p>
          {sorted.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No events yet — add work, break, non-work, or end shift below.
            </p>
          ) : (
            <div className="space-y-2">
              {events
                .map((ev, i) => ({ ev, i }))
                .sort((a, b) => new Date(a.ev.time).getTime() - new Date(b.ev.time).getTime())
                .map(({ ev, i: eventIndex }) => {
                  const typeKey: ActivityKey = isActivityKey(ev.type) ? ev.type : "work";
                  return (
                    <div key={eventIndex} className="flex flex-wrap items-center gap-2">
                      <Select
                        value={typeKey}
                        onValueChange={(v) => {
                          const nextType = v as ActivityKey;
                          const patch: Partial<DayEventDraft> = { type: nextType };
                          if (nextType !== "work") patch.driver = undefined;
                          updateAt(eventIndex, patch);
                        }}
                      >
                        <SelectTrigger className="h-11 w-[7.5rem] shrink-0 text-xs font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EDITABLE_DAY_EVENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="text-sm font-medium">
                              {TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="time"
                        value={isoToHHMM(ev.time)}
                        onChange={(e) => {
                          const hhmm = e.target.value;
                          updateAt(eventIndex, { time: hhmmToIsoOnDate(sheetDayYmd, hhmm) });
                        }}
                        className="h-11 w-28 text-base font-mono flex-1 min-w-[6.5rem]"
                        aria-label={`Time for ${TYPE_LABELS[typeKey]}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-11 px-2 shrink-0 text-red-600 dark:text-red-400"
                        aria-label={`Remove ${TYPE_LABELS[typeKey]}`}
                        onClick={() => onChange(events.filter((_, j) => j !== eventIndex))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {EDITABLE_DAY_EVENT_TYPES.map((t) => {
              const Icon = TYPE_ICONS[t];
              return (
                <Button
                  key={t}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "min-h-10 gap-1.5 text-sm font-semibold",
                    t === "break" && "border-amber-300 dark:border-amber-600 text-amber-900 dark:text-amber-100",
                    t === "non_work" && "border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100"
                  )}
                  onClick={() => addEvent(t)}
                >
                  <Icon className="w-4 h-4 opacity-90" aria-hidden />
                  Add {TYPE_LABELS[t].toLowerCase()}
                </Button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
