"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CHECKLIST_SCHEMA_VERSION,
  emptyPassFailItem,
  HOOKUP_FORM_TITLE,
  HOOKUP_SCHEMA,
  HOOKUP_SOURCE_NOTE,
  isPassFailItemComplete,
  lastHookupFromRecords,
  newChecklistRecordId,
  validateCompletedChecklistRecord,
  type ChecklistPassFailItemState,
  type ChecklistRecord,
  type ChecklistSignatureCapture,
} from "@/lib/checklist";
import { ChecklistItemControl } from "./ChecklistItemControl";
import { ChecklistModalShell } from "./ChecklistModalShell";
import { ChecklistSignaturePanel } from "./ChecklistSignaturePanel";

function initPassFailMap(): Record<string, ChecklistPassFailItemState> {
  const m: Record<string, ChecklistPassFailItemState> = {};
  for (const item of HOOKUP_SCHEMA) m[item.code] = emptyPassFailItem();
  return m;
}

/**
 * Voluntary hook-up check. Multi-complete allowed. Not a week-PDF tick.
 * Paper “Initial?” is the driver signature.
 */
export function HookupForm({
  open,
  onClose,
  driverName,
  truckRego,
  trailerRego,
  previousHookupRecords,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  driverName?: string | null;
  truckRego?: string | null;
  trailerRego?: string | null;
  previousHookupRecords?: ChecklistRecord[] | null;
  onCompleted: (record: ChecklistRecord) => void | Promise<void>;
}) {
  const [truck, setTruck] = useState("");
  const [trailer, setTrailer] = useState("");
  const [items, setItems] = useState(initPassFailMap);
  const [signature, setSignature] = useState<ChecklistSignatureCapture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allItemsComplete = useMemo(
    () =>
      HOOKUP_SCHEMA.every((item) =>
        isPassFailItemComplete(items[item.code]!, { naAllowed: item.naAllowed === true })
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
      setError("Mark every step before saving. Fault needs a short description.");
      return;
    }
    if (!signature) {
      setError("Confirm your initial before saving.");
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
        label: [item.label, ...(item.notes ?? [])].join(" — "),
        kind: "pass_fail" as const,
        value: items[item.code]!.value,
        defect: items[item.code]!.defect ?? null,
      })),
      signatures: [{ ...signature, role: "driver" as const }],
      header: {
        driver_name: (driverName || "").trim() || undefined,
        truck_rego: truckKey,
        trailer_rego: trailerKey,
        combination: `${truckKey} + ${trailerKey}`,
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
      subtitle="Optional — does not tick the week PDF"
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
      <div className="space-y-4 pb-2">
        <p className="text-xs text-ck-steel leading-relaxed">{HOOKUP_SOURCE_NOTE}</p>

        <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate p-3">
          <h3 className="text-sm font-bold text-ck-steel">This hook-up</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-xs text-ck-steel">Truck</span>
              <input
                value={truck}
                onChange={(e) => setTruck(e.target.value)}
                autoCapitalize="characters"
                className="w-full min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm font-semibold uppercase text-ck-fg"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ck-steel">Trailer</span>
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

        {HOOKUP_SCHEMA.map((item) => (
          <ChecklistItemControl
            key={item.code}
            label={item.label}
            notes={item.notes}
            naAllowed={item.naAllowed === true}
            passLabel="OK"
            failLabel="FAULT"
            defectCardTitle="Fault"
            defectDescriptionLabel="Fault description (required)"
            defectDescriptionPlaceholder="Describe the fault"
            state={items[item.code]!}
            onChange={(next) => setItems((s) => ({ ...s, [item.code]: next }))}
          />
        ))}

        <ChecklistSignaturePanel
          title="Initial"
          roleLabel="As driver"
          onConfirmed={setSignature}
        />
      </div>
    </ChecklistModalShell>
  );
}
