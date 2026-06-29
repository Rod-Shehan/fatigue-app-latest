import { describe, expect, it } from "vitest";
import {
  isFatigueAlertCatchUpIncident,
  isFatigueMetricType,
  shouldPlayFatigueAlert,
} from "@/lib/fatigue-alert-audio";
import type { QueueIncident } from "@/hooks/use-triage-queue";

function incident(overrides: Partial<QueueIncident> = {}): QueueIncident {
  return {
    lifecycle_id: "lc-1",
    event_id: "ev-1",
    vehicle_registration: "1ABC123",
    fatigue_metric_type: "FATIGUE",
    confidence_score: 0.9,
    detected_at: new Date().toISOString(),
    video_snippet_url: "https://example.com/clip.mp4",
    lock_holder_id: null,
    ...overrides,
  };
}

describe("fatigue-alert-audio", () => {
  it("recognises fatigue metric type only", () => {
    expect(isFatigueMetricType("FATIGUE")).toBe(true);
    expect(isFatigueMetricType("Fatigue")).toBe(true);
    expect(isFatigueMetricType("DISTRACTION")).toBe(false);
    expect(isFatigueMetricType("LANE_DEPARTURE")).toBe(false);
  });

  it("skips stale incidents on SSE catch-up", () => {
    const old = incident({
      detected_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    });
    expect(isFatigueAlertCatchUpIncident(old)).toBe(false);
    expect(isFatigueAlertCatchUpIncident(incident())).toBe(true);
  });

  it("plays only on shift for fatigue events", () => {
    const fatigue = incident();
    const distraction = incident({ fatigue_metric_type: "DISTRACTION", lifecycle_id: "lc-2" });

    expect(
      shouldPlayFatigueAlert(fatigue, {
        onShift: true,
        muted: false,
        audioUnlocked: true,
      })
    ).toBe(true);

    expect(
      shouldPlayFatigueAlert(fatigue, {
        onShift: false,
        muted: false,
        audioUnlocked: true,
      })
    ).toBe(false);

    expect(
      shouldPlayFatigueAlert(distraction, {
        onShift: true,
        muted: false,
        audioUnlocked: true,
      })
    ).toBe(false);

    expect(
      shouldPlayFatigueAlert(fatigue, {
        onShift: true,
        muted: true,
        audioUnlocked: true,
      })
    ).toBe(false);
  });
});
