"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Map, Loader2 } from "lucide-react";

const ManagerEventMap = dynamic(
  () => import("@/components/ManagerEventMap").then((m) => m.ManagerEventMap),
  { ssr: false }
);

function formatWeekLabel(weekStarting: string): string {
  return new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ManagerMapView() {
  const [mapWeekStarting, setMapWeekStarting] = useState<string>("");
  const [mapDriverName, setMapDriverName] = useState<string>("");
  const [mapEventTypes, setMapEventTypes] = useState({
    work: true,
    break: true,
    stop: true,
  });

  const { data: sheets = [] } = useQuery({
    queryKey: ["sheets"],
    queryFn: () => api.sheets.list(),
  });

  const { data: mapEventsData, isLoading: mapEventsLoading } = useQuery({
    queryKey: ["manager", "map-events", mapWeekStarting, mapDriverName],
    queryFn: () =>
      api.manager.mapEvents({
        ...(mapWeekStarting && { weekStarting: mapWeekStarting }),
        ...(mapDriverName && { driverName: mapDriverName }),
      }),
  });
  const mapEvents = mapEventsData?.events ?? [];

  const mapWeeks = useMemo(() => {
    const weeks = [...new Set(sheets.map((s) => s.week_starting).filter(Boolean))];
    return weeks.sort().reverse();
  }, [sheets]);
  const mapDrivers = useMemo(() => {
    const names = [...new Set(sheets.map((s) => s.driver_name).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b));
  }, [sheets]);

  const mapEventTypesSet = useMemo(() => {
    const checked = (["work", "break", "stop"] as const).filter(
      (t) => mapEventTypes[t]
    );
    return new Set(checked);
  }, [mapEventTypes]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <PageHeader
          backHref="/manager"
          backLabel="Manager dashboard"
          title="Event map"
          subtitle="Driver time inputs with location"
          icon={<Map className="w-5 h-5 sm:w-6 sm:h-6" />}
        />
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Filter by week and driver, then click a marker to see details.
          </p>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              {(mapWeekStarting || mapDriverName) && (
                <button
                  type="button"
                  onClick={() => {
                    setMapWeekStarting("");
                    setMapDriverName("");
                  }}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
                >
                  Reset filters
                </button>
              )}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Week
                </Label>
                <Select
                  value={mapWeekStarting || "all"}
                  onValueChange={(v) => setMapWeekStarting(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All weeks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All weeks</SelectItem>
                    {mapWeeks.map((w) => (
                      <SelectItem key={w} value={w}>
                        {formatWeekLabel(w)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Driver
                </Label>
                <Select
                  value={mapDriverName || "all"}
                  onValueChange={(v) => setMapDriverName(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All drivers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All drivers</SelectItem>
                    {mapDrivers.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Event types
                </Label>
                <div className="flex gap-3">
                  {(["work", "break", "stop"] as const).map((type) => (
                    <label
                      key={type}
                      className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={mapEventTypes[type]}
                        onChange={(e) =>
                          setMapEventTypes((t) => ({ ...t, [type]: e.target.checked }))
                        }
                        className="rounded border-slate-300 dark:border-slate-600"
                      />
                      <span className="capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {mapEventsLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 min-h-[320px]">
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin shrink-0" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Loading map events…</span>
              </div>
            ) : (
              <ManagerEventMap
                events={mapEvents}
                eventTypesFilter={mapEventTypesSet}
                className="w-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
