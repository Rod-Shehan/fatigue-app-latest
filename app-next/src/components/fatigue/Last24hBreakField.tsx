"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatLast24hBreakRangeDisplay,
  isoToPerthDatetimeLocal,
  perthDatetimeLocalToIso,
  validateLast24hBreakRange,
  type Last24hBreakRange,
} from "@/lib/last-24h-break-range";
import { cn } from "@/lib/utils";

export const LAST_24H_BREAK_CHIP_LABEL = "Last 24Hr Break";

/** Editable until the week is signed (readOnly); then manager amend only. */
export function Last24hBreakField({
  value,
  onChange,
  readOnly = false,
  allowAmend = false,
}: {
  value?: Last24hBreakRange | null;
  onChange: (range: Last24hBreakRange | null) => void;
  readOnly?: boolean;
  /** Override: allow change while readOnly (manager amend path). */
  allowAmend?: boolean;
}) {
  const canEdit = !readOnly || allowAmend;
  const hasValue = !!(value?.startIso && value?.endIso);
  const locked = hasValue && !canEdit;

  const [editorOpen, setEditorOpen] = useState(false);
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const openEditor = () => {
    if (!canEdit) return;
    setStartLocal(value?.startIso ? isoToPerthDatetimeLocal(value.startIso) : "");
    setEndLocal(value?.endIso ? isoToPerthDatetimeLocal(value.endIso) : "");
    setError(null);
    setChecked(false);
    setEditorOpen(true);
  };

  if (locked) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {LAST_24H_BREAK_CHIP_LABEL}
        </p>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums mt-0.5 leading-snug">
          {formatLast24hBreakRangeDisplay(value!.startIso, value!.endIso)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Locked after sign-off — ask your manager to amend.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "rounded-lg px-3 py-2.5 space-y-2",
          hasValue
            ? "border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
            : "border-2 border-amber-300 dark:border-amber-600 bg-amber-50/80 dark:bg-amber-950/30"
        )}
      >
        {hasValue ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/80">
            {LAST_24H_BREAK_CHIP_LABEL}
          </p>
        ) : (
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            {LAST_24H_BREAK_CHIP_LABEL}
          </p>
        )}
        {hasValue ? (
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums leading-snug">
            {formatLast24hBreakRangeDisplay(value!.startIso, value!.endIso)}
          </p>
        ) : null}
        <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-snug">
          {hasValue
            ? "Absolute start and end of your last full 24+ hours off (resets 17h / 72h). Change until you sign the week."
            : "Set the start and end time of your last continuous 24+ hours of non-work — not just a calendar day. Required once per week before compliance checks are complete."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canEdit}
            onClick={openEditor}
            className={cn(
              "inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-sm font-medium",
              "border-amber-400 dark:border-amber-600 bg-white dark:bg-slate-900 text-amber-950 dark:text-amber-50"
            )}
          >
            <Clock className="w-4 h-4 shrink-0" aria-hidden />
            {hasValue ? "Edit times" : "Set start & end"}
          </button>
          {hasValue ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10"
              disabled={!canEdit}
              onClick={() => onChange(null)}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setError(null);
            setChecked(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{LAST_24H_BREAK_CHIP_LABEL}</DialogTitle>
            <DialogDescription>
              Enter the real start and end of the break on the timeline (Perth time). Must be at least
              24 continuous hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="last24h-start">Start</Label>
              <input
                id="last24h-start"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last24h-end">End</Label>
              <input
                id="last24h-end"
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm"
              />
            </div>
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <label className="flex items-start gap-3 text-base text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <span>I confirm these times are correct.</span>
            </label>
          </div>
          <div className="flex flex-col-reverse sm:flex-row flex-wrap gap-2 justify-end pt-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!checked}
              className="min-h-11 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40"
              onClick={() => {
                const startIso = perthDatetimeLocalToIso(startLocal);
                const endIso = perthDatetimeLocalToIso(endLocal);
                if (!startIso || !endIso) {
                  setError("Enter both start and end times.");
                  return;
                }
                const v = validateLast24hBreakRange(startIso, endIso);
                if (!v.ok) {
                  setError(v.error);
                  return;
                }
                onChange({ startIso, endIso });
                setEditorOpen(false);
                setChecked(false);
                setError(null);
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
