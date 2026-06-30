import type { IncidentActivityEntry } from "@/lib/incident-activity-timeline";

type Props = {
  entries: IncidentActivityEntry[];
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

export function IncidentActivityTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-xs text-slate-500">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${entry.kind}-${index}`} className="flex gap-2 text-xs text-slate-400">
          <span className="shrink-0 font-mono text-slate-500">{formatWhen(entry.at)}</span>
          <span className="min-w-0">
            <span className="font-medium text-slate-200">{entry.label}</span>
            {entry.detail ? <span className="text-slate-500"> · {entry.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
