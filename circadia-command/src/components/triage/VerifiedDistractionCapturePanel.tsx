"use client";

import { useState } from "react";
import {
  commandInput,
  commandOutlineButton,
  commandPrimaryButton,
} from "@/components/command/command-styles";
import {
  VERIFIED_DISTRACTION_REASONS,
  type VerifiedDistractionReasonId,
} from "@/lib/verified-distraction-reasons";

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

  function toggle(id: VerifiedDistractionReasonId, checked: boolean) {
    if (checked) {
      onReasonsChange(reasons.includes(id) ? reasons : [...reasons, id]);
      return;
    }
    onReasonsChange(reasons.filter((item) => item !== id));
  }

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3">
      <p className="mb-3 text-sm font-medium text-violet-100">Verified distraction — reason capture</p>
      <fieldset className="space-y-2" disabled={pending}>
        <legend className="text-xs font-medium text-slate-400">
          What triggered the distraction alert? (select all that apply)
        </legend>
        <ul className="space-y-2">
          {VERIFIED_DISTRACTION_REASONS.map((reason) => (
            <li key={reason.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-teal-600 focus:ring-teal-500"
                  checked={reasons.includes(reason.id)}
                  onChange={(e) => toggle(reason.id, e.target.checked)}
                />
                {reason.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <label className="mt-3 block text-xs font-medium text-slate-400">Additional note (optional)</label>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={2}
        placeholder="e.g. brief call while stationary"
        disabled={pending}
        className={`${commandInput} mb-3 text-sm`}
      />
      {error ? <p className="mb-2 text-sm text-rose-400">{error}</p> : null}
      {showValidation && reasonsMissing ? (
        <p className="mb-2 text-sm text-rose-400">Select at least one trigger reason before confirming.</p>
      ) : null}
      <div className="flex flex-col gap-2">
        <button type="button" disabled={pending} onClick={onCancel} className={`${commandOutlineButton} w-full py-2.5`}>
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (reasonsMissing) {
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
