"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  INCIDENT_RESOLUTION_ACTIONS,
  INCIDENT_RESOLUTION_CATEGORIES,
  type IncidentResolutionActionType,
} from "@/lib/triage-resolution";
import {
  commandInput,
  commandLabel,
  commandOutlineButton,
  commandPrimaryButton,
} from "@/components/command/command-styles";

export type ResolutionFormProps = {
  busy: boolean;
  error?: string | null;
  onSubmit: (actionType: IncidentResolutionActionType, resolutionNotes: string) => void;
  onCancel: () => void;
};

export function ResolutionForm({ busy, error, onSubmit, onCancel }: ResolutionFormProps) {
  const groupId = useId();
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [actionType, setActionType] = useState<IncidentResolutionActionType>(
    INCIDENT_RESOLUTION_ACTIONS[0].value
  );
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => notesRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-300">
          Resolution &amp; logging
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Record what the fleet did before this incident is cleared.
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className={`${commandLabel} mb-1`}>Action taken</legend>
        {INCIDENT_RESOLUTION_CATEGORIES.map((category) => {
          const actions = INCIDENT_RESOLUTION_ACTIONS.filter((action) => action.category === category);
          return (
            <div key={category} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</p>
              <div className="grid grid-cols-1 gap-2">
                {actions.map((action) => (
                  <label
                    key={action.value}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm leading-snug transition-colors ${
                      actionType === action.value
                        ? "border-teal-500 bg-teal-950/40 text-teal-100"
                        : "border-slate-600 bg-slate-950/30 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${groupId}-action`}
                      className="mt-0.5 h-4 w-4 shrink-0 border-slate-500 text-teal-600 focus:ring-teal-500"
                      checked={actionType === action.value}
                      onChange={() => setActionType(action.value)}
                      disabled={busy}
                    />
                    <span>{action.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </fieldset>

      <div>
        <label htmlFor={`${groupId}-notes`} className={commandLabel}>
          Resolution notes
        </label>
        <textarea
          id={`${groupId}-notes`}
          ref={notesRef}
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
          rows={4}
          placeholder={
            actionType === "other_outcome"
              ? "Describe the outcome…"
              : "Who you spoke to, instructions given, follow-up planned…"
          }
          disabled={busy}
          className={`${commandInput} mt-1 resize-y`}
        />
      </div>

      {error ? (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSubmit(actionType, resolutionNotes)}
          className={`${commandPrimaryButton} w-full px-4 py-3`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Record action &amp; close
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className={`${commandOutlineButton} w-full px-4 py-3`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
