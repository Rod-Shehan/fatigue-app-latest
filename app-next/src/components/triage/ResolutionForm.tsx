"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INCIDENT_RESOLUTION_ACTIONS,
  INCIDENT_RESOLUTION_CATEGORIES,
  type IncidentResolutionActionType,
} from "@/lib/triage-resolution";

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
    <div className="space-y-4 rounded-lg border border-teal-600/40 bg-teal-950/10 p-4 dark:bg-teal-950/20">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-teal-100">
          Resolution &amp; logging
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Record what the fleet did before this alert is cleared.
        </p>
      </div>

      <fieldset className="min-w-0 space-y-4 border-0 p-0">
        <legend className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Action taken
        </legend>
        {INCIDENT_RESOLUTION_CATEGORIES.map((category) => {
          const actions = INCIDENT_RESOLUTION_ACTIONS.filter((action) => action.category === category);
          return (
            <div key={category} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {category}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {actions.map((action) => (
                  <label
                    key={action.value}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm leading-snug transition-colors ${
                      actionType === action.value
                        ? "border-teal-600 bg-teal-50 text-teal-950 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-100"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${groupId}-action`}
                      className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-teal-600 focus:ring-teal-500"
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
        <label
          htmlFor={`${groupId}-notes`}
          className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
        >
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
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      {error ? (
        <p className="text-sm text-rose-700 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="flex-1"
          disabled={busy}
          onClick={() => onSubmit(actionType, resolutionNotes)}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Record action &amp; close
        </Button>
        <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
