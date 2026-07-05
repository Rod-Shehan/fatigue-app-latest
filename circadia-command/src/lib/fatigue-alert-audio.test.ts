import { describe, expect, it } from "vitest";
import {
  isFatigueAlertCatchUpIncident,
  isFatigueMetricType,
  isTriageAlertMetricType,
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
    claimed_by_actor_type: null,
    claimed_by_label: null,
    claimed_at: null,
    ...overrides,
  };
}

const alertOpts = {
  onShift: true,
  hasActiveShift: true,
  muted: false,
};

describe("fatigue-alert-audio", () => {
  it("recognises fatigue metric type", () => {
    expect(isFatigueMetricType("FATIGUE")).toBe(true);
    expect(isFatigueMetricType("Fatigue")).toBe(true);
    expect(isFatigueMetricType("DISTRACTION")).toBe(false);
  });

  it("rings for any triage metric type", () => {
    expect(isTriageAlertMetricType("FATIGUE")).toBe(true);
    expect(isTriageAlertMetricType("DISTRACTION")).toBe(true);
    expect(isTriageAlertMetricType("LANE_DEPARTURE")).toBe(true);
    expect(isTriageAlertMetricType("")).toBe(false);
  });

  it("skips stale incidents on SSE catch-up", () => {
    const old = incident({
      detected_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    });
    expect(isFatigueAlertCatchUpIncident(old)).toBe(false);
    expect(isFatigueAlertCatchUpIncident(incident())).toBe(true);
  });

  it("plays on shift for fatigue and distraction events", () => {
    const fatigue = incident();
    const distraction = incident({ fatigue_metric_type: "DISTRACTION", lifecycle_id: "lc-2" });

    expect(shouldPlayFatigueAlert(fatigue, alertOpts)).toBe(true);
    expect(shouldPlayFatigueAlert(distraction, alertOpts)).toBe(true);

    expect(shouldPlayFatigueAlert(fatigue, { ...alertOpts, onShift: false })).toBe(false);

    expect(
      shouldPlayFatigueAlert(fatigue, {
        ...alertOpts,
        onShift: false,
        hasActiveShift: false,
      })
    ).toBe(true);

    expect(shouldPlayFatigueAlert(fatigue, { ...alertOpts, muted: true })).toBe(false);
  });
});
