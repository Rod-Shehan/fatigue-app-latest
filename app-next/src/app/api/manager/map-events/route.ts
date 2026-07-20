import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeHistory1m, type History1mPoint } from "@/lib/geo-history-1m";
import { isGpsMovementTrailEnabled } from "@/lib/system-policy";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DayData = {
  day_label?: string;
  events?: Array<{
    time: string;
    type: string;
    lat?: number;
    lng?: number;
    accuracy?: number;
    history_1m?: History1mPoint[];
  }>;
};

function parseDays(daysJson: string): DayData[] {
  try {
    const parsed = JSON.parse(daysJson);
    return Array.isArray(parsed) ? (parsed as DayData[]) : [];
  } catch {
    return [];
  }
}

export type MapEvent = {
  lat: number;
  lng: number;
  type: string;
  time: string;
  driver_name: string;
  sheetId: string;
  week_starting: string;
  day_label?: string;
  accuracy?: number;
  history_1m?: History1mPoint[];
};

const MAX_EVENTS = 500;

/**
 * GET /api/manager/map-events
 * Query: weekStarting (optional), driverName (optional)
 * Returns geo events for sheets the manager can see. Manager-only.
 * Passes through optional history_1m movement-trail crumbs when stored on the diary event.
 */
export async function GET(request: NextRequest) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const trailEnabled = await isGpsMovementTrailEnabled();
    const { searchParams } = new URL(request.url);
    const weekStarting = searchParams.get("weekStarting") ?? undefined;
    const driverName = searchParams.get("driverName") ?? undefined;

    const sheets = await prisma.fatigueSheet.findMany({
      where: {
        ...(weekStarting && { weekStarting }),
        ...(driverName && { driverName: driverName }),
      },
      orderBy: [{ weekStarting: "desc" }, { createdAt: "desc" }],
      // Week-scoped map: no sheet cap; event count still limited below.
      ...(!weekStarting ? { take: 100 } : {}),
    });

    const events: MapEvent[] = [];
    for (const sheet of sheets) {
      const days = parseDays(sheet.days);
      const driver_name = sheet.driverName ?? "Unknown";
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const day_label = day.day_label ?? DAY_LABELS[i] ?? `Day ${i}`;
        for (const ev of day.events ?? []) {
          if (
            ev.lat != null &&
            ev.lng != null &&
            typeof ev.lat === "number" &&
            typeof ev.lng === "number"
          ) {
            const history_1m = trailEnabled ? normalizeHistory1m(ev.history_1m) : [];
            events.push({
              lat: ev.lat,
              lng: ev.lng,
              type: ev.type ?? "work",
              time: ev.time,
              driver_name,
              sheetId: sheet.id,
              week_starting: sheet.weekStarting,
              day_label,
              accuracy: ev.accuracy,
              ...(history_1m.length > 0 ? { history_1m } : {}),
            });
            if (events.length >= MAX_EVENTS) break;
          }
        }
        if (events.length >= MAX_EVENTS) break;
      }
      if (events.length >= MAX_EVENTS) break;
    }

    return NextResponse.json({ events, gpsMovementTrailEnabled: trailEnabled });
  } catch (e) {
    console.error("Manager map-events error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
