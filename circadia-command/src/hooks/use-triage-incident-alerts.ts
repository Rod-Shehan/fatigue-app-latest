"use client";

import { useEffect, useRef } from "react";
import type { QueueIncident } from "@/hooks/use-triage-queue";
import { maybePlayFatigueAlert } from "@/lib/fatigue-alert-audio";

type AlertOptions = {
  onShift: boolean;
  hasActiveShift: boolean;
  muted: boolean;
};

/** Poll fallback: ring when a new lifecycle id appears since the last poll baseline. */
export function useTriageIncidentAlerts(
  incidents: QueueIncident[],
  enabled: boolean,
  options: AlertOptions
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const baselineRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (!baselineRef.current) {
      baselineRef.current = new Set(incidents.map((i) => i.lifecycle_id));
      return;
    }

    for (const incident of incidents) {
      if (baselineRef.current.has(incident.lifecycle_id)) continue;
      baselineRef.current.add(incident.lifecycle_id);
      void maybePlayFatigueAlert(incident, {
        ...optionsRef.current,
        source: "poll",
      });
    }
  }, [incidents, enabled]);
}
