"use client";

import { useMemo, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import type { MapEvent } from "@/lib/api";
import "leaflet/dist/leaflet.css";

/**
 * Each marker is where the driver was when they LOGGED the event — a status
 * change, not continuous tracking. A break dot next to a work dot means the
 * driver pulled over, started a break, then resumed work from the same spot.
 */
const EVENT_META: Record<
  string,
  { label: string; color: string; fillColor: string; radius: number }
> = {
  work: { label: "Started work", color: "#1d4ed8", fillColor: "#3b82f6", radius: 7 },
  break: { label: "Started break", color: "#b45309", fillColor: "#f59e0b", radius: 7 },
  stop: { label: "Ended shift", color: "#b91c1c", fillColor: "#ef4444", radius: 9 },
  non_work: { label: "Off duty", color: "#475569", fillColor: "#94a3b8", radius: 6 },
};

function eventMeta(type: string) {
  return EVENT_META[type] ?? EVENT_META.work;
}

function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function FitBounds({ events }: { events: MapEvent[] }) {
  const map = useMap();
  useEffect(() => {
    if (events.length === 0) return;
    const lats = events.map((e) => e.lat);
    const lngs = events.map((e) => e.lng);
    const pad = 0.01;
    map.fitBounds(
      [
        [Math.min(...lats) - pad, Math.min(...lngs) - pad],
        [Math.max(...lats) + pad, Math.max(...lngs) + pad],
      ],
      { maxZoom: 14, padding: [24, 24] }
    );
  }, [map, events]);
  return null;
}

type DayJourney = {
  key: string;
  /** Events of one driver-day in logged order — markers + connecting line. */
  events: MapEvent[];
};

/** Group events into per-driver-per-day journeys, each sorted by time. */
function buildJourneys(events: MapEvent[]): DayJourney[] {
  const groups = new Map<string, MapEvent[]>();
  for (const ev of events) {
    const dayKey = ev.time.slice(0, 10);
    const key = `${ev.sheetId}|${ev.day_label ?? dayKey}`;
    const list = groups.get(key);
    if (list) list.push(ev);
    else groups.set(key, [ev]);
  }
  return [...groups.entries()].map(([key, list]) => ({
    key,
    events: [...list].sort((a, b) => a.time.localeCompare(b.time)),
  }));
}

export type ManagerEventMapProps = {
  events: MapEvent[];
  /** Show only events whose type is in this set (e.g. work, break, stop). */
  eventTypesFilter?: Set<string>;
  className?: string;
};

export function ManagerEventMap({
  events,
  eventTypesFilter,
  className = "",
}: ManagerEventMapProps) {
  const filtered = useMemo(() => {
    if (!eventTypesFilter) return events;
    if (eventTypesFilter.size === 0) return [];
    return events.filter((e) => eventTypesFilter.has(e.type));
  }, [events, eventTypesFilter]);

  const journeys = useMemo(() => buildJourneys(filtered), [filtered]);

  if (filtered.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 ${className}`}
        style={{ minHeight: 320 }}
      >
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">No events with location to show</p>
          <p className="text-xs text-slate-400">
            Try selecting <span className="font-semibold">All weeks</span> or <span className="font-semibold">All drivers</span>, or check that GPS is enabled on drivers&apos; devices.
          </p>
        </div>
      </div>
    );
  }

  const center: [number, number] = [
    filtered.reduce((a, e) => a + e.lat, 0) / filtered.length,
    filtered.reduce((a, e) => a + e.lng, 0) / filtered.length,
  ];

  return (
    <div className={`rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden ${className}`} style={{ minHeight: 320 }}>
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom
        className="h-[320px] w-full"
        style={{ minHeight: 320 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds events={filtered} />

        {/* Journey lines: connect one driver-day's events in logged order so the
            dots read as a run, not scattered points. */}
        {journeys.map((journey) =>
          journey.events.length >= 2 ? (
            <Polyline
              key={journey.key}
              positions={journey.events.map((ev) => [ev.lat, ev.lng])}
              pathOptions={{
                color: "#0f766e",
                weight: 2.5,
                opacity: 0.55,
                dashArray: "6 6",
              }}
            />
          ) : null
        )}

        {journeys.flatMap((journey) =>
          journey.events.map((ev, i) => {
            const meta = eventMeta(ev.type);
            return (
              <CircleMarker
                key={`${journey.key}-${ev.time}-${i}`}
                center={[ev.lat, ev.lng]}
                radius={meta.radius}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: meta.fillColor,
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              >
                <Popup>
                  {/* Leaflet popups are always white — keep text dark regardless of theme. */}
                  <div className="text-sm min-w-[200px]">
                    <p className="font-semibold text-slate-900">{ev.driver_name}</p>
                    <p className="font-medium" style={{ color: meta.color }}>
                      {meta.label}
                    </p>
                    <p className="text-slate-600">{formatEventTime(ev.time)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Stop {i + 1} of {journey.events.length} logged{" "}
                      {ev.day_label ? `on ${ev.day_label}` : "that day"} · Week of {ev.week_starting}
                    </p>
                    <a
                      href={`/sheets/${ev.sheetId}`}
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Open sheet →
                    </a>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })
        )}
      </MapContainer>
    </div>
  );
}
