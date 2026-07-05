"use client";

import { useState } from "react";
import {
  FALSE_POSITIVE_REASONS,
  type FalsePositiveReasonId,
} from "@/lib/integrations/false-positive-reasons";
import { triageTriggerReasonRequiresFreeNote } from "@/lib/integrations/triage-trigger-reasons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  selected: FalsePositiveReasonId[];
  onChange: (next: FalsePositiveReasonId[]) => void;
  disabled?: boolean;
  className?: string;
};

export function FalsePositiveReasonCapture({
  selected,
  onChange,
  disabled,
  className,
}: Props) {
  function toggle(id: FalsePositiveReasonId, checked: boolean) {
    if (checked) {
      onChange(selected.includes(id) ? selected : [...selected, id]);
      return;
    }
    onChange(selected.filter((item) => item !== id));
  }

  return (
    <fieldset className={cn("space-y-2", className)} disabled={disabled}>
      <legend className="text-xs font-medium text-slate-600 dark:text-slate-400">
        What triggered the alert? (select all that apply)
      </legend>
      <ul className="space-y-2">
        {FALSE_POSITIVE_REASONS.map((reason) => {
          const checked = selected.includes(reason.id);
          return (
            <li key={reason.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  checked={checked}
                  onChange={(e) => toggle(reason.id, e.target.checked)}
                />
                {reason.label}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

type DismissPanelProps = {
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
}: DismissPanelProps) {
  const [showValidation, setShowValidation] = useState(false);
  const reasonsMissing = reasons.length === 0;
  const noteRequired = triageTriggerReasonRequiresFreeNote(reasons);
  const noteMissing = noteRequired && !note.trim();

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
      <p className="mb-3 text-sm font-medium text-amber-950 dark:text-amber-100">
        False positive — reason capture
      </p>
      <FalsePositiveReasonCapture selected={reasons} onChange={onReasonsChange} disabled={pending} />
      <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {noteRequired ? "Details (required when Other is selected)" : "Additional note (optional)"}
      </label>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={2}
        placeholder="e.g. glare, mirror check"
        disabled={pending}
        className="mb-3 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
      />
      {error ? <p className="mb-2 text-sm text-rose-700 dark:text-rose-400">{error}</p> : null}
      {showValidation && reasonsMissing ? (
        <p className="mb-2 text-sm text-rose-700 dark:text-rose-400">
          Select at least one trigger reason before dismissing.
        </p>
      ) : null}
      {showValidation && noteMissing ? (
        <p className="mb-2 text-sm text-rose-700 dark:text-rose-400">Enter details below when Other is selected.</p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={pending}
          onClick={() => {
            if (reasonsMissing || noteMissing) {
              setShowValidation(true);
              return;
            }
            onConfirm();
          }}
        >
          Confirm dismiss
        </Button>
      </div>
    </div>
  );
}
