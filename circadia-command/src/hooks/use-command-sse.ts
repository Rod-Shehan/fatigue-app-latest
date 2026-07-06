"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueueIncident } from "@/hooks/use-triage-queue";
import type { FatigueAlertRingSource } from "@/lib/fatigue-alert-audio";
import { maybePlayFatigueAlert } from "@/lib/fatigue-alert-audio";

type QueueCache = {
  queue_depth: number;
  incidents: QueueIncident[];
  pagination?: { next_cursor: string | null; has_more: boolean };
};

type FatigueAlertOptions = {
  onShift: boolean;
  hasActiveShift: boolean;
  muted: boolean;
};

export function useCommandSse(enabled: boolean, fatigueAlerts?: FatigueAlertOptions) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const lastEventIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fatigueAlertsRef = useRef(fatigueAlerts);
  const baselineAtConnectRef = useRef<Set<string>>(new Set());
  const isReconnectRef = useRef(false);
  fatigueAlertsRef.current = fatigueAlerts;

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let cancelled = false;

    const snapshotBaseline = () => {
      const cache = queryClient.getQueryData<QueueCache>(["triage", "live-queue"]);
      baselineAtConnectRef.current = new Set(cache?.incidents.map((i) => i.lifecycle_id) ?? []);
    };

    const ringSourceForIncident = (lifecycleId: string): FatigueAlertRingSource => {
      if (baselineAtConnectRef.current.has(lifecycleId)) {
        return "sse-replay";
      }
      return isReconnectRef.current ? "sse-replay" : "sse-live";
    };

    const connect = () => {
      if (cancelled) return;

      const hadPriorConnection = lastEventIdRef.current != null;
      isReconnectRef.current = hadPriorConnection;
      snapshotBaseline();

      const lastId = lastEventIdRef.current;
      const url = lastId
        ? `/api/v1/triage/stream?lastEventId=${encodeURIComponent(lastId)}`
        : "/api/v1/triage/stream";

      es = new EventSource(url);

      es.onopen = () => {
        setConnected(true);
        isReconnectRef.current = false;
      };

      es.onerror = () => {
        setConnected(false);
        es?.close();
        es = null;
        if (!cancelled) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };

      const rememberId = (event: MessageEvent) => {
        if (event.lastEventId) lastEventIdRef.current = event.lastEventId;
      };

      const onNew = (event: MessageEvent) => {
        rememberId(event);
        const data = JSON.parse(event.data) as QueueIncident;
        const alertOpts = fatigueAlertsRef.current;
        if (alertOpts) {
          void maybePlayFatigueAlert(data, {
            ...alertOpts,
            source: ringSourceForIncident(data.lifecycle_id),
          });
        }
        queryClient.setQueryData<QueueCache>(["triage", "live-queue"], (old) => {
          if (!old) {
            return { queue_depth: 1, incidents: [data], pagination: { next_cursor: null, has_more: false } };
          }
          if (old.incidents.some((i) => i.lifecycle_id === data.lifecycle_id)) return old;
          return {
            ...old,
            queue_depth: old.queue_depth + 1,
            incidents: [data, ...old.incidents],
          };
        });
      };

      const onRefresh = (event: MessageEvent) => {
        rememberId(event);
        void queryClient.invalidateQueries({ queryKey: ["triage", "live-queue"] });
      };

      const onClaimReleased = (event: MessageEvent) => {
        rememberId(event);
        void queryClient.invalidateQueries({ queryKey: ["triage", "live-queue"] });
      };

      const onClosed = (event: MessageEvent) => {
        rememberId(event);
        const data = JSON.parse(event.data) as { lifecycle_id: string };
        queryClient.setQueryData<QueueCache>(["triage", "live-queue"], (old) => {
          if (!old) {
            void queryClient.invalidateQueries({ queryKey: ["triage", "live-queue"] });
            return old;
          }
          const remaining = old.incidents.filter((i) => i.lifecycle_id !== data.lifecycle_id);
          if (remaining.length === old.incidents.length) {
            void queryClient.invalidateQueries({ queryKey: ["triage", "live-queue"] });
            return old;
          }
          return {
            ...old,
            queue_depth: Math.max(0, old.queue_depth - 1),
            incidents: remaining,
          };
        });
      };

      es.addEventListener("INCIDENT_NEW", onNew);
      es.addEventListener("INCIDENT_CLAIMED", onRefresh);
      es.addEventListener("INCIDENT_CLAIM_RELEASED", onClaimReleased);
      es.addEventListener("INCIDENT_CLOSED", onClosed);
      es.addEventListener("DRIVER_RESPONSE", onRefresh);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      es?.close();
      setConnected(false);
    };
  }, [enabled, queryClient]);

  return { connected };
}
