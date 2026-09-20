"use client";

import { useMemo, useState } from "react";
import {
  CHECKLIST_SCHEMA_VERSION,
  emptyAcknowledgeItem,
  FFW_DECLARATION_PREAMBLE,
  FFW_FORM_TITLE,
  FFW_HANDOFF_NOTE,
  buildFfwSchema,
  isAcknowledgeItemComplete,
  newChecklistRecordId,
  validateCompletedChecklistRecord,
  type ChecklistAcknowledgeItemState,
  type ChecklistRecord,
  type ChecklistSignatureCapture,
} from "@/lib/checklist";
import { FFW_REQUIRED_BEFORE_START_LABEL } from "@/lib/product-copy";
import { ChecklistAcknowledgeItem } from "./ChecklistAcknowledgeItem";
import { ChecklistModalShell } from "./ChecklistModalShell";
import { ChecklistSignaturePanel } from "./ChecklistSignaturePanel";

function initAckMap(
  schema: ReturnType<typeof buildFfwSchema>
): Record<string, ChecklistAcknowledgeItemState> {
  const m: Record<string, ChecklistAcknowledgeItemState> = {};
  for (const item of schema) m[item.code] = emptyAcknowledgeItem();
  return m;
}

/**
 * Fitness for Work declaration. Required before Start shift.
 */
export function FitnessForWorkForm({
  open,
  onClose,
  driverName,
  companyName,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  driverName?: string | null;
  /** Organisation legal name — replaces the paper’s company / management wording. */
  companyName?: string | null;
  onCompleted: (record: ChecklistRecord) => void | Promise<void>;
}) {
  const schema = useMemo(() => buildFfwSchema(companyName), [companyName]);
  const [items, setItems] = useState(() => initAckMap(schema));
  const [signature, setSignature] = useState<ChecklistSignatureCapture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allAcked = useMemo(
    () => schema.every((i) => isAcknowledgeItemComplete(items[i.code]!)),
    [items, schema]
  );

  const reset = () => {
    setItems(initAckMap(schema));
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
      items: schema.map((item) => ({
        code: item.code,
        label: [item.label, ...(item.notes ?? [])].join(" "),
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
      title={FFW_FORM_TITLE}
      subtitle={FFW_REQUIRED_BEFORE_START_LABEL}
      footer={
        <div className="space-y-2">
          {error ? <p className="text-center text-xs text-ck-red">{error}</p> : null}
          <button
            type="button"
            disabled={!allAcked || !signature || saving}
            onClick={() => void handleSave()}
            className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-ck-cobalt text-sm font-bold text-ck-on-accent disabled:opacity-40"
          >
            {saving ? "Saving…" : `Save ${FFW_FORM_TITLE}`}
          </button>
        </div>
      }
    >
      <div className="space-y-2 pb-2">
        <p className="text-xs text-ck-steel leading-relaxed">{FFW_HANDOFF_NOTE}</p>
        <p className="text-xs font-semibold text-ck-fg leading-relaxed">{FFW_DECLARATION_PREAMBLE}</p>
        <p className="text-xs text-ck-steel leading-relaxed">
          Acknowledge each point, then sign. Required before Start shift. Completing it ticks Fitness
          for work on the week PDF.
        </p>
        {schema.map((item, index) => (
          <ChecklistAcknowledgeItem
            key={item.code}
            label={`${index + 1}. ${item.label}`}
            notes={item.notes}
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
