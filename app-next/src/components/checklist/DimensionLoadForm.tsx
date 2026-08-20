"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CHECKLIST_MAX_EVIDENCE_PHOTOS,
  CHECKLIST_SCHEMA_VERSION,
  emptyPassFailItem,
  isPassFailItemComplete,
  LOAD_SCHEMA_STUB,
  lastLoadCombinationFromRecords,
  newChecklistRecordId,
  serializeLoadCombinationHeader,
  validateCompletedChecklistRecord,
  type ChecklistLoaderPath,
  type ChecklistPassFailItemState,
  type ChecklistRecord,
  type ChecklistSignatureCapture,
  type LoadCombinationUnit,
} from "@/lib/checklist";
import { ChecklistItemControl } from "./ChecklistItemControl";
import { ChecklistModalShell } from "./ChecklistModalShell";
import { ChecklistSignaturePanel } from "./ChecklistSignaturePanel";

function initPassFailMap(): Record<string, ChecklistPassFailItemState> {
  const m: Record<string, ChecklistPassFailItemState> = {};
  for (const item of LOAD_SCHEMA_STUB) m[item.code] = emptyPassFailItem();
  return m;
}

type SelfLoad = "unset" | "yes" | "no";
type KnowLoader = "unset" | "present" | "pending" | "unknown";

function resolveLoaderPath(
  selfLoad: SelfLoad,
  knowLoader: KnowLoader
): ChecklistLoaderPath | null {
  if (selfLoad === "yes") return "self_as_loader";
  if (selfLoad !== "no") return null;
  if (knowLoader === "present") return "present";
  if (knowLoader === "pending") return "pending";
  if (knowLoader === "unknown") return "not_obtained";
  return null;
}

/**
 * Voluntary Dimension & Load check (Phase 5). Multi-complete allowed; no post-load gate in trial.
 * Driver and loader CoR stay separate — no proxy loader signature.
 */
