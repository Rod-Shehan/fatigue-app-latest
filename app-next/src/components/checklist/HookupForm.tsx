"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CHECKLIST_SCHEMA_VERSION,
  emptyPassFailItem,
  HOOKUP_FORM_TITLE,
  HOOKUP_OBSERVATIONS_LABEL,
  HOOKUP_PROCEDURE_NOTE,
  HOOKUP_SCHEMA,
  HOOKUP_SIGN_NOTE,
  isPassFailItemComplete,
  lastHookupFromRecords,
  newChecklistRecordId,
  setPassFailValue,
  validateCompletedChecklistRecord,
  type ChecklistItemValue,
  type ChecklistPassFailItemState,
  type ChecklistRecord,
  type ChecklistSchemaItem,
  type ChecklistSignatureCapture,
} from "@/lib/checklist";
import { cn } from "@/lib/utils";
import {
  HOOKUP_PRIME_MOVER_REMINDER_HINT,
  HOOKUP_PRIME_MOVER_REMINDER_LABEL,
} from "@/lib/product-copy";
import { ChecklistModalShell } from "./ChecklistModalShell";
import { ChecklistSignaturePanel } from "./ChecklistSignaturePanel";

function initPassFailMap(): Record<string, ChecklistPassFailItemState> {
  const m: Record<string, ChecklistPassFailItemState> = {};
  for (const item of HOOKUP_SCHEMA) m[item.code] = emptyPassFailItem();
  return m;
}

const HOOKUP_SEGMENTS: { value: ChecklistItemValue; label: string; activeClass: string }[] = [
  { value: "pass", label: "COMPLETED", activeClass: "bg-ck-emerald text-ck-on-accent border-ck-emerald" },
  { value: "fail", label: "FAULT", activeClass: "bg-ck-red text-ck-on-accent border-ck-red" },
];

