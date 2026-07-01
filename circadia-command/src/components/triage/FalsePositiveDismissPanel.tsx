"use client";

import { useState } from "react";
import {
  commandInput,
  commandOutlineButton,
  commandPrimaryButton,
} from "@/components/command/command-styles";
import {
  FALSE_POSITIVE_REASONS,
  type FalsePositiveReasonId,
} from "@/lib/false-positive-reasons";

function FalsePositiveReasonCapture({
  selected,
  onChange,
  disabled,
}: {
  selected: FalsePositiveReasonId[];
  onChange: (next: FalsePositiveReasonId[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: FalsePositiveReasonId, checked: boolean) {
    if (checked) {
      onChange(selected.includes(id) ? selected : [...selected, id]);
      return;
    }
    onChange(selected.filter((item) => item !== id));
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-xs font-medium text-slate-400">
        What triggered the alert? (select all that apply)
      </legend>
      <ul className="space-y-2">
        {FALSE_POSITIVE_REASONS.map((reason) => (
          <li key={reason.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-teal-600 focus:ring-teal-500"
                checked={selected.includes(reason.id)}
                onChange={(e) => toggle(reason.id, e.target.checked)}
              />
              {reason.label}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

type Props = {
  note: string;
  onNoteChange: (value: string) => void;
  reasons: FalsePositiveReasonId[];
  onReasonsChange: (next: FalsePositiveReasonId[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
};

export function FalsePositiveDismissPanel({
  note,
  onNoteChange,
  reasons,
  onReasonsChange,
  onConfirm,
  onCancel,
  pending,
  error,
}: Props) {
  const [showValidation, setShowValidation] = useState(false);
  const reasonsMissing = reasons.length === 0;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
      <p className="mb-3 text-sm font-medium text-amber-100">False positive — reason capture</p>
      <FalsePositiveReasonCapture
        selected={reasons}
        onChange={onReasonsChange}
        disabled={pending}
      />
      <label className="mt-3 block text-xs font-medium text-slate-400">Additional note (optional)</label>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={2}
        placeholder="e.g. glare, mirror check"
        disabled={pending}
        className={`${commandInput} mb-3 text-sm`}
      />
      {error ? <p className="mb-2 text-sm text-rose-400">{error}</p> : null}
      {showValidation && reasonsMissing ? (
        <p className="mb-2 text-sm text-rose-400">Select at least one trigger reason before dismissing.</p>
      ) : null}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className={`${commandOutlineButton} w-full py-2.5`}
        >
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
          Confirm dismiss
        </button>
      </div>
    </div>
  );
}
