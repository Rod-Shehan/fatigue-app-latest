import type { QueueIncident } from "@/hooks/use-triage-queue";
import { cn } from "@/lib/utils";

type Props = {
  incidents: QueueIncident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function QueuePanel({ incidents, selectedId, onSelect }: Props) {
  if (incidents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-command-safe/40 bg-command-safe/10 p-6 text-center">
        <p className="text-lg font-semibold text-command-safe">ALL ASSETS CLEAR</p>
        <p className="mt-2 text-sm text-slate-400">Zero pending fatigue alerts across the fleet perimeter.</p>
      </div>
    );
  }

  return (
    <ul className="flex h-full flex-col gap-2 overflow-y-auto">
      {incidents.map((inc) => (
        <li key={inc.lifecycle_id}>
          <button
            type="button"
            onClick={() => onSelect(inc.lifecycle_id)}
            className={cn(
              "w-full rounded-lg border px-3 py-3 text-left transition",
              selectedId === inc.lifecycle_id
                ? "border-command-amber bg-command-amber/10"
                : "border-command-border bg-command-panel hover:border-slate-500"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-semibold">{inc.vehicle_registration}</span>
              <span className="text-xs uppercase text-command-amber">{inc.fatigue_metric_type}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {(inc.confidence_score * 100).toFixed(0)}% · {new Date(inc.detected_at).toLocaleTimeString()}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
