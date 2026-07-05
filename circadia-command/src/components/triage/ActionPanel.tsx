import { commandCard, commandOutlineButton, commandTextMuted } from "@/components/command/command-styles";
import { cn } from "@/lib/utils";
import { FalsePositiveDismissPanel } from "@/components/triage/FalsePositiveDismissPanel";
import { ResolutionForm } from "@/components/triage/ResolutionForm";
import { VerifiedDistractionCapturePanel } from "@/components/triage/VerifiedDistractionCapturePanel";
import type { FalsePositiveReasonId } from "@/lib/false-positive-reasons";
import type { IncidentResolutionActionType } from "@/lib/triage-resolution";
import type { VerifiedDistractionReasonId } from "@/lib/verified-distraction-reasons";

type Props = {
  selectedId: string | null;
  busy: boolean;
  triageDeskOnShift: boolean;
  resolutionMode: boolean;
  dismissCaptureMode: boolean;
  distractionCaptureMode: boolean;
  dismissNote: string;
  dismissReasons: FalsePositiveReasonId[];
  dismissError: string | null;
  distractionNote: string;
  distractionReasons: VerifiedDistractionReasonId[];
  distractionError: string | null;
  resolutionError: string | null;
  onBeginDismissCapture: () => void;
  onDismissNoteChange: (value: string) => void;
  onDismissReasonsChange: (next: FalsePositiveReasonId[]) => void;
  onConfirmDismiss: () => void;
  onCancelDismissCapture: () => void;
  onBeginDistractionCapture: () => void;
  onDistractionNoteChange: (value: string) => void;
  onDistractionReasonsChange: (next: VerifiedDistractionReasonId[]) => void;
  onConfirmDistraction: () => void;
  onCancelDistractionCapture: () => void;
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
  dismissCaptureMode,
  distractionCaptureMode,
  dismissNote,
  dismissReasons,
  dismissError,
  distractionNote,
  distractionReasons,
  distractionError,
  resolutionError,
  onBeginDismissCapture,
  onDismissNoteChange,
  onDismissReasonsChange,
  onConfirmDismiss,
  onCancelDismissCapture,
  onBeginDistractionCapture,
  onDistractionNoteChange,
  onDistractionReasonsChange,
  onConfirmDistraction,
  onCancelDistractionCapture,
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

  if (dismissCaptureMode) {
    return (
      <div className={`flex h-full min-h-0 flex-col overflow-y-auto p-4 ${commandCard} ring-2 ring-amber-500/30`}>
        <FalsePositiveDismissPanel
          note={dismissNote}
          onNoteChange={onDismissNoteChange}
          reasons={dismissReasons}
          onReasonsChange={onDismissReasonsChange}
          pending={busy}
          error={dismissError}
          onCancel={onCancelDismissCapture}
          onConfirm={onConfirmDismiss}
        />
      </div>
    );
  }

  if (distractionCaptureMode) {
    return (
      <div className={`flex h-full min-h-0 flex-col overflow-y-auto p-4 ${commandCard} ring-2 ring-violet-500/30`}>
        <VerifiedDistractionCapturePanel
          note={distractionNote}
          onNoteChange={onDistractionNoteChange}
          reasons={distractionReasons}
          onReasonsChange={onDistractionReasonsChange}
          pending={busy}
          error={distractionError}
          onCancel={onCancelDistractionCapture}
          onConfirm={onConfirmDistraction}
        />
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 ${commandCard}`}>
      <div>
        <h3 className={cn("text-sm font-semibold uppercase tracking-wide", commandTextMuted)}>Actions</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          {triageDeskOnShift
            ? "F1 false positive · F2 verified fatigue · F3 verified distraction"
            : "View only — not on triage shift"}
        </p>
      </div>

      <button
        type="button"
        disabled={actionsDisabled}
        onClick={onBeginDismissCapture}
        className={`${commandOutlineButton} w-full px-4 py-3 disabled:opacity-40`}
      >
        F1 — Dismiss as false positive
      </button>
      <button
        type="button"
        disabled={actionsDisabled}
        onClick={onBeginResolution}
        className="w-full rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 disabled:opacity-40 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60"
      >
        F2 — Verified fatigue
      </button>
      <button
        type="button"
        disabled={actionsDisabled}
        onClick={onBeginDistractionCapture}
        className="w-full rounded-lg border border-violet-400 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-900 transition-colors hover:bg-violet-100 disabled:opacity-40 dark:border-violet-500/50 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60"
      >
        F3 — Verified distraction
      </button>

      <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-700/80">
        <button
          type="button"
          disabled={busy}
          onClick={onSimulate}
          className={cn(
            "w-full rounded-lg border border-dashed px-3 py-2 text-xs transition-colors",
            commandTextMuted,
            "border-slate-300 hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:text-slate-300"
          )}
        >
          Simulate edge ingest (dev)
        </button>
      </div>
    </div>
  );
}
