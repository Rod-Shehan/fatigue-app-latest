"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildPrestartActionedFaultDraft,
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
import { api } from "@/lib/api";
import { ChecklistItemControl } from "./ChecklistItemControl";
import { ChecklistModalShell } from "./ChecklistModalShell";
import { ChecklistSignaturePanel } from "./ChecklistSignaturePanel";

function initPassFailMap(): Record<string, ChecklistPassFailItemState> {
  const m: Record<string, ChecklistPassFailItemState> = {};
  for (const group of PRESTART_SCHEMA_STUB) m[group.code] = emptyPassFailItem();
  return m;
}

type Responsibility = "unset" | "yes" | "no";

/**
 * Voluntary Prestart inspection (Phase 4). Does not gate Start shift.
 * Fault groups feed an actioned-fault text block emailed to workshop contact.
 */
export function PrestartForm({
  open,
  onClose,
  driverName,
  sheetDayLabel,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  driverName?: string | null;
  /** Optional day label for the workshop email subject. */
  sheetDayLabel?: string | null;
  onCompleted: (record: ChecklistRecord) => void;
}) {
  const [responsibility, setResponsibility] = useState<Responsibility>("unset");
  const [skipReason, setSkipReason] = useState("");
  const [items, setItems] = useState(initPassFailMap);
  const [actionedFaultText, setActionedFaultText] = useState("");
  const [faultTextEdited, setFaultTextEdited] = useState(false);
  const [signature, setSignature] = useState<ChecklistSignatureCapture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedDone, setSavedDone] = useState(false);
  const faultFieldRef = useRef<HTMLTextAreaElement | null>(null);

  const allItemsComplete = useMemo(
    () => PRESTART_SCHEMA_STUB.every((g) => isPassFailItemComplete(items[g.code]!)),
    [items]
  );

  const hasUnsafe = useMemo(
    () => PRESTART_SCHEMA_STUB.some((g) => isPassFailItemUnsafe(items[g.code]!)),
    [items]
  );

  const hasFault = useMemo(
    () => PRESTART_SCHEMA_STUB.some((g) => items[g.code]?.value === "fail"),
    [items]
  );

  const faultDraft = useMemo(
    () => buildPrestartActionedFaultDraft(items, PRESTART_SCHEMA_STUB),
    [items]
  );

  useEffect(() => {
    if (!hasFault) {
      setActionedFaultText("");
      setFaultTextEdited(false);
      return;
    }
    if (!faultTextEdited) setActionedFaultText(faultDraft);
  }, [hasFault, faultDraft, faultTextEdited]);

  const canSave =
    responsibility === "yes"
      ? allItemsComplete &&
        !!signature &&
        (!hasFault || Boolean(actionedFaultText.trim()))
      : responsibility === "no"
        ? Boolean(skipReason.trim()) && !!signature
        : false;

  const reset = () => {
    setResponsibility("unset");
    setSkipReason("");
    setItems(initPassFailMap());
    setActionedFaultText("");
    setFaultTextEdited(false);
    setSignature(null);
    setError(null);
    setEmailNote(null);
    setSaving(false);
    setSavedDone(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const focusActionedFault = () => {
    faultFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    faultFieldRef.current?.focus();
  };

  const handleSave = async () => {
    setError(null);
    setEmailNote(null);
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
        actionedFaultText: null,
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
      setError("Complete every inspection item (Pass, Fault with description, or N/A).");
      return;
    }
    if (hasFault && !actionedFaultText.trim()) {
      setError("Add the actioned fault text for the workshop email (above signature).");
      focusActionedFault();
      return;
    }

    const draft = {
      id: newChecklistRecordId(),
      type: "prestart" as const,
      schemaVersion: CHECKLIST_SCHEMA_VERSION,
      status: "completed" as const,
      completedAtUtc: new Date().toISOString(),
      items: PRESTART_SCHEMA_STUB.map((group) => {
        const state = items[group.code]!;
        return {
          code: group.code,
          label: group.label,
          kind: "pass_fail" as const,
          value: state.value,
          defect: state.value === "fail" ? state.defect : null,
        };
      }),
      signatures: [{ ...signature, role: "driver" as const }],
      prestartResponsible: true,
      prestartSkipReason: null,
      actionedFaultText: hasFault ? actionedFaultText.trim() : null,
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
    let note: string | null = null;
    if (hasFault && validated.record.actionedFaultText) {
      try {
        const sent = await api.settings.sendMaintenanceFaultReport({
          faultText: validated.record.actionedFaultText,
          driverName: (driverName || "").trim() || undefined,
          sheetDayLabel: sheetDayLabel?.trim() || undefined,
        });
        note = sent.ok
          ? `Fault report emailed to ${sent.to ?? "workshop contact"}.`
          : `Prestart saved. Workshop email not sent.`;
      } catch (e) {
        const err = e as Error & { body?: { message?: string } };
        const msg = err.body?.message || err.message || "Could not email workshop";
        note = `Prestart saved. Workshop email not sent: ${msg}. Check workshop contact in Settings.`;
      }
    }

    onCompleted(validated.record);
    setSaving(false);
    if (note) {
      setEmailNote(note);
      setSavedDone(true);
      return;
    }
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
              Unsafe-to-drive flagged on one or more faults (recorded; Start shift not blocked in
              trial).
            </p>
          ) : null}
          {emailNote ? (
            <p
              className={`text-center text-xs ${
                savedDone && emailNote.includes("emailed")
                  ? "font-semibold text-ck-emerald"
                  : "text-ck-steel"
              }`}
            >
              {emailNote}
            </p>
          ) : null}
          {error ? <p className="text-center text-xs text-ck-red">{error}</p> : null}
          {savedDone ? (
            <button
              type="button"
              onClick={handleClose}
              className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-ck-cobalt text-sm font-bold text-white"
            >
              Close
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={() => void handleSave()}
              className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-ck-cobalt text-sm font-bold text-white disabled:opacity-40"
            >
              {saving
                ? "Saving…"
                : responsibility === "no"
                  ? "Save — not responsible"
                  : hasFault
                    ? "Save Prestart & email fault"
                    : "Save Prestart"}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <p className="text-xs text-ck-steel leading-relaxed">
          Optional during the trial. If you are the driver who must do the vehicle prestart, complete
          the checks and sign. Mark <strong className="text-slate-200">Fault</strong> where needed —
          then fill the actioned fault text above the signature so workshop can be emailed.
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
          <div className="space-y-3">
            {PRESTART_SCHEMA_STUB.map((group) => (
              <ChecklistItemControl
                key={group.code}
                label={group.label}
                notes={group.notes}
                failLabel="FAULT"
                defectCardTitle="Fault"
                defectDescriptionLabel="Fault description (required)"
                defectDescriptionPlaceholder="Describe the fault"
                state={items[group.code]!}
                onChange={(next) => {
                  setItems((s) => ({ ...s, [group.code]: next }));
                  setFaultTextEdited(false);
                }}
              />
            ))}

            {hasFault ? (
              <section className="space-y-2 rounded-xl border border-ck-red/50 bg-ck-midnight/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-ck-red">Actioned fault</h3>
                  <button
                    type="button"
                    onClick={focusActionedFault}
                    className="min-h-[40px] rounded-lg border border-ck-red bg-ck-red px-3 text-xs font-bold text-white"
                  >
                    Actioned fault
                  </button>
                </div>
                <p className="text-xs text-ck-steel leading-relaxed">
                  This text is emailed to your workshop contact (Settings). Edit if needed — it starts
                  from each Fault description above.
                </p>
                <label className="block space-y-1" htmlFor="prestart-actioned-fault">
                  <span className="text-xs font-semibold text-ck-steel">
                    Fault report for workshop (required)
                  </span>
                  <textarea
                    id="prestart-actioned-fault"
                    ref={faultFieldRef}
                    value={actionedFaultText}
                    onChange={(e) => {
                      setFaultTextEdited(true);
                      setActionedFaultText(e.target.value);
                    }}
                    rows={5}
                    className="w-full rounded-lg border border-ck-border bg-ck-slate px-3 py-2 text-sm text-white placeholder:text-ck-steel/70 focus:outline-none focus:ring-2 focus:ring-ck-cobalt"
                    placeholder="Summarise faults for the maintenance email"
                  />
                </label>
              </section>
            ) : null}

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
