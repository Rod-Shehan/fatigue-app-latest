"use client";

import React from "react";
import { Briefcase, Coffee, Moon, Square, MapPin, CheckCircle2 } from "lucide-react";
import { ACTIVITY_THEME, type ActivityKey } from "@/lib/theme";
import DayEntry from "./DayEntry";
import SheetHeader from "./SheetHeader";
import type { DayData, Rego } from "@/lib/api";
import { getTodayLocalDateString } from "@/lib/weeks";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function getDurationMinutes(start: string, end: string) {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}
function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function formatGps(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

const EVENT_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  work: { label: "Work", icon: Briefcase },
  break: { label: "Break", icon: Coffee },
  non_work: { label: "Non-Work Time", icon: Moon },
  stop: { label: "End", icon: Square },
};

type EventWithLocation = { time: string; type: string; lat?: number; lng?: number };

function ShiftLogColumn({ events }: { events: EventWithLocation[] }) {
  const rows: { time: string; type: string; duration: number; hasGps: boolean; gps: string | null }[] = [];
  events.forEach((ev, idx) => {
    const next = events[idx + 1];
    const dur = next ? getDurationMinutes(ev.time, next.time) : 0;
    const typeKey = ev.type in EVENT_LABELS ? ev.type : "stop";
    const hasGps = ev.lat != null && ev.lng != null;
    rows.push({
      time: formatTime(ev.time),
      type: typeKey,
      duration: ev.type !== "stop" ? dur : 0,
      hasGps,
      gps: hasGps ? formatGps(ev.lat!, ev.lng!) : null,
    });
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-[10px]">
      <p className="mb-1.5 font-semibold uppercase tracking-wider text-slate-500">Shift log</p>
      {rows.length === 0 ? (
        <p className="text-slate-400 italic">No events</p>
      ) : (
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-0.5 pr-1 text-left font-medium">Time</th>
              <th className="py-0.5 pr-1 text-left font-medium">Type</th>
              <th className="py-0.5 pr-1 text-right font-medium">Dur</th>
              <th className="py-0.5 text-left font-medium">GPS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const cfg = EVENT_LABELS[r.type];
              const badge = ACTIVITY_THEME[(r.type as ActivityKey) || "work"]?.badge ?? "";
              return (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="py-0.5 pr-1 font-mono text-slate-700">{r.time}</td>
                  <td className="py-0.5 pr-1">
                    <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium ${badge}`}>
                      {cfg && React.createElement(cfg.icon, { className: "w-2.5 h-2.5" })}
                      {cfg?.label ?? r.type}
                    </span>
                  </td>
                  <td className="py-0.5 pr-1 text-right font-mono text-slate-600">
                    {r.duration > 0 ? formatDuration(r.duration) : "—"}
                  </td>
                  <td className="py-0.5 text-slate-600">
                    {r.gps ? (
                      <span className="flex items-center gap-0.5 font-mono" title={r.gps}>
                        <MapPin className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[100px]">{r.gps}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export type PdfExportViewProps = {
  sheetData: {
    driver_name: string;
    second_driver?: string;
    driver_type: string;
    last_24h_break?: string;
    week_starting: string;
    days: DayData[];
    signature?: string;
    signed_at?: string;
  };
  regos?: Rego[];
  onHeaderChange?: (data: Record<string, unknown>) => void;
};

export default function PdfExportView({ sheetData, regos = [], onHeaderChange }: PdfExportViewProps) {
  const weekStarting = sheetData.week_starting ?? "";

  return (
    <div className="w-[1000px] bg-slate-100 p-4" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <SheetHeader
          sheetData={sheetData}
          onChange={onHeaderChange ?? (() => {})}
          readOnly
        />
      </div>

      <div className="space-y-3">
        {(sheetData.days ?? []).slice(0, 7).map((day, idx) => {
          const events = (day.events ?? []) as EventWithLocation[];
          return (
            <div key={idx} className="flex gap-3 items-start">
              <div className="min-w-0 flex-1" style={{ minWidth: 0 }}>
                <DayEntry
                  dayIndex={idx}
                  dayData={day}
                  onUpdate={() => {}}
                  weekStart={weekStarting}
                  regos={regos}
                  readOnly
                  todayYmd={getTodayLocalDateString()}
                />
              </div>
              <div className="w-52 min-w-[208px] shrink-0 flex-shrink-0">
                <ShiftLogColumn events={events} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-slate-500 italic">
        Work, break and end shift events include GPS location where available for audit and compliance evidence.
      </p>

      {sheetData.signature && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Driver Signature
          </p>
          <div className="inline-block overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <img src={sheetData.signature} alt="Signature" className="h-16 w-auto" />
          </div>
          {sheetData.signed_at && (
            <p className="mt-1.5 text-[10px] text-slate-500">
              Signed{" "}
              {new Date(sheetData.signed_at).toLocaleString("en-AU", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
