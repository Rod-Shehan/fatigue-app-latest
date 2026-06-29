import type { QueueIncident } from "@/hooks/use-triage-queue";
import { commandCard } from "@/components/command/command-styles";

type Props = {
  incident: QueueIncident | null;
  locked?: boolean;
};

export function MediaViewport({ incident, locked }: Props) {
  if (!incident) {
    return (
      <div className={`flex h-full items-center justify-center text-slate-500 ${commandCard} p-6`}>
        Select an incident from the queue
      </div>
    );
  }

  return (
    <div
      className={`flex h-full flex-col p-4 ${commandCard} ${locked ? "ring-2 ring-teal-500/50" : ""}`}
    >
      {locked ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-teal-300">
          Locked — complete resolution to continue
        </p>
      ) : null}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-lg text-slate-100">{incident.vehicle_registration}</h2>
        <span className="rounded-md bg-teal-950/60 px-2 py-1 text-xs font-medium uppercase text-teal-300">
          {incident.fatigue_metric_type}
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-700/80 bg-black/40 p-4">
        {incident.video_snippet_url && !incident.video_snippet_url.startsWith("pending://") ? (
          <video
            key={incident.lifecycle_id}
            src={incident.video_snippet_url}
            className="max-h-[min(48vh,28rem)] w-full rounded object-contain"
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
    </div>
  );
}
