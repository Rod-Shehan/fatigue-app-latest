"use client";

import { useState, useMemo, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/PageHeader";
import { ManagerSubnav } from "@/components/manager/ManagerSubnav";
import { MANAGER_EXPERIENCE, MANAGER_PAGE_SHELL } from "@/lib/manager-experience";
import { useQuery } from "@tanstack/react-query";
import { api, type MapEvent } from "@/lib/api";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatSheetDisplayDate, getSheetDayDateString } from "@/lib/weeks";
import { Map, Loader2 } from "lucide-react";

const ManagerEventMap = dynamic(
  () => import("@/components/ManagerEventMap").then((m) => m.ManagerEventMap),
  { ssr: false }
);

const WEEK_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatWeekLabel(weekStarting: string): string {
  return new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function eventDayYmd(ev: MapEvent): string {
  return ev.time.slice(0, 10);
}

function ManagerMapViewInner() {
  // Deep-link support: the risk analysis card links here with its current
  // scope (e.g. /manager/map?week=2026-06-07&driver=Mick+Harland&day=3).
  const searchParams = useSearchParams();
  const [mapWeekStarting, setMapWeekStarting] = useState<string>(
    () => searchParams.get("week") ?? ""
  );
  const [mapDriverName, setMapDriverName] = useState<string>(
    () => searchParams.get("driver") ?? ""
  );
  const backDayIndex = searchParams.get("day");
  const [mapDayYmd, setMapDayYmd] = useState<string>(() => {
    const week = searchParams.get("week") ?? "";
    const dayRaw = searchParams.get("day");
    if (!week || dayRaw == null || dayRaw === "") return "";
    const dayIndex = Number(dayRaw);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return "";
    return getSheetDayDateString(week, dayIndex);
  });

  // Contextual back link: returns the manager to the Overview with the same
  // week / day / driver they were inspecting, so no inputs need re-entering.
  const overviewBackHref = useMemo(() => {
    const sp = new URLSearchParams();
    if (mapWeekStarting) sp.set("week", mapWeekStarting);
    if (backDayIndex != null) sp.set("day", backDayIndex);
    else if (mapWeekStarting && mapDayYmd) {
      for (let i = 0; i < 7; i++) {
        if (getSheetDayDateString(mapWeekStarting, i) === mapDayYmd) {
          sp.set("day", String(i));
          break;
        }
      }
    }
    if (mapDriverName) sp.set("driver", mapDriverName);
    const q = sp.toString();
    return `/manager${q ? `?${q}` : ""}`;
  }, [mapWeekStarting, mapDriverName, backDayIndex, mapDayYmd]);
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

  const { data: sheetMeta = [] } = useQuery({
    queryKey: ["sheets", "meta"],
    queryFn: () => api.sheets.list({ meta: true }),
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
  const gpsTrailAddonOn = mapEventsData?.gpsMovementTrailEnabled === true;

  const mapWeeks = useMemo(() => {
    const weeks = [...new Set(sheetMeta.map((s) => s.week_starting).filter(Boolean))];
    return weeks.sort().reverse();
  }, [sheetMeta]);
  const mapDrivers = useMemo(() => {
    const names = [...new Set(sheetMeta.map((s) => s.driver_name).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b));
  }, [sheetMeta]);

  const mapDayOptions = useMemo(() => {
    if (mapWeekStarting) {
      return WEEK_DAY_LABELS.map((label, index) => {
        const ymd = getSheetDayDateString(mapWeekStarting, index);
        return {
          ymd,
          label: `${label} ${formatSheetDisplayDate(ymd)}`,
        };
      });
    }
    const ymds = [...new Set(mapEvents.map(eventDayYmd).filter(Boolean))].sort().reverse();
    return ymds.map((ymd) => ({
      ymd,
      label: formatSheetDisplayDate(ymd),
    }));
  }, [mapWeekStarting, mapEvents]);

  // Drop stale day when week/events change.
  useEffect(() => {
    if (!mapDayYmd) return;
    if (!mapDayOptions.some((d) => d.ymd === mapDayYmd)) {
      setMapDayYmd("");
    }
  }, [mapDayYmd, mapDayOptions]);

  const filteredMapEvents = useMemo(() => {
    if (!mapDayYmd) return mapEvents;
    return mapEvents.filter((ev) => eventDayYmd(ev) === mapDayYmd);
  }, [mapEvents, mapDayYmd]);

  const trailEventCount = useMemo(
    () => filteredMapEvents.filter((ev) => (ev.history_1m?.length ?? 0) > 0).length,
    [filteredMapEvents]
  );

  const mapEventTypesSet = useMemo(() => {
    const checked = (["work", "break", "stop"] as const).filter(
      (t) => mapEventTypes[t]
    );
    return new Set(checked);
  }, [mapEventTypes]);

  const filtersActive = Boolean(mapWeekStarting || mapDriverName || mapDayYmd);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className={MANAGER_PAGE_SHELL}>
        <PageHeader
          backHref={overviewBackHref}
          backLabel={MANAGER_EXPERIENCE.NAV_RISK_BRIEF}
          backText={MANAGER_EXPERIENCE.NAV_OVERVIEW}
          title={MANAGER_EXPERIENCE.NAV_MAP}
          subtitle={MANAGER_EXPERIENCE.MAP_PAGE_SUBTITLE}
          icon={<Map className="w-5 h-5 sm:w-6 sm:h-6" />}
        />
        <ManagerSubnav />
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Filter by week, day, and driver. Each marker is a logbook entry with a location — use it to support
            assurance conversations, not driver surveillance.
          </p>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setMapWeekStarting("");
                    setMapDriverName("");
                    setMapDayYmd("");
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
                  onValueChange={(v) => {
                    setMapWeekStarting(v === "all" ? "" : v);
                    setMapDayYmd("");
                  }}
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
                  Day
                </Label>
                <Select
                  value={mapDayYmd || "all"}
                  onValueChange={(v) => setMapDayYmd(v === "all" ? "" : v)}
                  disabled={!mapWeekStarting && mapDayOptions.length === 0}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="All days" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All days</SelectItem>
                    {mapDayOptions.map((d) => (
                      <SelectItem key={d.ymd} value={d.ymd}>
                        {d.label}
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
            {!mapEventsLoading ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing {filteredMapEvents.length} located event
                {filteredMapEvents.length === 1 ? "" : "s"}
                {gpsTrailAddonOn
                  ? ` · ${trailEventCount} with GPS movement trail`
                  : " · GPS trail addon off"}
              </p>
            ) : null}
            {mapEventsLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 min-h-[320px]">
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin shrink-0" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Loading map events…</span>
              </div>
            ) : (
              <ManagerEventMap
                events={filteredMapEvents}
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
              {gpsTrailAddonOn ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0 w-6 border-t-2 border-sky-600 dark:border-sky-400" />
                  GPS movement trail (when available)
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Each marker is where a driver{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">logged a status change</span> — not
              live fleet tracking. A break dot beside a work dot is normal: the driver pulled over, rested, then
              resumed work from the same spot.
              {gpsTrailAddonOn ? (
                <>
                  {" "}
                  A solid sky trail is optional GPS crumbs from{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    movement since the previous log
                  </span>{" "}
                  (stationary waits are omitted to keep the dump small). New trails only appear on logs made while the
                  addon is on.
                </>
              ) : (
                <>
                  {" "}
                  GPS movement trail addon is{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">off</span> — enable it on Test
                  desk or Security if your organisation uses that addon.
                </>
              )}
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
