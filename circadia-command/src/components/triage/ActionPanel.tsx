import { commandCard, commandOutlineButton } from "@/components/command/command-styles";

type Props = {
  selectedId: string | null;
  busy: boolean;
  onDismiss: () => void;
  onEscalate: () => void;
  onSimulate: () => void;
};

export function ActionPanel({ selectedId, busy, onDismiss, onEscalate, onSimulate }: Props) {
  return (
    <div className={`flex h-full flex-col gap-4 p-4 ${commandCard}`}>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Actions</h3>
        <p className="mt-1 text-xs text-slate-500">F1 dismiss · F2 escalate fatigue</p>
      </div>

      <button
        type="button"
        disabled={!selectedId || busy}
        onClick={onDismiss}
        className={`${commandOutlineButton} w-full px-4 py-3 disabled:opacity-40`}
      >
        F1 — False positive
      </button>
      <button
        type="button"
        disabled={!selectedId || busy}
        onClick={onEscalate}
        className="w-full rounded-lg border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-200 transition-colors hover:bg-red-950/60 disabled:opacity-40"
      >
        F2 — Verified fatigue
      </button>

      <div className="mt-auto border-t border-slate-700/80 pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={onSimulate}
          className="w-full rounded-lg border border-dashed border-slate-600 px-3 py-2 text-xs text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-300"
        >
          Simulate edge ingest (dev)
        </button>
      </div>
    </div>
  );
}
