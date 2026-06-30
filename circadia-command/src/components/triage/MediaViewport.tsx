"use client";

import { useQuery } from "@tanstack/react-query";
import type { QueueIncident } from "@/hooks/use-triage-queue";
import { IncidentActivityTimeline } from "@/components/triage/IncidentActivityTimeline";
import { commandCard } from "@/components/command/command-styles";

type Props = {
  incident: QueueIncident | null;
  locked?: boolean;
};

export function MediaViewport({ incident, locked }: Props) {
  const activityQuery = useQuery({
    queryKey: ["triage", "activity", incident?.lifecycle_id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/triage/incidents/${incident!.lifecycle_id}/activity`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed to load activity");
      return (await res.json()) as {
        entries: import("@/lib/incident-activity-timeline").IncidentActivityEntry[];
      };
    },
    enabled: Boolean(incident?.lifecycle_id),
    staleTime: 15_000,
  });

  if (!incident) {
    return (
      <div className={`flex h-full items-center justify-center text-slate-500 ${commandCard} p-6`}>
        Select an incident from the queue
      </div>
    );
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden p-4 ${commandCard} ${locked ? "ring-2 ring-teal-500/50" : ""}`}
    >
      {locked ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-teal-300">
          Locked — complete resolution to continue
        </p>
      ) : null}
      {incident.claimed_by_label ? (
        <p className="mb-2 text-xs text-amber-300/90">
          Claimed by {incident.claimed_by_label}
          {incident.claimed_at
            ? ` · ${new Date(incident.claimed_at).toLocaleTimeString()}`
            : ""}
        </p>
      ) : null}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-lg text-slate-100">{incident.vehicle_registration}</h2>
        <span className="rounded-md bg-teal-950/60 px-2 py-1 text-xs font-medium uppercase text-teal-300">
          {incident.fatigue_metric_type}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-700/80 bg-black/40 p-4">
          {incident.video_snippet_url && !incident.video_snippet_url.startsWith("pending://") ? (
            <video
              key={incident.lifecycle_id}
              src={incident.video_snippet_url}
              className="max-h-[min(40vh,24rem)] w-full rounded object-contain"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : incident.video_snippet_url?.startsWith("pending://") ? (
            <p className="text-sm text-amber-300/90">Clip syncing from Autonomise…</p>
          ) : (
            <p className="text-sm text-slate-500">No video snippet</p>
          )}
          <p className="mt-3 text-xs text-slate-400">
            3s loop · confidence {(incident.confidence_score * 100).toFixed(0)}%
          </p>
        </div>
        <div className="shrink-0 rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Activity
          </p>
          {activityQuery.isLoading ? (
            <p className="text-xs text-slate-500">Loading timeline…</p>
          ) : (
            <IncidentActivityTimeline entries={activityQuery.data?.entries ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}
