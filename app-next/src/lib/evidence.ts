import { haversineDistanceKm } from "@/lib/geo";

export type EvidenceEvent = {
  time: string;
  type: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
};

export type EvidenceDay = {
  events?: EvidenceEvent[];
  start_kms?: number | null;
  end_kms?: number | null;
};

export type MovementClass = "stationary" | "moving" | "unknown";

export type MovementInterval = {
  startTime: string;
  endTime: string;
  minutes: number;
  distanceKm?: number;
  avgSpeedKph?: number;
  movement: MovementClass;
  reason: string;
};

export type EvidenceSummary = {
  totalEvents: number;
  gpsEvents: number;
  gpsCoveragePct: number;

  gpsKm: number | null;
  odometerKm: number | null;
  gpsOdometerRatio: number | null;

  intervalMinutesClassified: { stationary: number; moving: number; unknown: number };
  movingDuringRestCount: number;
  movingDuringRestExamples: Array<{ startTime: string; endTime: string; minutes: number; distanceKm: number }>;

  flags: Array<{ severity: "info" | "warning"; code: string; message: string }>;
};

const GPS_ACCURACY_MAX_M = 500;
const MIN_INTERVAL_MIN = 1;
const MOVING_MIN_KPH = 5; // below this is treated as stationary drift
const STATIONARY_MAX_KM_PER_MIN = 0.02; // ~1.2km/h drift ceiling when accurate

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function fmt1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function classifyMovementIntervals(events: EvidenceEvent[]): MovementInterval[] {
  const e = [...events].sort((a, b) => toMs(a.time) - toMs(b.time));
  const out: MovementInterval[] = [];
  for (let i = 0; i < e.length - 1; i++) {
    const a = e[i];
    const b = e[i + 1];
    const dtMin = Math.floor((toMs(b.time) - toMs(a.time)) / 60000);
    if (dtMin < MIN_INTERVAL_MIN) continue;

    const aOk =
      a.lat != null &&
      a.lng != null &&
      (a.accuracy == null || a.accuracy <= GPS_ACCURACY_MAX_M);
    const bOk =
      b.lat != null &&
      b.lng != null &&
      (b.accuracy == null || b.accuracy <= GPS_ACCURACY_MAX_M);

    if (!aOk || !bOk) {
      out.push({
        startTime: a.time,
        endTime: b.time,
        minutes: dtMin,
        movement: "unknown",
        reason: "Missing/low-quality GPS",
      });
      continue;
    }

    const dKm = haversineDistanceKm(a.lat!, a.lng!, b.lat!, b.lng!);
    const speedKph = (dKm / dtMin) * 60;
    const movement: MovementClass =
      speedKph >= MOVING_MIN_KPH
        ? "moving"
        : dKm / dtMin <= STATIONARY_MAX_KM_PER_MIN
          ? "stationary"
          : "unknown";

    out.push({
      startTime: a.time,
      endTime: b.time,
      minutes: dtMin,
      distanceKm: dKm,
      avgSpeedKph: speedKph,
      movement,
      reason:
        movement === "moving"
          ? `Avg speed ${fmt1(speedKph)} km/h`
          : movement === "stationary"
            ? `Low movement (${fmt1(dKm)} km / ${dtMin} min)`
            : "Ambiguous drift",
    });
  }
  return out;
}

function sumGpsKmFromIntervals(intervals: MovementInterval[]): number | null {
  const d = intervals.reduce((s, x) => s + (x.distanceKm ?? 0), 0);
  return d > 0 ? d : null;
}

function sumOdometerKm(days: EvidenceDay[]): number | null {
  let total = 0;
  let any = false;
  for (const d of days) {
    const a = d.start_kms;
    const b = d.end_kms;
    if (typeof a !== "number" || typeof b !== "number") continue;
    if (b < a) continue;
    total += b - a;
    any = true;
  }
  return any ? total : null;
}

export function computeEvidenceSummary(days: EvidenceDay[]): EvidenceSummary {
  const events: EvidenceEvent[] = days.flatMap((d) => d.events ?? []);
  const totalEvents = events.length;
  const gpsEvents = events.filter((e) => e.lat != null && e.lng != null).length;
  const gpsCoveragePct = totalEvents > 0 ? Math.round((gpsEvents / totalEvents) * 100) : 0;

  const intervals = classifyMovementIntervals(events);
  const gpsKm = sumGpsKmFromIntervals(intervals);
  const odometerKm = sumOdometerKm(days);
  const gpsOdometerRatio =
    gpsKm != null && odometerKm != null && odometerKm > 0 ? gpsKm / odometerKm : null;

  const intervalMinutesClassified = intervals.reduce(
    (acc, x) => {
      acc[x.movement] += x.minutes;
      return acc;
    },
    { stationary: 0, moving: 0, unknown: 0 } as { stationary: number; moving: number; unknown: number }
  );

  // “Moving during rest”: any break/stop event followed by next work where the interval looks “moving”.
  const ordered = [...events].sort((a, b) => toMs(a.time) - toMs(b.time));
  const movingDuringRestExamples: EvidenceSummary["movingDuringRestExamples"] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    if (!(a.type === "break" || a.type === "stop" || a.type === "non_work")) continue;
    if (b.type !== "work") continue;
    const interval = classifyMovementIntervals([a, b])[0];
    if (!interval || interval.movement !== "moving" || interval.distanceKm == null) continue;
    if (interval.minutes < 10) continue;
    movingDuringRestExamples.push({
      startTime: interval.startTime,
      endTime: interval.endTime,
      minutes: interval.minutes,
      distanceKm: interval.distanceKm,
    });
  }

  const flags: EvidenceSummary["flags"] = [];
  if (totalEvents > 0 && gpsCoveragePct < 50) {
    flags.push({
      severity: "warning",
      code: "gps_low_coverage",
      message: `Low GPS evidence coverage (${gpsEvents}/${totalEvents} events with location).`,
    });
  }
  if (gpsOdometerRatio != null && (gpsOdometerRatio < 0.3 || gpsOdometerRatio > 3.3)) {
    flags.push({
      severity: "warning",
      code: "odometer_gps_mismatch",
      message: `Recorded km may not match GPS path (GPS/odo ratio ~${fmt1(gpsOdometerRatio)}).`,
    });
  }
  if (movingDuringRestExamples.length > 0) {
    flags.push({
      severity: "warning",
      code: "moving_during_rest",
      message: `Possible vehicle movement during rest (${movingDuringRestExamples.length} intervals).`,
    });
  }

  return {
    totalEvents,
    gpsEvents,
    gpsCoveragePct,
    gpsKm: gpsKm != null ? Math.round(gpsKm) : null,
    odometerKm: odometerKm != null ? Math.round(odometerKm) : null,
    gpsOdometerRatio,
    intervalMinutesClassified,
    movingDuringRestCount: movingDuringRestExamples.length,
    movingDuringRestExamples: movingDuringRestExamples.slice(0, 3).map((x) => ({
      ...x,
      distanceKm: Math.round(x.distanceKm * 10) / 10,
    })),
    flags,
  };
}

