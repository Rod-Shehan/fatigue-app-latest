"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CHECKLIST_SCHEMA_VERSION,
  FAULT_REPORT_DRIVER_NOTE,
  FAULT_REPORT_FORM_TITLE,
  FAULT_REPORT_PLANT_LABEL,
  FAULT_REPORT_PLANTS,
  FAULT_REPORT_READING_UNIT_LABEL,
  FAULT_REPORT_READING_UNITS,
  FAULT_REPORT_SEVERITY_LABEL,
  FAULT_REPORT_SEVERITY_TO_MOBILITY,
  FAULT_REPORT_SEVERITIES,
  FAULT_REPORT_WORKSHOP_NOTE,
  formatPerthDateTimeLocal,
  newChecklistRecordId,
  perthDateTimeLocalNow,
  validateCompletedChecklistRecord,
  type ChecklistRecord,
  type ChecklistSignatureCapture,
  type FaultReportPlant,
  type FaultReportReadingUnit,
  type FaultReportSeverity,
} from "@/lib/checklist";
import { cn } from "@/lib/utils";
import { ChecklistModalShell } from "./ChecklistModalShell";
import { ChecklistSignaturePanel } from "./ChecklistSignaturePanel";

const inputClass =
  "w-full min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm text-ck-fg";

/**
 * WAHVA maintenance Fault report. Opened from Forms on the day card. Persist type is `fault_report`.
 * Workshop repair block is shown for the paper shape; driver save does not fill it.
 */