function HookupStepRow({
  item,
  state,
  onChange,
}: {
  item: ChecklistSchemaItem;
  state: ChecklistPassFailItemState;
  onChange: (next: ChecklistPassFailItemState) => void;
}) {
  return (
    <div className="flex items-start gap-2 border-b border-ck-border py-2 last:border-0">
      <p className="min-w-0 flex-1 text-sm leading-snug text-ck-fg">{item.label}</p>
      <div className="grid w-[9.75rem] shrink-0 grid-cols-2 gap-1" role="group" aria-label={item.label}>
        {HOOKUP_SEGMENTS.map((seg) => {
          const active = state.value === seg.value;
          return (
            <button
              key={seg.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(setPassFailValue(state, seg.value))}
              className={cn(
                "min-h-[36px] rounded-md border px-1 text-[10px] font-bold leading-tight tracking-wide",
                active
                  ? seg.activeClass
                  : "border-ck-border bg-ck-midnight/40 text-ck-steel"
              )}
            >
              {seg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Voluntary hook-up check. Multi-complete allowed. Ticks the week PDF when signed.
 * Paper driver sign is the signature.
 */
export function HookupForm({
  open,
  onClose,
  driverName,
  truckRego,
  trailerRego,
  primeMoverReminder = false,
  previousHookupRecords,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  driverName?: string | null;
  truckRego?: string | null;
  trailerRego?: string | null;
  primeMoverReminder?: boolean;
  previousHookupRecords?: ChecklistRecord[] | null;
  onCompleted: (record: ChecklistRecord) => void | Promise<void>;
}) {
  const [truck, setTruck] = useState("");
  const [trailer, setTrailer] = useState("");
  const [observations, setObservations] = useState("");
  const [items, setItems] = useState(initPassFailMap);
  const [signature, setSignature] = useState<ChecklistSignatureCapture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allItemsComplete = useMemo(
    () =>
      HOOKUP_SCHEMA.every((item) =>
        isPassFailItemComplete(items[item.code]!, { defectRequired: false })
      ),
    [items]
  );

  const canSave =
    allItemsComplete && !!signature && Boolean(truck.trim()) && Boolean(trailer.trim());

  useEffect(() => {
    if (!open) return;
    const last = lastHookupFromRecords(previousHookupRecords);
    setTruck((prev) => prev || last?.truckRego || (truckRego || "").trim());
    setTrailer((prev) => prev || last?.trailerRego || (trailerRego || "").trim());
  }, [open, previousHookupRecords, truckRego, trailerRego]);

  const reset = () => {
    setTruck("");
    setTrailer("");
    setObservations("");
    setItems(initPassFailMap());
    setSignature(null);
    setError(null);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    setError(null);
    if (!truck.trim() || !trailer.trim()) {
      setError("Enter the truck and trailer this hook-up is for.");
      return;
    }
    if (!allItemsComplete) {
      setError("Mark every step before saving.");
      return;
    }
    if (!signature) {
      setError("Sign before saving.");
      return;
    }

    const truckKey = truck.trim().toUpperCase();
    const trailerKey = trailer.trim().toUpperCase();
    const draft = {
      id: newChecklistRecordId(),
      type: "hookup" as const,
      schemaVersion: CHECKLIST_SCHEMA_VERSION,
      status: "completed" as const,
      completedAtUtc: new Date().toISOString(),
      items: HOOKUP_SCHEMA.map((item) => ({
        code: item.code,
        label: item.label,
        kind: "pass_fail" as const,
        value: items[item.code]!.value,
        defect: null,
      })),
      signatures: [{ ...signature, role: "driver" as const }],
      header: {
        driver_name: (driverName || "").trim() || undefined,
        truck_rego: truckKey,
        trailer_rego: trailerKey,
        combination: `${truckKey} + ${trailerKey}`,
        faults_and_observations: observations.trim() || undefined,
      },
    };

    const validated = validateCompletedChecklistRecord(draft);
    if (!validated.ok) {
      setError(validated.errors[0]?.message ?? "Could not save checklist.");
      return;
    }
    setSaving(true);
    try {
      await Promise.resolve(onCompleted(validated.record));
      reset();
      onClose();
    } catch {
      setError("Could not save on this device. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ChecklistModalShell
      open={open}
      onClose={handleClose}
      title={HOOKUP_FORM_TITLE}
      subtitle={
        primeMoverReminder
          ? `${HOOKUP_PRIME_MOVER_REMINDER_LABEL}. Optional — ticks the week PDF when signed`
          : "Optional — ticks the week PDF when signed"
      }
      footer={
        <div className="space-y-2">
          {error ? <p className="text-center text-xs text-ck-red">{error}</p> : null}
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void handleSave()}
            className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-ck-cobalt text-sm font-bold text-ck-on-accent disabled:opacity-40"
          >
            {saving ? "Saving…" : `Save ${HOOKUP_FORM_TITLE}`}
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        {primeMoverReminder ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium leading-relaxed text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            {HOOKUP_PRIME_MOVER_REMINDER_HINT}
          </p>
        ) : null}
        <p className="text-xs text-ck-steel leading-relaxed">{HOOKUP_PROCEDURE_NOTE}</p>

        <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate p-3">
          <h3 className="text-sm font-bold text-ck-steel">Vehicle details</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-xs text-ck-steel">Vehicle rego</span>
              <input
                value={truck}
                onChange={(e) => setTruck(e.target.value)}
                autoCapitalize="characters"
                className="w-full min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm font-semibold uppercase text-ck-fg"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ck-steel">Trailer rego</span>
              <input
                value={trailer}
                onChange={(e) => setTrailer(e.target.value)}
                autoCapitalize="characters"
                className="w-full min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm font-semibold uppercase text-ck-fg"
              />
            </label>
          </div>
          {(driverName || "").trim() ? (
            <p className="text-xs text-ck-steel">
              Driver: <span className="font-semibold text-ck-fg">{driverName}</span>
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-ck-border bg-ck-slate px-3">
          {HOOKUP_SCHEMA.map((item) => (
            <HookupStepRow
              key={item.code}
              item={item}
              state={items[item.code]!}
              onChange={(next) => setItems((s) => ({ ...s, [item.code]: next }))}
            />
          ))}
        </section>

        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ck-steel">
            {HOOKUP_OBSERVATIONS_LABEL}
          </span>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
            placeholder="Write any faults or observations"
            className="w-full rounded-lg border border-ck-border bg-ck-midnight px-3 py-2 text-sm text-ck-fg"
          />
        </label>

        <p className="text-xs text-ck-steel leading-relaxed">{HOOKUP_SIGN_NOTE}</p>

        <ChecklistSignaturePanel
          title="Driver sign"
          roleLabel="As driver"
          onConfirmed={setSignature}
        />
      </div>
    </ChecklistModalShell>
  );
}