export function DimensionLoadForm({
  open,
  onClose,
  driverName,
  truckRego,
  trailerRego,
  previousLoadRecords,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  driverName?: string | null;
  truckRego?: string | null;
  trailerRego?: string | null;
  /** Earlier load checks today — prefills combination for Add another. */
  previousLoadRecords?: ChecklistRecord[] | null;
  onCompleted: (record: ChecklistRecord) => void | Promise<void>;
}) {
  const [client, setClient] = useState("");
  const [loadType, setLoadType] = useState("");
  const [loadWeight, setLoadWeight] = useState("");
  const [truck, setTruck] = useState("");
  const [units, setUnits] = useState<LoadCombinationUnit[]>([{ role: "trailer", rego: "" }]);
  const [selfLoad, setSelfLoad] = useState<SelfLoad>("unset");
  const [knowLoader, setKnowLoader] = useState<KnowLoader>("unset");
  const [loaderName, setLoaderName] = useState("");
  const [items, setItems] = useState(initPassFailMap);
  const [driverSig, setDriverSig] = useState<ChecklistSignatureCapture | null>(null);
  const [loaderSig, setLoaderSig] = useState<ChecklistSignatureCapture | null>(null);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sigResetKey, setSigResetKey] = useState(0);
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const last = lastLoadCombinationFromRecords(previousLoadRecords);
    setTruck(last?.truckRego || (truckRego || "").trim());
    if (last?.units.length) {
      setUnits(last.units);
    } else {
      const seeded = (trailerRego || "").trim();
      setUnits([{ role: "trailer", rego: seeded }]);
    }
    // Seed once per open so Add another can change trailers without the list resetting.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot on open
  }, [open]);

  const loaderPath = resolveLoaderPath(selfLoad, knowLoader);

  const allItemsComplete = useMemo(
    () => LOAD_SCHEMA_STUB.every((i) => isPassFailItemComplete(items[i.code]!)),
    [items]
  );

  const needsLoaderName = loaderPath === "present" || loaderPath === "pending";
  const needsLoaderSig = loaderPath === "present" || loaderPath === "self_as_loader";
  const needsEvidence = loaderPath === "not_obtained";

  const canSave =
    !!loaderPath &&
    allItemsComplete &&
    !!driverSig &&
    (!needsLoaderName || Boolean(loaderName.trim())) &&
    (!needsLoaderSig || !!loaderSig) &&
    (!needsEvidence || evidencePhotos.length >= 1) &&
    (Boolean(truck.trim()) || units.some((u) => u.rego.trim()));

  const reset = () => {
    setClient("");
    setLoadType("");
    setLoadWeight("");
    setTruck("");
    setUnits([{ role: "trailer", rego: "" }]);
    setSelfLoad("unset");
    setKnowLoader("unset");
    setLoaderName("");
    setItems(initPassFailMap());
    setDriverSig(null);
    setLoaderSig(null);
    setEvidencePhotos([]);
    setError(null);
    setSigResetKey((k) => k + 1);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    setError(null);
    if (!loaderPath) {
      setError("Say whether you loaded, and how loader CoR will be recorded.");
      return;
    }
    if (!allItemsComplete) {
      setError("Complete every load check (Yes, No with notes, or N/A).");
      return;
    }
    if (needsLoaderName && !loaderName.trim()) {
      setError("Enter the loader’s name (do not invent a signature for them).");
      return;
    }
    if (!driverSig) {
      setError("Confirm your As driver signature before saving.");
      return;
    }
    if (needsLoaderSig && !loaderSig) {
      setError(
        loaderPath === "self_as_loader"
          ? "Confirm a separate As loader signature (dual function — two sign-offs)."
          : "Loader must sign As loader while present (no proxy)."
      );
      return;
    }
    if (needsEvidence && evidencePhotos.length < 1) {
      setError("Add at least one photo when loader CoR acknowledgment is not obtained.");
      return;
    }
    if (!truck.trim() && !units.some((u) => u.rego.trim())) {
      setError("Enter the prime mover and every trailer or dolly on this load.");
      return;
    }

    const signatures: ChecklistRecord["signatures"] = [
      { ...driverSig, role: "driver" },
    ];
    if (needsLoaderSig && loaderSig) {
      signatures.push({ ...loaderSig, role: "loader" });
    }

    const draft = {
      id: newChecklistRecordId(),
      type: "dimension_load" as const,
      schemaVersion: CHECKLIST_SCHEMA_VERSION,
      status: "completed" as const,
      completedAtUtc: new Date().toISOString(),
      items: LOAD_SCHEMA_STUB.map((item) => {
        const state = items[item.code]!;
        return {
          code: item.code,
          label: item.label,
          kind: "pass_fail" as const,
          value: state.value,
          defect: state.value === "fail" ? state.defect : null,
        };
      }),
      signatures,
      loaderPath,
      loaderName:
        loaderPath === "self_as_loader"
          ? (driverName || "").trim() || "Driver (self-loaded)"
          : needsLoaderName
            ? loaderName.trim()
            : null,
      header: serializeLoadCombinationHeader({
        truckRego: truck,
        units,
        client,
        driverName: driverName || "",
        loadType,
        loadWeight,
      }),
      evidencePhotoDataUrls: needsEvidence ? evidencePhotos : undefined,
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
      title="Dimension & Load"
      subtitle="Optional — does not block leaving load or Start shift"
      footer={
        <div className="space-y-2">
          {error ? <p className="text-center text-xs text-ck-red">{error}</p> : null}
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void handleSave()}
            className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-ck-cobalt text-sm font-bold text-ck-on-accent disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Dimension & Load"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <p className="text-xs text-ck-steel leading-relaxed">
          Optional during the trial. One form = one load. Use Add another for the next load on this
          shift. This check is for the <strong className="text-ck-fg">loaded combination</strong>{" "}
          (trailer or dolly when used) — not only the prime mover. A driver cannot sign for the
          loader — use present sign, pending, or photo gap.
        </p>

        <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate p-3">
          <h3 className="text-sm font-bold text-ck-steel">Load details</h3>
          <label className="block space-y-1">
            <span className="text-xs text-ck-steel">Client</span>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm text-ck-fg"
            />
          </label>
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-xs text-ck-steel">Prime mover / rigid</span>
              <input
                value={truck}
                onChange={(e) => setTruck(e.target.value)}
                autoCapitalize="characters"
                className="w-full min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm font-semibold uppercase text-ck-fg"
              />
            </label>
            <p className="text-xs text-ck-steel leading-relaxed">
              Add every trailer or dolly on <strong className="text-ck-fg">this</strong> load. Leave
              empty only if the load sits on this rigid / prime.
            </p>
            {units.map((unit, i) => (
              <div key={`${unit.role}-${i}`} className="grid grid-cols-[7rem_1fr_auto] gap-2">
                <select
                  value={unit.role}
                  onChange={(e) => {
                    const role = e.target.value === "dolly" ? "dolly" : "trailer";
                    setUnits((prev) => prev.map((u, j) => (j === i ? { ...u, role } : u)));
                  }}
                  className="min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-2 text-xs font-semibold text-ck-fg"
                >
                  <option value="trailer">Trailer</option>
                  <option value="dolly">Dolly</option>
                </select>
                <input
                  value={unit.rego}
                  onChange={(e) =>
                    setUnits((prev) =>
                      prev.map((u, j) => (j === i ? { ...u, rego: e.target.value } : u))
                    )
                  }
                  autoCapitalize="characters"
                  className="min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm font-semibold uppercase text-ck-fg"
                  placeholder="Rego"
                />
                <button
                  type="button"
                  onClick={() => setUnits((prev) => prev.filter((_, j) => j !== i))}
                  className="min-h-[44px] min-w-[44px] rounded-lg border border-ck-border text-ck-steel text-lg"
                  aria-label="Remove unit"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUnits((prev) => [...prev, { role: "trailer", rego: "" }])}
                className="min-h-[44px] rounded-lg border border-ck-border text-sm font-semibold text-ck-fg"
              >
                Add trailer
              </button>
              <button
                type="button"
                onClick={() => setUnits((prev) => [...prev, { role: "dolly", rego: "" }])}
                className="min-h-[44px] rounded-lg border border-ck-border text-sm font-semibold text-ck-fg"
              >
                Add dolly
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-xs text-ck-steel">Load type</span>
              <input
                value={loadType}
                onChange={(e) => setLoadType(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm text-ck-fg"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ck-steel">Load weight</span>
              <input
                value={loadWeight}
                onChange={(e) => setLoadWeight(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm text-ck-fg"
              />
            </label>
          </div>
          {(driverName || "").trim() ? (
            <p className="text-xs text-ck-steel">
              Driver: <span className="font-semibold text-ck-fg">{driverName}</span>
            </p>
          ) : null}
        </section>

        <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate p-3">
          <h3 className="text-sm font-bold text-ck-steel">Did you also load this vehicle?</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setSelfLoad("yes");
                setKnowLoader("unset");
                setLoaderName("");
                setLoaderSig(null);
                setEvidencePhotos([]);
                setError(null);
                setSigResetKey((k) => k + 1);
              }}
              className={`min-h-[44px] rounded-lg border text-sm font-bold ${
                selfLoad === "yes"
                  ? "border-ck-cobalt bg-ck-cobalt text-ck-on-accent"
                  : "border-ck-border bg-ck-midnight text-ck-steel"
              }`}
            >
              Yes — I loaded it
            </button>
            <button
              type="button"
              onClick={() => {
                setSelfLoad("no");
                setError(null);
                setSigResetKey((k) => k + 1);
              }}
              className={`min-h-[44px] rounded-lg border text-sm font-bold ${
                selfLoad === "no"
                  ? "border-ck-cobalt bg-ck-cobalt text-ck-on-accent"
                  : "border-ck-border bg-ck-midnight text-ck-steel"
              }`}
            >
              No
            </button>
          </div>
          {selfLoad === "yes" ? (
            <p className="text-xs text-ck-steel leading-relaxed">
              Dual function: you will sign <strong className="text-ck-fg">As driver</strong> and
              separately <strong className="text-ck-fg">As loader</strong> — not one merged
              sign-off.
            </p>
          ) : null}
        </section>

        {selfLoad === "no" ? (
          <section className="space-y-2 rounded-xl border border-ck-border bg-ck-slate p-3">
            <h3 className="text-sm font-bold text-ck-steel">Loader CoR acknowledgment</h3>
            <p className="text-xs text-ck-steel leading-relaxed">
              Do not invent a loader signature. Choose how acknowledgment is recorded.
            </p>
            <div className="space-y-2">
              {(
                [
                  ["present", "Loader is present — they will sign"],
                  ["pending", "I know who loaded — they are not here to sign"],
                  ["unknown", "Loader unknown / unavailable — photos required"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setKnowLoader(value);
                    setLoaderSig(null);
                    if (value === "unknown") setLoaderName("");
                    if (value !== "unknown") setEvidencePhotos([]);
                    setError(null);
                    setSigResetKey((k) => k + 1);
                  }}
                  className={`flex w-full min-h-[44px] items-center rounded-lg border px-3 text-left text-sm font-semibold ${
                    knowLoader === value
                      ? "border-ck-cobalt bg-ck-cobalt text-ck-on-accent"
                      : "border-ck-border bg-ck-midnight text-ck-steel"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {needsLoaderName ? (
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-ck-steel">Loader name (required)</span>
                <input
                  value={loaderName}
                  onChange={(e) => setLoaderName(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm text-ck-fg"
                  placeholder="Full name"
                />
              </label>
            ) : null}
            {knowLoader === "pending" ? (
              <p className="text-xs text-amber-300/90 leading-relaxed">
                Record saved with <strong>loader pending</strong> — PDF will show CoR not yet
                obtained from the loader.
              </p>
            ) : null}
          </section>
        ) : null}

        {loaderPath ? (
          <div className="space-y-3">
            {LOAD_SCHEMA_STUB.map((item) => (
              <ChecklistItemControl
                key={item.code}
                label={item.label}
                state={items[item.code]!}
                onChange={(next) => setItems((s) => ({ ...s, [item.code]: next }))}
              />
            ))}

            {needsEvidence ? (
              <section className="space-y-2 rounded-xl border border-ck-red/50 bg-ck-midnight/60 p-3">
                <h3 className="text-sm font-bold text-ck-red">Photo evidence (required)</h3>
                <p className="text-xs text-ck-steel leading-relaxed">
                  Loader CoR acknowledgment not obtained — attach photo(s) of the load / restraints.
                  This gap stays visible on the record (no proxy).
                </p>
                <input
                  ref={evidenceInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const url = typeof reader.result === "string" ? reader.result : "";
                      if (!url) return;
                      setEvidencePhotos((prev) =>
                        [...prev, url].slice(0, CHECKLIST_MAX_EVIDENCE_PHOTOS)
                      );
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => evidenceInputRef.current?.click()}
                  disabled={evidencePhotos.length >= CHECKLIST_MAX_EVIDENCE_PHOTOS}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-ck-cobalt px-4 text-sm font-semibold text-ck-on-accent disabled:opacity-40"
                >
                  Take photo
                </button>
                {evidencePhotos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {evidencePhotos.map((src, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Load evidence ${i + 1}`}
                          className="h-16 w-16 rounded object-cover border border-ck-border"
                        />
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 rounded-full bg-ck-red px-1.5 text-[10px] font-bold text-ck-on-accent"
                          onClick={() =>
                            setEvidencePhotos((prev) => prev.filter((_, j) => j !== i))
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <ChecklistSignaturePanel
              key={`driver-${sigResetKey}`}
              title="Driver signature"
              roleLabel="As driver"
              onConfirmed={setDriverSig}
            />
            {needsLoaderSig ? (
              <ChecklistSignaturePanel
                key={`loader-${sigResetKey}`}
                title="Loader signature"
                roleLabel={
                  loaderPath === "self_as_loader" ? "As loader (I also loaded)" : "As loader"
                }
                onConfirmed={setLoaderSig}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </ChecklistModalShell>
  );
}
