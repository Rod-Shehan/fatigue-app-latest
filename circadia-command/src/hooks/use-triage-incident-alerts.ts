"use client";

import { useEffect, useRef } from "react";
import type { QueueIncident } from "@/hooks/use-triage-queue";
import { getFatigueAlertsArmedAt, maybePlayFatigueAlert } from "@/lib/fatigue-alert-audio";

type AlertOptions = {
  onShift: boolean;
  hasActiveShift: boolean;
  muted: boolean;
};

/** Poll fallback: ring when the queue grows and SSE missed an event. */
export function useTriageIncidentAlerts(
  incidents: QueueIncident[],
  enabled: boolean,
  options: AlertOptions
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const seededRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const armedAtRef = useRef(getFatigueAlertsArmedAt());

  useEffect(() => {
    armedAtRef.current = getFatigueAlertsArmedAt();
  });

  useEffect(() => {
    if (!enabled) return;

    for (const incident of incidents) {
      if (seenRef.current.has(incident.lifecycle_id)) continue;

      const detectedMs = Date.parse(incident.detected_at);
      const arrivedAfterArm =
        Number.isFinite(detectedMs) && detectedMs >= armedAtRef.current - 3_000;
      const shouldRing = seededRef.current || arrivedAfterArm;

      seenRef.current.add(incident.lifecycle_id);
      if (shouldRing) {
        void maybePlayFatigueAlert(incident, optionsRef.current);
      }
    }

    seededRef.current = true;
  }, [incidents, enabled]);
}
