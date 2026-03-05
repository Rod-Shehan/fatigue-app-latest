"use client";

import { useMemo, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import type { MapEvent } from "@/lib/api";
import "leaflet/dist/leaflet.css";

const EVENT_COLORS: Record<string, { color: string; fillColor: string }> = {
  work: { color: "#2563eb", fillColor: "#3b82f6" },
  break: { color: "#d97706", fillColor: "#f59e0b" },
  stop: { color: "#dc2626", fillColor: "#ef4444" },
};

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
        {filtered.map((ev, i) => {
          const style = EVENT_COLORS[ev.type] ?? EVENT_COLORS.work;
          return (
            <CircleMarker
              key={`${ev.sheetId}-${ev.time}-${i}`}
              center={[ev.lat, ev.lng]}
              radius={8}
              pathOptions={{
                color: style.color,
                fillColor: style.fillColor,
                fillOpacity: 0.8,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm min-w-[180px]">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {ev.driver_name}
                  </p>
                  <p className="capitalize text-slate-600 dark:text-slate-300">
                    {ev.type}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {formatEventTime(ev.time)}
                  </p>
                  {ev.day_label && (
                    <p className="text-xs text-slate-400">
                      {ev.day_label} · Week of {ev.week_starting}
                    </p>
                  )}
                  <a
                    href={`/sheets/${ev.sheetId}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                  >
                    Open sheet →
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
