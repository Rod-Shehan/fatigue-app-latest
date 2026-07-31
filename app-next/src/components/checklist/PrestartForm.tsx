"use client";

import { useMemo, useState } from "react";
import {
  CHECKLIST_SCHEMA_VERSION,
  emptyPassFailItem,
  isPassFailItemComplete,
  isPassFailItemUnsafe,
  newChecklistRecordId,
  PRESTART_SCHEMA_STUB,
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
  for (const group of PRESTART_SCHEMA_STUB) {
    for (const item of group.items) m[item.code] = emptyPassFailItem();
  }
  return m;
}

type Responsibility = "unset" | "yes" | "no";

/**
 * Voluntary Prestart inspection (Phase 4). Does not gate Start shift.
 * Includes responsibility question for two-up / not-my-prestart (scope L).
 */
export function PrestartForm({
  open,
  onClose,
  driverName,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  driverName?: string | null;
  onCompleted: (record: ChecklistRecord) => void;
}) {
  const [responsibility, setResponsibility] = useState<Responsibility>("unset");
  const [skipReason, setSkipReason] = useState("");
  const [items, setItems] = useState(initPassFailMap);
  const [signature, setSignature] = useState<ChecklistSignatureCapture | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allItemsComplete = useMemo(
    () =>
      PRESTART_SCHEMA_STUB.every((g) =>
        g.items.every((i) => isPassFailItemComplete(items[i.code]!))
      ),
    [items]
  );

  const hasUnsafe = useMemo(
    () =>
      PRESTART_SCHEMA_STUB.some((g) =>
        g.items.some((i) => isPassFailItemUnsafe(items[i.code]!))
      ),
    [items]
  );

  const canSave =
    responsibility === "yes"
      ? allItemsComplete && !!signature
      : responsibility === "no"
        ? Boolean(skipReason.trim()) && !!signature
        : false;

  const reset = () => {
    setResponsibility("unset");
    setSkipReason("");
    setItems(initPassFailMap());
    setSignature(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = () => {
    setError(null);
    if (responsibility === "unset") {
      setError("Say whether you are responsible for this prestart.");
      return;
    }
    if (!signature) {
      setError("Confirm your signature before saving.");
      return;
    }

    if (responsibility === "no") {
      if (!skipReason.trim()) {
        setError("Add a short reason (for example: second driver — other driver did prestart).");
        return;
      }
      const draft = {
        id: newChecklistRecordId(),
        type: "prestart" as const,
        schemaVersion: CHECKLIST_SCHEMA_VERSION,
        status: "completed" as const,
        completedAtUtc: new Date().toISOString(),
        items: [] as ChecklistRecord["items"],
        signatures: [{ ...signature, role: "driver" as const }],
        prestartResponsible: false,
        prestartSkipReason: skipReason.trim(),
        header: {
          driver_name: (driverName || "").trim() || undefined,
        },
      };
      const validated = validateCompletedChecklistRecord(draft);
      if (!validated.ok) {
        setError(validated.errors[0]?.message ?? "Could not save checklist.");
        return;
      }
      onCompleted(validated.record);
      reset();
      onClose();
      return;
    }

    if (!allItemsComplete) {
      setError("Complete every inspection item (Pass, Fail with defect text, or N/A).");
      return;
    }

    const draft = {
      id: newChecklistRecordId(),
      type: "prestart" as const,
      schemaVersion: CHECKLIST_SCHEMA_VERSION,
      status: "completed" as const,
      completedAtUtc: new Date().toISOString(),
      items: PRESTART_SCHEMA_STUB.flatMap((group) =>
        group.items.map((item) => {
          const state = items[item.code]!;
          return {
            code: item.code,
            label: item.label,
            kind: "pass_fail" as const,
            value: state.value,
            defect: state.value === "fail" ? state.defect : null,
          };
        })
      ),
      signatures: [{ ...signature, role: "driver" as const }],
      prestartResponsible: true,
      prestartSkipReason: null,
      header: {
        driver_name: (driverName || "").trim() || undefined,
      },
    };

    const validated = validateCompletedChecklistRecord(draft);
    if (!validated.ok) {
      setError(validated.errors[0]?.message ?? "Could not save checklist.");
      return;
    }
    onCompleted(validated.record);
    reset();
    onClose();
  };

  return (
    <ChecklistModalShell
      open={open}
      onClose={handleClose}
      title="Prestart inspection"
      subtitle="Optional — does not block Start shift"
      footer={
        <div className="space-y-2">
          {hasUnsafe && responsibility === "yes" ? (
            <p className="text-center text-xs font-semibold text-ck-red">
              Unsafe-to-drive flagged on one or more defects (recorded; Start shift not blocked in
              trial).
            </p>
          ) : null}
          {error ? <p className="text-center text-xs text-ck-red">{error}</p> : null}
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-ck-cobalt text-sm font-bold text-white disabled:opacity-40"
          >
            {responsibility === "no" ? "Save — not responsible" : "Save Prestart"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <p className="text-xs text-ck-steel leading-relaxed">
          Optional during the trial. If you are the driver who must do the vehicle prestart, complete
          the checks and sign. Two-up second drivers who are not responsible can record that instead —
          without inventing answers for someone else.
        </p>

        <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate p-3">
          <h3 className="text-sm font-bold text-ck-steel">
            Are you responsible for doing the prestart?
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setResponsibility("yes");
                setSkipReason("");
                setError(null);
              }}
              className={`min-h-[44px] rounded-lg border text-sm font-bold ${
                responsibility === "yes"
                  ? "border-ck-cobalt bg-ck-cobalt text-white"
                  : "border-ck-border bg-ck-midnight text-ck-steel"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => {
                setResponsibility("no");
                setError(null);
              }}
              className={`min-h-[44px] rounded-lg border text-sm font-bold ${
                responsibility === "no"
                  ? "border-ck-cobalt bg-ck-cobalt text-white"
                  : "border-ck-border bg-ck-midnight text-ck-steel"
              }`}
            >
              No
            </button>
          </div>
        </section>

        {responsibility === "no" ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-ck-steel" htmlFor="prestart-skip-reason">
              Why not? (required)
            </label>
            <textarea
              id="prestart-skip-reason"
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              rows={3}
              placeholder="e.g. Two-up — other driver completed the prestart"
              className="w-full rounded-lg border border-ck-border bg-ck-midnight px-3 py-2 text-sm text-white placeholder:text-ck-steel/70"
            />
            <ChecklistSignaturePanel
              title="Driver signature"
              roleLabel="Confirming I am not responsible for this prestart"
              onConfirmed={setSignature}
            />
          </div>
        ) : null}

        {responsibility === "yes" ? (
          <div className="space-y-4">
            {PRESTART_SCHEMA_STUB.map((group) => (
              <section key={group.code} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ck-cobalt">
                  {group.label}
                </h3>
                {group.items.map((item) => (
                  <ChecklistItemControl
                    key={item.code}
                    label={item.label}
                    state={items[item.code]!}
                    onChange={(next) => setItems((s) => ({ ...s, [item.code]: next }))}
                  />
                ))}
              </section>
            ))}
            <ChecklistSignaturePanel
              title="Driver signature"
              roleLabel="As driver responsible for prestart"
              onConfirmed={setSignature}
            />
          </div>
        ) : null}
      </div>
    </ChecklistModalShell>
  );
}
