import type { IncidentActivityEntry } from "@/lib/incident-activity-timeline";
import { commandTextMuted, commandTextPrimary } from "@/components/command/command-styles";
import { cn } from "@/lib/utils";

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
    return <p className={cn("text-xs", commandTextMuted)}>No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${entry.kind}-${index}`} className={cn("flex gap-2 text-xs", commandTextMuted)}>
          <span className={cn("shrink-0 font-mono", commandTextMuted)}>{formatWhen(entry.at)}</span>
          <span className="min-w-0">
            <span className={cn("font-medium", commandTextPrimary)}>{entry.label}</span>
            {entry.detail ? <span className={cn(commandTextMuted)}> · {entry.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
