import { commandCard, commandOutlineButton } from "@/components/command/command-styles";
import { ResolutionForm } from "@/components/triage/ResolutionForm";
import type { IncidentResolutionActionType } from "@/lib/triage-resolution";

type Props = {
  selectedId: string | null;
  busy: boolean;
  triageDeskOnShift: boolean;
  resolutionMode: boolean;
  resolutionError: string | null;
  onDismiss: () => void;
  onBeginResolution: () => void;
  onResolve: (actionType: IncidentResolutionActionType, resolutionNotes: string) => void;
  onCancelResolution: () => void;
  onSimulate: () => void;
};

export function ActionPanel({
  selectedId,
  busy,
  triageDeskOnShift,
  resolutionMode,
  resolutionError,
  onDismiss,
  onBeginResolution,
  onResolve,
  onCancelResolution,
  onSimulate,
}: Props) {
  const actionsDisabled = !triageDeskOnShift || !selectedId || busy;

  if (resolutionMode) {
    return (
      <div
        className={`flex h-full min-h-0 flex-col overflow-y-auto p-4 ${commandCard} ring-2 ring-teal-500/40`}
      >
        <ResolutionForm
          busy={busy}
          error={resolutionError}
          onSubmit={onResolve}
          onCancel={onCancelResolution}
        />
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 ${commandCard}`}>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Actions</h3>
        <p className="mt-1 text-xs text-slate-500">
          {triageDeskOnShift ? "F1 dismiss · F2 verified fatigue" : "View only — not on triage shift"}
        </p>
      </div>

      <button
        type="button"
        disabled={actionsDisabled}
        onClick={onDismiss}
        className={`${commandOutlineButton} w-full px-4 py-3 disabled:opacity-40`}
      >
        F1 — False positive
      </button>
      <button
        type="button"
        disabled={actionsDisabled}
        onClick={onBeginResolution}
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
