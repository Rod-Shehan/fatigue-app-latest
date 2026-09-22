"use client";

import { useMemo, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import type { MapEvent } from "@/lib/map-event-types";
import { appNextBaseUrl } from "@/lib/test-incident-client";
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

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function eventContext(ev: MapEvent, prev: MapEvent | undefined): string | null {
  if (!prev) {
    return ev.type === "work" ? "First log of the day" : null;
  }
  const mins = Math.round((Date.parse(ev.time) - Date.parse(prev.time)) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return null;
  const dur = formatDuration(mins);
  if (ev.type === "work" && prev.type === "break") return `Ended a ${dur} break`;
  if (ev.type === "work" && prev.type === "non_work") return `Back on duty after ${dur} off`;
  if (ev.type === "break" && prev.type === "work") return `After ${dur} of work`;
  if (ev.type === "non_work" && prev.type === "work") return `Off duty after ${dur} of work`;
  if (ev.type === "stop" && prev.type === "work") return `After a final ${dur} work leg`;
  return null;
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
  events: MapEvent[];
};

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

export type CommandEventMapProps = {
  events: MapEvent[];
  eventTypesFilter?: Set<string>;
  className?: string;
};

export function CommandEventMap({
  events,
  eventTypesFilter,
  className = "",
}: CommandEventMapProps) {
  const sheetBase = appNextBaseUrl();
  const filtered = useMemo(() => {
    if (!eventTypesFilter) return events;
    if (eventTypesFilter.size === 0) return [];
    return events.filter((e) => eventTypesFilter.has(e.type));
  }, [events, eventTypesFilter]);

  const journeys = useMemo(() => buildJourneys(events), [events]);

  if (filtered.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 ${className}`}
        style={{ minHeight: 420 }}
      >
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium">No events with location to show</p>
          <p className="text-xs text-slate-400">
            Try selecting All weeks or All drivers, or check that GPS is enabled on
            drivers&apos; devices.
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
    <div
      className={`overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 ${className}`}
      style={{ minHeight: 420 }}
    >
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom
        className="h-[420px] w-full md:h-[520px]"
        style={{ minHeight: 420 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds events={filtered} />

        {journeys.flatMap((journey) =>
          journey.events.map((ev, i) => {
            if (eventTypesFilter && !eventTypesFilter.has(ev.type)) return null;
            const meta = eventMeta(ev.type);
            const context = eventContext(ev, journey.events[i - 1]);
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
                  <div className="min-w-[200px] text-sm">
                    <p className="font-semibold text-slate-900">{ev.driver_name}</p>
                    <p className="font-medium" style={{ color: meta.color }}>
                      {meta.label}
                      {context ? (
                        <span className="font-normal text-slate-600">
                          {" "}
                          — {context.toLowerCase()}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-slate-600">{formatEventTime(ev.time)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Stop {i + 1} of {journey.events.length} logged{" "}
                      {ev.day_label ? `on ${ev.day_label}` : "that day"} · Week of{" "}
                      {ev.week_starting}
                    </p>
                    <a
                      href={`${sheetBase}/sheets/${ev.sheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-blue-600 hover:underline"
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
