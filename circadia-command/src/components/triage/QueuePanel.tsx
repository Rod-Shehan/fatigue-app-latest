import type { QueueIncident } from "@/hooks/use-triage-queue";
import { cn } from "@/lib/utils";
import {
  commandCard,
  commandQueueItem,
  commandQueueItemSelected,
  commandTextMuted,
  commandTextPrimary,
} from "@/components/command/command-styles";

type Props = {
  incidents: QueueIncident[];
  selectedId: string | null;
  lockedId?: string | null;
  onSelect: (id: string) => void;
  /** Mobile stack: hide the open incident from the list below. */
  hideSelected?: boolean;
};

export function QueuePanel({ incidents, selectedId, lockedId, onSelect, hideSelected }: Props) {
  const visibleIncidents =
    hideSelected && selectedId
      ? incidents.filter((inc) => inc.lifecycle_id !== selectedId)
      : incidents;

  if (incidents.length === 0) {
    return (
      <div
        className={`flex h-full flex-col items-center justify-center p-6 text-center ${commandCard} border-emerald-300 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20`}
      >
        <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">ALL ASSETS CLEAR</p>
        <p className={cn("mt-2 text-sm", commandTextMuted)}>
          Zero pending fatigue alerts across the fleet perimeter.
        </p>
      </div>
    );
  }

  if (hideSelected && visibleIncidents.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center lg:hidden dark:border-slate-800/80 dark:bg-slate-900/40 ${commandCard}`}>
        <p className={cn("text-sm", commandTextMuted)}>No other pending incidents</p>
      </div>
    );
  }

  return (
    <ul className="flex h-full flex-col gap-2 overflow-y-auto lg:max-h-none">
      {visibleIncidents.map((inc) => (
        <li key={inc.lifecycle_id}>
          <button
            type="button"
            disabled={Boolean(lockedId && lockedId !== inc.lifecycle_id)}
            onClick={() => onSelect(inc.lifecycle_id)}
            className={cn(
              commandQueueItem,
              selectedId === inc.lifecycle_id && commandQueueItemSelected
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn("font-mono text-sm font-semibold", commandTextPrimary)}>
                {inc.vehicle_registration}
              </span>
              <span className="rounded-md bg-teal-100 px-2 py-0.5 text-xs font-medium uppercase text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                {inc.fatigue_metric_type}
              </span>
            </div>
            <p className={cn("mt-1 text-xs", commandTextMuted)}>
              {(inc.confidence_score * 100).toFixed(0)}% · {new Date(inc.detected_at).toLocaleTimeString()}
            </p>
            {inc.claimed_by_label ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/90">
                Claimed by {inc.claimed_by_label}
                {inc.claimed_at ? ` · ${new Date(inc.claimed_at).toLocaleTimeString()}` : ""}
              </p>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
