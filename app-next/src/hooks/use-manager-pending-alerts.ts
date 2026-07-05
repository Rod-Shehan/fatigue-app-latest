"use client";

import { useEffect, useRef } from "react";
import type { CameraAlertItem } from "@/lib/api";
import {
  getManagerDeskAlertsArmedAt,
  maybePlayManagerDeskAlert,
} from "@/lib/manager-desk-alarm-audio";

type AlertOptions = {
  onShift: boolean;
  hasActiveShift: boolean;
  muted: boolean;
};

function alertTimestampMs(alert: CameraAlertItem): number {
  const iso = alert.triggerAt ?? alert.receivedAt;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

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
  const armedAtRef = useRef(getManagerDeskAlertsArmedAt());

  useEffect(() => {
    armedAtRef.current = getManagerDeskAlertsArmedAt();
  });

  useEffect(() => {
    if (!enabled) return;

    const pending = alerts.filter((a) => a.accepted && a.triageStatus === "pending");

    for (const alert of pending) {
      if (seenRef.current.has(alert.id)) continue;

      const alertMs = alertTimestampMs(alert);
      const arrivedAfterArm = alertMs >= armedAtRef.current - 3_000;
      const shouldRing = seededRef.current || arrivedAfterArm;

      seenRef.current.add(alert.id);
      if (shouldRing) {
        void maybePlayManagerDeskAlert(alert, optionsRef.current);
      }
    }

    seededRef.current = true;
  }, [alerts, enabled]);
}
