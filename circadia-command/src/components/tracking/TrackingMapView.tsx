"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { MapEvent } from "@/lib/map-event-types";
import {
  WEEK_DAY_LABELS,
  formatSheetDisplayDate,
  formatWeekLabel,
  getSheetDayDateString,
} from "@/lib/sheet-weeks";
import { commandCard, commandInput, commandLabel } from "@/components/command/command-styles";

const CommandEventMap = dynamic(
  () => import("@/components/tracking/CommandEventMap").then((m) => m.CommandEventMap),
  { ssr: false }
);

type SheetMeta = { week_starting: string; driver_name: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function eventDayYmd(ev: MapEvent): string {
  return ev.time.slice(0, 10);
}

export function TrackingMapView() {
  const [mapWeekStarting, setMapWeekStarting] = useState("");
  const [mapDriverName, setMapDriverName] = useState("");
  const [mapDayYmd, setMapDayYmd] = useState("");
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

  const { data: metaData } = useQuery({
    queryKey: ["command", "map-events", "meta"],
    queryFn: () => fetchJson<{ sheets: SheetMeta[] }>("/api/v1/map-events?meta=1"),
  });
  const sheetMeta = metaData?.sheets ?? [];

  const { data: mapEventsData, isLoading: mapEventsLoading } = useQuery({
    queryKey: ["command", "map-events", mapWeekStarting, mapDriverName],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (mapWeekStarting) sp.set("weekStarting", mapWeekStarting);
      if (mapDriverName) sp.set("driverName", mapDriverName);
      const q = sp.toString();
      return fetchJson<{ events: MapEvent[]; gpsMovementTrailEnabled: boolean }>(
        `/api/v1/map-events${q ? `?${q}` : ""}`
      );
    },
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
    const checked = (["work", "break", "stop"] as const).filter((t) => mapEventTypes[t]);
    return new Set(checked);
  }, [mapEventTypes]);

  const filtersActive = Boolean(mapWeekStarting || mapDriverName || mapDayYmd);

  return (
    <div className={`${commandCard} p-4 md:p-6`}>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Filter by week, day, and driver. Each marker is a logbook entry with a location —
        use it to support assurance conversations, not driver surveillance.
      </p>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setMapWeekStarting("");
                setMapDriverName("");
                setMapDayYmd("");
              }}
              className="text-xs font-medium text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Reset filters
            </button>
          ) : null}

          <div className="space-y-1">
            <label className={commandLabel}>Week</label>
            <select
              className={`${commandInput} mt-0 w-[200px]`}
              value={mapWeekStarting || "all"}
              onChange={(e) => {
                setMapWeekStarting(e.target.value === "all" ? "" : e.target.value);
                setMapDayYmd("");
              }}
            >
              <option value="all">All weeks</option>
              {mapWeeks.map((w) => (
                <option key={w} value={w}>
                  {formatWeekLabel(w)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className={commandLabel}>Day</label>
            <select
              className={`${commandInput} mt-0 w-[220px]`}
              value={mapDayYmd || "all"}
              onChange={(e) => setMapDayYmd(e.target.value === "all" ? "" : e.target.value)}
              disabled={!mapWeekStarting && mapDayOptions.length === 0}
            >
              <option value="all">All days</option>
              {mapDayOptions.map((d) => (
                <option key={d.ymd} value={d.ymd}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className={commandLabel}>Driver</label>
            <select
              className={`${commandInput} mt-0 w-[180px]`}
              value={mapDriverName || "all"}
              onChange={(e) => setMapDriverName(e.target.value === "all" ? "" : e.target.value)}
            >
              <option value="all">All drivers</option>
              {mapDrivers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className={commandLabel}>Event types</span>
            <div className="flex gap-3 pt-1">
              {(["work", "break", "stop"] as const).map((type) => (
                <label
                  key={type}
                  className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"
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
          <div className="flex min-h-[420px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Loading map events…
            </span>
          </div>
        ) : (
          <CommandEventMap
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
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            logged a status change
          </span>{" "}
          — not live fleet tracking. A break dot beside a work dot is normal: the driver
          pulled over, rested, then resumed work from the same spot.
          {gpsTrailAddonOn ? (
            <>
              {" "}
              A solid sky trail is optional GPS crumbs from{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                movement since the previous log
              </span>{" "}
              (stationary waits are omitted). New trails only appear on logs made while the
              addon is on in Enterprise.
            </>
          ) : (
            <>
              {" "}
              GPS movement trail addon is{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">off</span> —
              enable it on Enterprise Test desk or Security if your organisation uses that
              addon.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