export function FaultReportForm({
  open,
  onClose,
  driverName,
  vehicleRego,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  driverName?: string | null;
  vehicleRego?: string | null;
  onCompleted: (record: ChecklistRecord) => void | Promise<void>;
}) {
  const [plant, setPlant] = useState<FaultReportPlant>("vehicle");
  const [fleetUnit, setFleetUnit] = useState("");
  const [rego, setRego] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [readingUnit, setReadingUnit] = useState<FaultReportReadingUnit>("odometer_km");
  const [reading, setReading] = useState("");
  const [identifiedAt, setIdentifiedAt] = useState(() => perthDateTimeLocalNow());
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<FaultReportSeverity | null>(null);
  const [signature, setSignature] = useState<ChecklistSignatureCapture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(
    () =>
      Boolean(fleetUnit.trim()) &&
      Boolean(rego.trim()) &&
      Boolean(makeModel.trim()) &&
      Boolean(reading.trim()) &&
      Boolean(identifiedAt.trim()) &&
      Boolean(description.trim()) &&
      severity != null &&
      !!signature,
    [fleetUnit, rego, makeModel, reading, identifiedAt, description, severity, signature]
  );

  useEffect(() => {
    if (!open) return;
    setRego((prev) => prev || (vehicleRego || "").trim());
  }, [open, vehicleRego]);

  const reset = () => {
    setPlant("vehicle");
    setFleetUnit("");
    setRego("");
    setMakeModel("");
    setReadingUnit("odometer_km");
    setReading("");
    setIdentifiedAt(perthDateTimeLocalNow());
    setDescription("");
    setSeverity(null);
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
    if (!fleetUnit.trim() || !rego.trim() || !makeModel.trim()) {
      setError("Enter fleet unit, registration, and make / model.");
      return;
    }
    if (!reading.trim() || !identifiedAt.trim()) {
      setError("Enter the odometer or hour reading and when the fault was identified.");
      return;
    }
    if (!description.trim() || !severity) {
      setError("Describe the fault and choose a fault level.");
      return;
    }
    if (!signature) {
      setError("Sign before saving.");
      return;
    }

    const plantRego = rego.trim().toUpperCase();
    const draft = {
      id: newChecklistRecordId(),
      type: "fault_report" as const,
      schemaVersion: CHECKLIST_SCHEMA_VERSION,
      status: "completed" as const,
      completedAtUtc: new Date().toISOString(),
      items: [
        {
          code: "fault_description",
          label: "Fault description",
          kind: "pass_fail" as const,
          value: "fail" as const,
          defect: {
            description: description.trim(),
            photoDataUrls: [] as string[],
            mobilityStatus: FAULT_REPORT_SEVERITY_TO_MOBILITY[severity],
          },
        },
      ],
      signatures: [{ ...signature, role: "driver" as const }],
      header: {
        driver_name: (driverName || "").trim() || undefined,
        plant,
        fleet_unit: fleetUnit.trim().toUpperCase(),
        vehicle_rego: plantRego,
        make_model: makeModel.trim(),
        operational_reading: reading.trim(),
        reading_unit: readingUnit,
        identified_at_local: identifiedAt.trim(),
        identified_at_awst: formatPerthDateTimeLocal(identifiedAt),
        severity,
        severity_label: FAULT_REPORT_SEVERITY_LABEL[severity],
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
      title={FAULT_REPORT_FORM_TITLE}
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
            {saving ? "Saving…" : `Save ${FAULT_REPORT_FORM_TITLE}`}
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        <p className="text-xs text-ck-steel leading-relaxed">{FAULT_REPORT_DRIVER_NOTE}</p>

        <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate p-3">
          <h3 className="text-sm font-bold text-ck-steel">Vehicle identification</h3>
          <div className="grid grid-cols-3 gap-1">
            {FAULT_REPORT_PLANTS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={plant === p}
                onClick={() => setPlant(p)}
                className={cn(
                  "min-h-[40px] rounded-md border px-1 text-[11px] font-bold",
                  plant === p
                    ? "border-ck-cobalt bg-ck-cobalt text-ck-on-accent"
                    : "border-ck-border bg-ck-midnight/40 text-ck-steel"
                )}
              >
                {FAULT_REPORT_PLANT_LABEL[p]}
              </button>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-ck-steel">Fleet unit number</span>
            <input
              value={fleetUnit}
              onChange={(e) => setFleetUnit(e.target.value)}
              autoCapitalize="characters"
              className={`${inputClass} font-semibold uppercase`}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ck-steel">Registration / plate</span>
            <input
              value={rego}
              onChange={(e) => setRego(e.target.value)}
              autoCapitalize="characters"
              placeholder={(vehicleRego || "").trim() || undefined}
              className={`${inputClass} font-semibold uppercase`}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ck-steel">Make / model</span>
            <input
              value={makeModel}
              onChange={(e) => setMakeModel(e.target.value)}
              className={inputClass}
            />
          </label>
        </section>

        <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate p-3">
          <h3 className="text-sm font-bold text-ck-steel">Operational reading</h3>
          <div className="grid grid-cols-2 gap-1">
            {FAULT_REPORT_READING_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={readingUnit === u}
                onClick={() => setReadingUnit(u)}
                className={cn(
                  "min-h-[40px] rounded-md border px-1 text-[11px] font-bold",
                  readingUnit === u
                    ? "border-ck-cobalt bg-ck-cobalt text-ck-on-accent"
                    : "border-ck-border bg-ck-midnight/40 text-ck-steel"
                )}
              >
                {FAULT_REPORT_READING_UNIT_LABEL[u]}
              </button>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-ck-steel">
              {FAULT_REPORT_READING_UNIT_LABEL[readingUnit]} at time of report
            </span>
            <input
              value={reading}
              onChange={(e) => setReading(e.target.value)}
              inputMode="decimal"
              className={`${inputClass} tabular-nums`}
            />
          </label>
        </section>

        <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate p-3">
          <h3 className="text-sm font-bold text-ck-steel">When identified</h3>
          <label className="block space-y-1">
            <span className="text-xs text-ck-steel">Date and time (Perth)</span>
            <input
              type="datetime-local"
              value={identifiedAt}
              onChange={(e) => setIdentifiedAt(e.target.value)}
              className={inputClass}
            />
          </label>
          {(driverName || "").trim() ? (
            <p className="text-xs text-ck-steel">
              Reporter: <span className="font-semibold text-ck-fg">{driverName}</span>
            </p>
          ) : null}
        </section>

        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ck-steel">
            Fault description
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Specific details of the defect, malfunction, or area of concern"
            className="w-full rounded-lg border border-ck-border bg-ck-midnight px-3 py-2 text-sm text-ck-fg"
          />
        </label>

        <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate p-3">
          <h3 className="text-sm font-bold text-ck-steel">
            Fault level{" "}
            <span className="font-normal text-ck-steel">(pick one; selected turns green / amber / red)</span>
          </h3>
          <div className="grid grid-cols-1 gap-1">
            {FAULT_REPORT_SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={severity === s}
                onClick={() => setSeverity(s)}
                className={cn(
                  "min-h-[44px] rounded-md border px-3 text-left text-sm font-semibold",
                  severity === s
                    ? s === "inoperable"
                      ? "border-ck-red bg-ck-red text-ck-on-accent"
                      : s === "restricted"
                        ? "border-amber-500 bg-amber-500 text-ck-midnight"
                        : "border-ck-emerald bg-ck-emerald text-ck-on-accent"
                    : "border-ck-border bg-ck-midnight/40 text-ck-fg"
                )}
              >
                {FAULT_REPORT_SEVERITY_LABEL[s]}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate/60 p-3">
          <h3 className="text-sm font-bold text-ck-steel">Action taken / repair</h3>
          <p className="text-xs text-ck-steel leading-relaxed">{FAULT_REPORT_WORKSHOP_NOTE}</p>
          <label className="block space-y-1">
            <span className="text-xs text-ck-steel">Parts used</span>
            <textarea disabled rows={2} className={`${inputClass} min-h-[64px] opacity-60`} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ck-steel">Work completed</span>
            <textarea disabled rows={2} className={`${inputClass} min-h-[64px] opacity-60`} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ck-steel">Date repaired</span>
            <input disabled className={`${inputClass} opacity-60`} />
          </label>
          <p className="text-xs text-ck-steel">Certifying mechanic signature / authorisation</p>
          <div className="h-16 rounded-lg border border-dashed border-ck-border bg-ck-midnight/40" />
        </section>

        <ChecklistSignaturePanel title="Driver / operator sign" roleLabel="As driver" onConfirmed={setSignature} />
      </div>
    </ChecklistModalShell>
  );
}
