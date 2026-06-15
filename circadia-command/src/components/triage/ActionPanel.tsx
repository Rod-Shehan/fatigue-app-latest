type Props = {
  selectedId: string | null;
  busy: boolean;
  onDismiss: () => void;
  onEscalate: () => void;
  onSimulate: () => void;
};

export function ActionPanel({ selectedId, busy, onDismiss, onEscalate, onSimulate }: Props) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-command-border bg-command-panel p-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Actions</h3>
        <p className="mt-1 text-xs text-slate-500">F1 dismiss · F2 escalate fatigue</p>
      </div>

      <button
        type="button"
        disabled={!selectedId || busy}
        onClick={onDismiss}
        className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
      >
        F1 — False positive
      </button>
      <button
        type="button"
        disabled={!selectedId || busy}
        onClick={onEscalate}
        className="rounded-lg border border-command-danger/50 bg-command-danger/20 px-4 py-3 text-sm font-medium text-red-200 hover:bg-command-danger/30 disabled:opacity-40"
      >
        F2 — Verified fatigue
      </button>

      <div className="mt-auto border-t border-command-border pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={onSimulate}
          className="w-full rounded border border-dashed border-slate-600 px-3 py-2 text-xs text-slate-400 hover:border-slate-400"
        >
          Simulate edge ingest (dev)
        </button>
      </div>
    </div>
  );
}
