"use client";

import { useCallback, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatSheetDisplayDate } from "@/lib/weeks";
import { cn } from "@/lib/utils";

const CHIP_LABEL = "Last 24Hr Break";

/** Editable until the week is signed (readOnly); then manager amend only. */
export function Last24hBreakField({
  value,
  onChange,
  readOnly = false,
  allowAmend = false,
}: {
  value?: string;
  onChange: (ymd: string) => void;
  readOnly?: boolean;
  /** Override: allow change while readOnly (manager amend path). */
  allowAmend?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [checked, setChecked] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const canEdit = !readOnly || allowAmend;
  const hasValue = !!value?.trim();
  const locked = hasValue && !canEdit;

  const openPicker = useCallback(() => {
    const el = inputRef.current;
    if (!el || !canEdit) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.click();
  }, [canEdit]);

  if (locked) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {CHIP_LABEL}
        </p>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums mt-0.5">
          {formatSheetDisplayDate(value!)}
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
            {CHIP_LABEL}
          </p>
        ) : (
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{CHIP_LABEL}</p>
        )}
        {hasValue ? (
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
            {formatSheetDisplayDate(value!)}
          </p>
        ) : null}
        <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-snug">
          {hasValue
            ? "Week record date (resets 17h / 72h rules). You can change it until you sign the week."
            : "Date of your last full 24 hours of non-work. Required once per week before compliance checks are complete. You can change it until you sign the week."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canEdit}
            onClick={openPicker}
            className={cn(
              "inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-sm font-medium",
              "border-amber-400 dark:border-amber-600 bg-white dark:bg-slate-900 text-amber-950 dark:text-amber-50"
            )}
          >
            <Calendar className="w-4 h-4 shrink-0" aria-hidden />
            {hasValue ? "Change date" : "Set date"}
          </button>
          {hasValue ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10"
              disabled={!canEdit}
              onClick={() => onChange("")}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <input
        key={resetKey}
        ref={inputRef}
        type="date"
        disabled={!canEdit}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => {
          const v = e.target.value;
          if (v) {
            setPending(v);
            setChecked(false);
            setConfirmOpen(true);
          }
        }}
      />
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setPending("");
            setChecked(false);
            setResetKey((k) => k + 1);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm {CHIP_LABEL}</DialogTitle>
            <DialogDescription>
              Set this date for your week record? You can change it again until you sign the week.
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <p className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100 py-1">
              {formatSheetDisplayDate(pending)}
            </p>
          )}
          <label className="flex items-start gap-3 text-base text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>I confirm this date is correct.</span>
          </label>
          <div className="flex flex-col-reverse sm:flex-row flex-wrap gap-2 justify-end pt-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!checked}
              className="min-h-11 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40"
              onClick={() => {
                onChange(pending);
                setConfirmOpen(false);
                setPending("");
                setChecked(false);
                setResetKey((k) => k + 1);
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
