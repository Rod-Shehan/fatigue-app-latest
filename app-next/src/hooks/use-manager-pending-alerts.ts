"use client";

import { useEffect, useRef } from "react";
import type { CameraAlertItem } from "@/lib/api";
import { maybePlayManagerDeskAlert } from "@/lib/manager-desk-alarm-audio";

type AlertOptions = {
  onShift: boolean;
  hasActiveShift: boolean;
  muted: boolean;
  audioUnlocked: boolean;
};

/** Ring when pending alerts grow (30s poll). */
export function useManagerPendingAlerts(
  alerts: CameraAlertItem[],
  enabled: boolean,
  options: AlertOptions
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const seededRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    const pending = alerts.filter((a) => a.accepted && a.triageStatus === "pending");

    for (const alert of pending) {
      if (seenRef.current.has(alert.id)) continue;
      seenRef.current.add(alert.id);
      if (seededRef.current) {
        void maybePlayManagerDeskAlert(alert, optionsRef.current);
      }
    }

    seededRef.current = true;
  }, [alerts, enabled]);
}
