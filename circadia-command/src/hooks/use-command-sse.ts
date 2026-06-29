"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueueIncident } from "@/hooks/use-triage-queue";
import { maybePlayFatigueAlert } from "@/lib/fatigue-alert-audio";

type QueueCache = {
  queue_depth: number;
  incidents: QueueIncident[];
  pagination?: { next_cursor: string | null; has_more: boolean };
};

type FatigueAlertOptions = {
  onShift: boolean;
  muted: boolean;
  audioUnlocked: boolean;
};

export function useCommandSse(enabled: boolean, fatigueAlerts?: FatigueAlertOptions) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const lastEventIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fatigueAlertsRef = useRef(fatigueAlerts);
  fatigueAlertsRef.current = fatigueAlerts;

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const lastId = lastEventIdRef.current;
      const url = lastId
        ? `/api/v1/triage/stream?lastEventId=${encodeURIComponent(lastId)}`
        : "/api/v1/triage/stream";

      es = new EventSource(url);

      es.onopen = () => setConnected(true);

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
          void maybePlayFatigueAlert(data, alertOpts);
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

      es.addEventListener("INCIDENT_NEW", onNew);
      es.addEventListener("INCIDENT_CLAIMED", onRefresh);
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
