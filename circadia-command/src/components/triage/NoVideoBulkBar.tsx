import { commandOutlineButton, commandTextMuted } from "@/components/command/command-styles";
import { cn } from "@/lib/utils";

type Props = {
  noVideoCount: number;
  selectedCount: number;
  busy: boolean;
  error: string | null;
  onSelectAllNoVideo: () => void;
  onClear: () => void;
  onRemove: () => void;
};

export function NoVideoBulkBar({
  noVideoCount,
  selectedCount,
  busy,
  error,
  onSelectAllNoVideo,
  onClear,
  onRemove,
}: Props) {
  if (noVideoCount === 0 && selectedCount === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={commandOutlineButton}
          disabled={noVideoCount === 0 || busy}
          onClick={onSelectAllNoVideo}
        >
          Select all without video ({noVideoCount})
        </button>
        <button type="button" className={commandOutlineButton} disabled={selectedCount === 0 || busy} onClick={onClear}>
          Clear
        </button>
        <button
          type="button"
          disabled={selectedCount === 0 || busy}
          onClick={onRemove}
          className={cn(
            commandOutlineButton,
            "border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
          )}
        >
          {busy ? "Removing…" : `Remove selected (${selectedCount})`}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error}</p> : null}
      <p className={cn("mt-2 text-xs", commandTextMuted)}>
        Tick events with no clip. Events that have a video stay on the desk.
      </p>
    </div>
  );
}
