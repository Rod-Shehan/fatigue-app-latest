"use client";

import { useState } from "react";
import {
  VERIFIED_DISTRACTION_REASONS,
  type VerifiedDistractionReasonId,
} from "@/lib/integrations/verified-distraction-reasons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function VerifiedDistractionReasonCapture({
  selected,
  onChange,
  disabled,
}: {
  selected: VerifiedDistractionReasonId[];
  onChange: (next: VerifiedDistractionReasonId[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: VerifiedDistractionReasonId, checked: boolean) {
    if (checked) {
      onChange(selected.includes(id) ? selected : [...selected, id]);
      return;
    }
    onChange(selected.filter((item) => item !== id));
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-xs font-medium text-slate-600 dark:text-slate-400">
        What triggered the alert? (select all that apply)
      </legend>
      <ul className="space-y-2">
        {VERIFIED_DISTRACTION_REASONS.map((reason) => (
          <li key={reason.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
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
  reasons: VerifiedDistractionReasonId[];
  onReasonsChange: (next: VerifiedDistractionReasonId[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
  className?: string;
};

export function VerifiedDistractionCapturePanel({
  note,
  onNoteChange,
  reasons,
  onReasonsChange,
  onConfirm,
  onCancel,
  pending,
  error,
  className,
}: Props) {
  const [showValidation, setShowValidation] = useState(false);
  const reasonsMissing = reasons.length === 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-violet-200 bg-violet-50/80 p-3 dark:border-violet-900/60 dark:bg-violet-950/30",
        className
      )}
    >
      <p className="mb-3 text-sm font-medium text-violet-950 dark:text-violet-100">
        Verified distraction — reason capture
      </p>
      <VerifiedDistractionReasonCapture
        selected={reasons}
        onChange={onReasonsChange}
        disabled={pending}
      />
      <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
        Additional note (optional)
      </label>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={2}
        placeholder="e.g. brief call while stationary"
        disabled={pending}
        className="mb-3 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
      />
      {error ? <p className="mb-2 text-sm text-rose-700 dark:text-rose-400">{error}</p> : null}
      {showValidation && reasonsMissing ? (
        <p className="mb-2 text-sm text-rose-700 dark:text-rose-400">
          Select at least one trigger reason before confirming.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="flex-1" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={pending}
          onClick={() => {
            if (reasonsMissing) {
              setShowValidation(true);
              return;
            }
            onConfirm();
          }}
        >
          Confirm verified distraction
        </Button>
      </div>
    </div>
  );
}
