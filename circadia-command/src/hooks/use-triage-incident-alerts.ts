"use client";

import { useEffect, useRef } from "react";
import type { QueueIncident } from "@/hooks/use-triage-queue";
import { maybePlayFatigueAlert } from "@/lib/fatigue-alert-audio";

type AlertOptions = {
  onShift: boolean;
  hasActiveShift: boolean;
  muted: boolean;
  audioUnlocked: boolean;
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

  useEffect(() => {
    if (!enabled) return;

    for (const incident of incidents) {
      if (seenRef.current.has(incident.lifecycle_id)) continue;
      seenRef.current.add(incident.lifecycle_id);
      if (seededRef.current) {
        void maybePlayFatigueAlert(incident, optionsRef.current);
      }
    }

    seededRef.current = true;
  }, [incidents, enabled]);
}
