"use client";

import { useMemo, useState } from "react";
import {
  CHECKLIST_SCHEMA_VERSION,
  emptyAcknowledgeItem,
  FFW_SCHEMA_STUB,
  isAcknowledgeItemComplete,
  newChecklistRecordId,
  validateCompletedChecklistRecord,
  type ChecklistAcknowledgeItemState,
  type ChecklistRecord,
  type ChecklistSignatureCapture,
} from "@/lib/checklist";
import { ChecklistAcknowledgeItem } from "./ChecklistAcknowledgeItem";
import { ChecklistModalShell } from "./ChecklistModalShell";
import { ChecklistSignaturePanel } from "./ChecklistSignaturePanel";

function initAckMap(): Record<string, ChecklistAcknowledgeItemState> {
  const m: Record<string, ChecklistAcknowledgeItemState> = {};
  for (const item of FFW_SCHEMA_STUB) m[item.code] = emptyAcknowledgeItem();
  return m;
}

/**
 * Voluntary Fitness for Work form (Phase 3). Does not gate Start shift.
 */
export function FitnessForWorkForm({
  open,
  onClose,
  driverName,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  driverName?: string | null;
  onCompleted: (record: ChecklistRecord) => void | Promise<void>;
}) {
  const [items, setItems] = useState(initAckMap);
  const [signature, setSignature] = useState<ChecklistSignatureCapture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allAcked = useMemo(
    () => FFW_SCHEMA_STUB.every((i) => isAcknowledgeItemComplete(items[i.code]!)),
    [items]
  );

  const reset = () => {
    setItems(initAckMap());
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
    if (!allAcked) {
      setError("Acknowledge all points before saving.");
      return;
    }
    if (!signature) {
      setError("Confirm your signature before saving.");
      return;
    }

    const draft = {
      id: newChecklistRecordId(),
      type: "ffw" as const,
      schemaVersion: CHECKLIST_SCHEMA_VERSION,
      status: "completed" as const,
      completedAtUtc: new Date().toISOString(),
      items: FFW_SCHEMA_STUB.map((item) => ({
        code: item.code,
        label: item.label,
        kind: "acknowledge" as const,
        value: items[item.code]!.value,
      })),
      signatures: [{ ...signature, role: "driver" as const }],
      header: {
        driver_name: (driverName || "").trim() || undefined,
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
      title="Fitness for Work"
      subtitle="Optional — does not block Start shift"
      footer={
        <div className="space-y-2">
          {error ? <p className="text-center text-xs text-ck-red">{error}</p> : null}
          <button
            type="button"
            disabled={!allAcked || !signature || saving}
            onClick={() => void handleSave()}
            className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-ck-cobalt text-sm font-bold text-ck-on-accent disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Fitness for Work"}
          </button>
        </div>
      }
    >
      <div className="space-y-2 pb-2">
        <p className="text-xs text-ck-steel leading-relaxed">
          Acknowledge each point, then sign. This is optional during the trial. Completing it ticks
          Fitness for work on the week PDF.
        </p>
        {FFW_SCHEMA_STUB.map((item) => (
          <ChecklistAcknowledgeItem
            key={item.code}
            label={item.label}
            state={items[item.code]!}
            onChange={(next) => setItems((s) => ({ ...s, [item.code]: next }))}
          />
        ))}
        <ChecklistSignaturePanel
          title="Driver signature"
          roleLabel="As driver"
          onConfirmed={setSignature}
        />
      </div>
    </ChecklistModalShell>
  );
}
