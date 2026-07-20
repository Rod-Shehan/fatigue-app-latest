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
import { DECLARED_24H_REST_COPY } from "@/lib/declared-24h-rests";

type RestKey = "last_24h_rest_1" | "last_24h_rest_2" | "last_24h_rest_3" | "last_24h_rest_4";

const LABELS: Record<RestKey, string> = {
  last_24h_rest_1: DECLARED_24H_REST_COPY.LABEL_1,
  last_24h_rest_2: DECLARED_24H_REST_COPY.LABEL_2,
  last_24h_rest_3: DECLARED_24H_REST_COPY.LABEL_3,
  last_24h_rest_4: DECLARED_24H_REST_COPY.LABEL_4,
};

export type Declared24hRestValues = Partial<Record<RestKey, string>>;

export function Declared24hRestsField({
  fieldCount,
  values,
  onChange,
  readOnly = false,
}: {
  fieldCount: 2 | 4;
  values: Declared24hRestValues;
  onChange: (key: RestKey, ymd: string) => void;
  readOnly?: boolean;
}) {
  const keys = (
    fieldCount === 4
      ? (["last_24h_rest_1", "last_24h_rest_2", "last_24h_rest_3", "last_24h_rest_4"] as const)
      : (["last_24h_rest_1", "last_24h_rest_2"] as const)
  );
  const allSet = keys.every((k) => !!values[k]?.trim());
  const title = fieldCount === 4 ? DECLARED_24H_REST_COPY.TITLE_4 : DECLARED_24H_REST_COPY.TITLE_2;
  const why = fieldCount === 4 ? DECLARED_24H_REST_COPY.WHY_4 : DECLARED_24H_REST_COPY.WHY_2;

  if (allSet) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2.5 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </p>
        {keys.map((k) => (
          <div key={k}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{LABELS[k]}</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
              {formatSheetDisplayDate(values[k]!)}
            </p>
          </div>
        ))}
        <p className="text-xs text-slate-500 dark:text-slate-400">{DECLARED_24H_REST_COPY.LOCKED_HINT}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-amber-300 dark:border-amber-600 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2.5 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{title}</p>
        <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-1 leading-snug">{why}</p>
      </div>
      {keys.map((k) => (
        <RestDateRow
          key={k}
          label={LABELS[k]}
          value={values[k]}
          readOnly={readOnly}
          onSet={(ymd) => onChange(k, ymd)}
        />
      ))}
    </div>
  );
}

function RestDateRow({
  label,
  value,
  readOnly,
  onSet,
}: {
  label: string;
  value?: string;
  readOnly?: boolean;
  onSet: (ymd: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [checked, setChecked] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const openPicker = useCallback(() => {
    const el = inputRef.current;
    if (!el || readOnly) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.click();
  }, [readOnly]);

  if (value?.trim()) {
    return (
      <div className="rounded-md border border-amber-200/80 dark:border-amber-800 bg-white/60 dark:bg-slate-900/50 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
          {label}
        </p>
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-50 tabular-nums mt-0.5">
          {formatSheetDisplayDate(value)}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-amber-950 dark:text-amber-100">{label}</p>
        <button
          type="button"
          disabled={readOnly}
          onClick={openPicker}
          className={cn(
            "inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-sm font-medium",
            "border-amber-400 dark:border-amber-600 bg-white dark:bg-slate-900 text-amber-950 dark:text-amber-50"
          )}
        >
          <Calendar className="w-4 h-4 shrink-0" aria-hidden />
          Set date
        </button>
        <input
          key={resetKey}
          ref={inputRef}
          type="date"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            setPending(v);
            setChecked(false);
            setConfirmOpen(true);
          }}
        />
      </div>
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm rest date</DialogTitle>
            <DialogDescription>
              You had a full 24 hours of non-work on{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {pending ? formatSheetDisplayDate(pending) : "—"}
              </span>
              . This becomes part of your weekly record.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-1"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>I confirm this date is correct.</span>
          </label>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmOpen(false);
                setPending("");
                setChecked(false);
                setResetKey((k) => k + 1);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!checked || !pending}
              onClick={() => {
                onSet(pending);
                setConfirmOpen(false);
                setPending("");
                setChecked(false);
              }}
            >
              Save date
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
