"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export type QueueIncident = {
  lifecycle_id: string;
  event_id: string;
  vehicle_registration: string;
  fatigue_metric_type: string;
  confidence_score: number;
  detected_at: string;
  video_snippet_url: string;
  lock_holder_id: string | null;
};

type QueueResponse = {
  queue_depth: number;
  incidents: QueueIncident[];
  pagination: { next_cursor: string | null; has_more: boolean };
};

async function fetchQueue(): Promise<QueueResponse> {
  const res = await fetch("/api/v1/triage/queue?limit=50", { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Failed to load triage queue");
  }
  return res.json();
}

export function useTriageQueue(enabled = true, sseConnected = false) {
  return useQuery({
    queryKey: ["triage", "live-queue"],
    queryFn: fetchQueue,
    enabled,
    refetchInterval: enabled && !sseConnected ? 5000 : false,
    staleTime: sseConnected ? Infinity : 2000,
    retry: (count, err) => count < 2 && !(err instanceof Error && err.message.includes("session")),
  });
}

export function useInvalidateTriageQueue() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["triage", "live-queue"] });
}
