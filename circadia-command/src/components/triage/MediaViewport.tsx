import type { QueueIncident } from "@/hooks/use-triage-queue";

type Props = {
  incident: QueueIncident | null;
};

export function MediaViewport({ incident }: Props) {
  if (!incident) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-command-border bg-command-panel text-slate-500">
        Select an incident from the queue
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-command-border bg-command-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-lg">{incident.vehicle_registration}</h2>
        <span className="rounded bg-command-amber/20 px-2 py-1 text-xs text-command-amber">
          {incident.fatigue_metric_type}
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center rounded border border-dashed border-command-border bg-black/40 p-4">
        {incident.video_snippet_url && !incident.video_snippet_url.startsWith("pending://") ? (
          <video
            key={incident.lifecycle_id}
            src={incident.video_snippet_url}
            className="max-h-48 w-full rounded object-contain"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <p className="text-sm text-slate-500">No video snippet</p>
        )}
        <p className="mt-3 text-xs text-slate-400">3s loop · confidence {(incident.confidence_score * 100).toFixed(0)}%</p>
      </div>
    </div>
  );
}
