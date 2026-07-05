"use client";

import { useState } from "react";
import {
  commandInput,
  commandOutlineButton,
  commandPrimaryButton,
  commandTextMuted,
  commandTextPrimary,
} from "@/components/command/command-styles";
import {
  VERIFIED_DISTRACTION_REASONS,
  type VerifiedDistractionReasonId,
} from "@/lib/verified-distraction-reasons";
import { triageTriggerReasonRequiresFreeNote } from "@/lib/triage-trigger-reasons";
import { cn } from "@/lib/utils";

export function VerifiedDistractionCapturePanel({
  note,
  onNoteChange,
  reasons,
  onReasonsChange,
  onConfirm,
  onCancel,
  pending,
  error,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  reasons: VerifiedDistractionReasonId[];
  onReasonsChange: (next: VerifiedDistractionReasonId[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}) {
  const [showValidation, setShowValidation] = useState(false);
  const reasonsMissing = reasons.length === 0;
  const noteRequired = triageTriggerReasonRequiresFreeNote(reasons);
  const noteMissing = noteRequired && !note.trim();

  function toggle(id: VerifiedDistractionReasonId, checked: boolean) {
    if (checked) {
      onReasonsChange(reasons.includes(id) ? reasons : [...reasons, id]);
      return;
    }
    onReasonsChange(reasons.filter((item) => item !== id));
  }

  return (
    <div className="rounded-lg border border-violet-300 bg-violet-50 p-3 dark:border-violet-500/30 dark:bg-violet-950/20">
      <p className="mb-3 text-sm font-medium text-violet-950 dark:text-violet-100">
        Verified distraction — reason capture
      </p>
      <fieldset className="space-y-2" disabled={pending}>
        <legend className={cn("text-xs font-medium", commandTextMuted)}>
          What triggered the alert? (select all that apply)
        </legend>
        <ul className="space-y-2">
          {VERIFIED_DISTRACTION_REASONS.map((reason) => (
            <li key={reason.id}>
              <label className={cn("flex cursor-pointer items-center gap-2 text-sm", commandTextPrimary)}>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-400 bg-white text-teal-600 focus:ring-teal-500 dark:border-slate-500 dark:bg-slate-900"
                  checked={reasons.includes(reason.id)}
                  onChange={(e) => toggle(reason.id, e.target.checked)}
                />
                {reason.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <label className={cn("mt-3 block text-xs font-medium", commandTextMuted)}>
        {noteRequired ? "Details (required when Other is selected)" : "Additional note (optional)"}
      </label>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={2}
        placeholder="e.g. brief call while stationary"
        disabled={pending}
        className={`${commandInput} mb-3 text-sm`}
      />
      {error ? <p className="mb-2 text-sm text-rose-700 dark:text-rose-400">{error}</p> : null}
      {showValidation && reasonsMissing ? (
        <p className="mb-2 text-sm text-rose-700 dark:text-rose-400">
          Select at least one trigger reason before confirming.
        </p>
      ) : null}
      {showValidation && noteMissing ? (
        <p className="mb-2 text-sm text-rose-700 dark:text-rose-400">Enter details below when Other is selected.</p>
      ) : null}
      <div className="flex flex-col gap-2">
        <button type="button" disabled={pending} onClick={onCancel} className={`${commandOutlineButton} w-full py-2.5`}>
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (reasonsMissing || noteMissing) {
              setShowValidation(true);
              return;
            }
            onConfirm();
          }}
          className={`${commandPrimaryButton} w-full py-2.5`}
        >
          Confirm verified distraction
        </button>
      </div>
    </div>
  );
}
