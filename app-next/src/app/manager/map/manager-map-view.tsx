"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/PageHeader";
import { ManagerSubnav } from "@/components/manager/ManagerSubnav";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
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

function ManagerMapViewInner() {
  // Deep-link support: the risk analysis card links here with its current
  // scope (e.g. /manager/map?week=2026-06-07&driver=Mick+Harland).
  const searchParams = useSearchParams();
  const [mapWeekStarting, setMapWeekStarting] = useState<string>(
    () => searchParams.get("week") ?? ""
  );
  const [mapDriverName, setMapDriverName] = useState<string>(
    () => searchParams.get("driver") ?? ""
  );
  const [mapEventTypes, setMapEventTypes] = useState({
    work: true,
    break: true,
    stop: true,
  });
  const mapEventTypeLabel: Record<keyof typeof mapEventTypes, string> = {
    work: "Work started",
    break: "Break started",
    stop: "Shift ended",
  };

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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <PageHeader
          backHref="/manager"
          backLabel={MANAGER_EXPERIENCE.NAV_RISK_BRIEF}
          title={MANAGER_EXPERIENCE.NAV_MAP}
          subtitle={MANAGER_EXPERIENCE.MAP_PAGE_SUBTITLE}
          icon={<Map className="w-5 h-5 sm:w-6 sm:h-6" />}
          showLobbyLink={false}
        />
        <ManagerSubnav />
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Filter by week and driver. Each marker is a logbook entry with a location — use it to support assurance conversations, not driver surveillance.
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
                      <span>{mapEventTypeLabel[type]}</span>
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-white bg-blue-500 shadow" />
                Started work
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-white bg-amber-500 shadow" />
                Started break
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border border-white bg-red-500 shadow" />
                Ended shift
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0 w-6 border-t-2 border-dashed border-teal-700 dark:border-teal-500" />
                One driver&apos;s day, in logged order
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Each marker is where a driver <span className="font-semibold text-slate-700 dark:text-slate-200">logged a status change</span> — not continuous tracking.
              A break dot beside a work dot is normal: the driver pulled over, rested, then resumed work from the same spot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManagerMapView() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <ManagerMapViewInner />
    </Suspense>
  );
}
