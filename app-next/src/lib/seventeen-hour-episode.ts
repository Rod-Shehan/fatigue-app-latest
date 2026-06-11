/**
 * Solo 17h episode: work+break since the last ≥7h non-work anchor (rolling timeline).
 * End shift inside an active episode does not require a fresh 7h rest before resume.
 */

type EpisodeEvent = { time: string; type: string };

export const MINUTES_7H_NON_WORK = 7 * 60;
export const MINUTES_17H_WORK_BREAK = 17 * 60;
const LOOKBACK_MS = 72 * 60 * 60 * 1000;

type SegmentKind = "work" | "break" | "non_work";

type EpisodeSegment = { startMs: number; endMs: number; kind: SegmentKind };

export type SeventeenHourEpisodeStatus = {
  /** When work+break resumed after the last qualifying ≥7h non-work block. */
  anchorMs: number | null;
  workBreakMinutesSinceAnchor: number;
  workBreakMinutesRemaining: number;
  /** True when anchor exists and work+break since anchor is still under 17h. */
  withinSeventeenHourEpisode: boolean;
  /** Idle after End shift and still inside the active 17h episode — no 7h gate. */
  canResumeWithoutSevenHourRest: boolean;
};

function eventTimeMs(ev: { time: string }): number {
  return new Date(ev.time).getTime();
}

function mergeAdjacentSameKind(segments: EpisodeSegment[]): EpisodeSegment[] {
  const out: EpisodeSegment[] = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (last && last.kind === seg.kind && last.endMs === seg.startMs) {
      last.endMs = seg.endMs;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

/** Build rolling work / break / non-work segments from the event timeline (no calendar boundaries). */
export function buildEpisodeSegmentsFromEvents(
  events: EpisodeEvent[],
  asOfMs: number,
  lookbackMs = LOOKBACK_MS
): EpisodeSegment[] {
  const windowStart = asOfMs - lookbackMs;
  const sorted = events
    .filter((e) => eventTimeMs(e) < asOfMs + 1)
    .sort((a, b) => eventTimeMs(a) - eventTimeMs(b));

  const segments: EpisodeSegment[] = [];
  let cursor = windowStart;

  const pushNonWork = (start: number, end: number) => {
    if (end <= start) return;
    const last = segments[segments.length - 1];
    if (last?.kind === "non_work" && last.endMs === start) {
      last.endMs = end;
    } else {
      segments.push({ startMs: start, endMs: end, kind: "non_work" });
    }
  };

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    const t = eventTimeMs(ev);

    if (t > cursor) {
      pushNonWork(cursor, t);
    }

    if (ev.type === "stop") {
      cursor = t;
      continue;
    }

    const nextT = i + 1 < sorted.length ? eventTimeMs(sorted[i + 1]) : asOfMs;
    const end = Math.min(nextT, asOfMs);

    if (ev.type === "work") {
      segments.push({ startMs: t, endMs: end, kind: "work" });
    } else if (ev.type === "break") {
      segments.push({ startMs: t, endMs: end, kind: "break" });
    } else if (ev.type === "non_work") {
      pushNonWork(t, end);
    }
    cursor = end;
  }

  if (cursor < asOfMs) {
    pushNonWork(cursor, asOfMs);
  }

  return mergeAdjacentSameKind(segments);
}

export function getSeventeenHourEpisodeStatus(
  events: EpisodeEvent[],
  asOfMs: number
): SeventeenHourEpisodeStatus {
  const segments = buildEpisodeSegmentsFromEvents(events, asOfMs);

  let anchorMs: number | null = null;
  let nonWorkMinutes = 0;

  for (const seg of segments) {
    const mins = (seg.endMs - seg.startMs) / 60000;
    if (seg.kind === "non_work") {
      nonWorkMinutes += mins;
    } else {
      if (nonWorkMinutes >= MINUTES_7H_NON_WORK) {
        anchorMs = seg.startMs;
      }
      nonWorkMinutes = 0;
    }
  }

  let workBreakMinutesSinceAnchor = 0;
  if (anchorMs != null) {
    for (const seg of segments) {
      if (seg.endMs <= anchorMs) continue;
      if (seg.kind === "work" || seg.kind === "break") {
        const start = Math.max(seg.startMs, anchorMs);
        workBreakMinutesSinceAnchor += (seg.endMs - start) / 60000;
      }
    }
  }

  const used = Math.floor(workBreakMinutesSinceAnchor);
  const within = anchorMs != null && used < MINUTES_17H_WORK_BREAK;

  const sorted = events
    .filter((e) => eventTimeMs(e) < asOfMs + 1)
    .sort((a, b) => eventTimeMs(a) - eventTimeMs(b));
  const lastEv = sorted[sorted.length - 1];
  const canResume = within && lastEv?.type === "stop";

  return {
    anchorMs,
    workBreakMinutesSinceAnchor: used,
    workBreakMinutesRemaining: Math.max(0, MINUTES_17H_WORK_BREAK - used),
    withinSeventeenHourEpisode: within,
    canResumeWithoutSevenHourRest: canResume,
  };
}
