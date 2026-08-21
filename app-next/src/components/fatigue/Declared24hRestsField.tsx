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
  DECLARED_24H_REST_COPY,
  type Declared24hRestFields,
  type Declared24hRestKey,
  declaredRestRangeKeys,
} from "@/lib/declared-24h-rests";
import {
  addHoursToPerthDatetimeLocal,
  formatLast24hBreakRangeDisplay,
  isoToPerthDatetimeLocal,
  LAST_24H_RANGE_EDITOR_HINT,
  perthDatetimeLocalToIso,
  validateLast24hBreakRange,
  type Last24hBreakRange,
} from "@/lib/last-24h-break-range";
import { formatSheetDisplayDate } from "@/lib/weeks";
import { cn } from "@/lib/utils";

const LABELS: Record<Declared24hRestKey, string> = {
  last_24h_rest_1: DECLARED_24H_REST_COPY.LABEL_1,
  last_24h_rest_2: DECLARED_24H_REST_COPY.LABEL_2,
  last_24h_rest_3: DECLARED_24H_REST_COPY.LABEL_3,
  last_24h_rest_4: DECLARED_24H_REST_COPY.LABEL_4,
};

export type Declared24hRestValues = Declared24hRestFields;

function rangeForKey(
  values: Declared24hRestFields,
  key: Declared24hRestKey
): Last24hBreakRange | null {
  const { start, end } = declaredRestRangeKeys(key);
  const startIso = values[start]?.toString().trim() ?? "";
  const endIso = values[end]?.toString().trim() ?? "";
  if (!startIso || !endIso) return null;
  const v = validateLast24hBreakRange(startIso, endIso);
  if (!v.ok) return null;
  return { startIso, endIso };
}

/** Editable until the week is signed (readOnly); then manager amend only. */
export function Declared24hRestsField({
  fieldCount,
  values,
  onRangeChange,
  readOnly = false,
  allowAmend = false,
}: {
  fieldCount: 2 | 4;
  values: Declared24hRestValues;
  onRangeChange: (key: Declared24hRestKey, range: Last24hBreakRange | null) => void;
  readOnly?: boolean;
  allowAmend?: boolean;
}) {
  const keys = (
    fieldCount === 4
      ? (["last_24h_rest_1", "last_24h_rest_2", "last_24h_rest_3", "last_24h_rest_4"] as const)
      : (["last_24h_rest_1", "last_24h_rest_2"] as const)
  );
  const allSet = keys.every((k) => !!rangeForKey(values, k));
  const title = fieldCount === 4 ? DECLARED_24H_REST_COPY.TITLE_4 : DECLARED_24H_REST_COPY.TITLE_2;
  const why = fieldCount === 4 ? DECLARED_24H_REST_COPY.WHY_4 : DECLARED_24H_REST_COPY.WHY_2;
  const canEdit = !readOnly || allowAmend;

  if (allSet && !canEdit) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2.5 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </p>
        {keys.map((k) => {
          const range = rangeForKey(values, k)!;
          return (
            <div key={k}>
              <p className="text-xs text-slate-500 dark:text-slate-400">{LABELS[k]}</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                {formatLast24hBreakRangeDisplay(range.startIso, range.endIso)}
              </p>
            </div>
          );
        })}
        <p className="text-xs text-slate-500 dark:text-slate-400">{DECLARED_24H_REST_COPY.LOCKED_HINT}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2.5 space-y-3",
        allSet
          ? "border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-2 border-amber-300 dark:border-amber-600 bg-amber-50/80 dark:bg-amber-950/30"
      )}
    >
      <div>
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{title}</p>
        <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-1 leading-snug">
          {allSet ? DECLARED_24H_REST_COPY.EDITABLE_HINT : why}
        </p>
      </div>
      {keys.map((k) => (
        <RestRangeRow
          key={k}
          label={LABELS[k]}
          value={rangeForKey(values, k)}
          dateOnlyHint={values[k]?.toString().trim() || ""}
          canEdit={canEdit}
          onSet={(range) => onRangeChange(k, range)}
        />
      ))}
    </div>
  );
}

function RestRangeRow({
  label,
  value,
  dateOnlyHint,
  canEdit,
  onSet,
}: {
  label: string;
  value: Last24hBreakRange | null;
  dateOnlyHint?: string;
  canEdit: boolean;
  onSet: (range: Last24hBreakRange | null) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const hasValue = !!value;
  const hintLabel =
    !hasValue && dateOnlyHint
      ? formatSheetDisplayDate(dateOnlyHint) || dateOnlyHint
      : null;

  const openEditor = () => {
    if (!canEdit) return;
    setStartLocal(value?.startIso ? isoToPerthDatetimeLocal(value.startIso) : "");
    setEndLocal(value?.endIso ? isoToPerthDatetimeLocal(value.endIso) : "");
    setError(null);
    setChecked(false);
    setEditorOpen(true);
  };

  return (
    <>
      <div
        className={cn(
          "rounded-md px-2.5 py-2 space-y-2",
          hasValue
            ? "border border-amber-200/80 dark:border-amber-800 bg-white/60 dark:bg-slate-900/50"
            : "flex flex-wrap items-center justify-between gap-2"
        )}
      >
        {hasValue ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
              {label}
            </p>
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-50 tabular-nums leading-snug">
              {formatLast24hBreakRangeDisplay(value!.startIso, value!.endIso)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canEdit}
                onClick={openEditor}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border text-xs font-medium",
                  "border-amber-400 dark:border-amber-600 bg-white dark:bg-slate-900 text-amber-950 dark:text-amber-50"
                )}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Edit times
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                disabled={!canEdit}
                onClick={() => onSet(null)}
              >
                Clear
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0">
              <p className="text-xs font-medium text-amber-950 dark:text-amber-100">{label}</p>
              {hintLabel ? (
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-50 tabular-nums mt-0.5">
                  {hintLabel}
                  <span className="block text-[11px] font-normal text-amber-900/80 dark:text-amber-200/80">
                    Date saved — set start time (Perth); end fills 24 hours later
                  </span>
                </p>
              ) : null}
            </div>
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
              Set start time
            </button>
          </>
        )}
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
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {LAST_24H_RANGE_EDITOR_HINT} Must be at least 24 continuous hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`rest-start-${label}`}>Start</Label>
              <input
                id={`rest-start-${label}`}
                type="datetime-local"
                value={startLocal}
                onChange={(e) => {
                  const next = e.target.value;
                  setStartLocal(next);
                  const filled = addHoursToPerthDatetimeLocal(next, 24);
                  if (filled) setEndLocal(filled);
                }}
                className="flex h-11 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`rest-end-${label}`}>End (24 hours later)</Label>
              <input
                id={`rest-end-${label}`}
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
                onSet({ startIso, endIso });
                setEditorOpen(false);
              }}
            >
              Save times
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
