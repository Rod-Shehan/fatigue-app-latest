"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Rego } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { PRODUCT_NAME } from "@/lib/branding";
import { MANAGER_PAGE_SHELL } from "@/lib/manager-experience";
import {
  AXLE_COUNT_MAX,
  AXLE_COUNT_MIN,
  TRUCK_REGO_ATM_LABEL,
  TRUCK_REGO_AXLES_LABEL,
  TRUCK_REGO_GCM_LABEL,
  TRUCK_REGO_GVM_LABEL,
  TRUCK_REGO_TARE_LABEL,
  TRUCK_REGO_TYPE_LABEL,
  TRUCK_REGO_WAHVA_HINT,
  TRUCK_REGO_WAHVA_LABEL,
  VEHICLE_TYPE_LABELS,
  VEHICLE_TYPES,
  formatTruckRegoSummary,
  recordFromApiRego,
  truckRegoMetadataComplete,
  usesAtm,
  usesGvmGcm,
  type VehicleType,
} from "@/lib/truck-rego";
import { Loader2, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { useState } from "react";

type Draft = {
  label: string;
  vehicleType: VehicleType | "";
  gvmTonnes: string;
  gcmTonnes: string;
  atmTonnes: string;
  tareTonnes: string;
  axleCount: string;
  wahvaAccredited: boolean;
};

const EMPTY_DRAFT: Draft = {
  label: "",
  vehicleType: "",
  gvmTonnes: "",
  gcmTonnes: "",
  atmTonnes: "",
  tareTonnes: "",
  axleCount: "",
  wahvaAccredited: false,
};

function numOrNull(raw: string): number | null {
  const n = Number(raw.trim());
  return raw.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

function draftFromRego(rego: Rego): Draft {
  return {
    label: rego.label,
    vehicleType: rego.vehicle_type ?? "",
    gvmTonnes: rego.gvm_tonnes != null ? String(rego.gvm_tonnes) : "",
    gcmTonnes: rego.gcm_tonnes != null ? String(rego.gcm_tonnes) : "",
    atmTonnes: rego.atm_tonnes != null ? String(rego.atm_tonnes) : "",
    tareTonnes: rego.tare_tonnes != null ? String(rego.tare_tonnes) : "",
    axleCount: rego.axle_count != null ? String(rego.axle_count) : "",
    wahvaAccredited: Boolean(rego.wahva_accredited),
  };
}

function payloadFromDraft(draft: Draft) {
  const type = draft.vehicleType as VehicleType;
  return {
    label: draft.label.trim(),
    vehicle_type: type,
    gvm_tonnes: usesGvmGcm(type) ? numOrNull(draft.gvmTonnes) : null,
    gcm_tonnes: usesGvmGcm(type) ? numOrNull(draft.gcmTonnes) : null,
    atm_tonnes: usesAtm(type) ? numOrNull(draft.atmTonnes) : null,
    tare_tonnes: Number(draft.tareTonnes),
    axle_count: Number(draft.axleCount),
    wahva_accredited: draft.wahvaAccredited,
  };
}

function positiveMass(raw: string): boolean {
  const n = Number(raw.trim());
  return Boolean(raw.trim()) && Number.isFinite(n) && n > 0;
}

function draftReady(draft: Draft): boolean {
  if (!draft.label.trim() || !draft.vehicleType) return false;
  if (!positiveMass(draft.tareTonnes)) return false;
  const axles = Number(draft.axleCount);
  if (!Number.isInteger(axles) || axles < AXLE_COUNT_MIN || axles > AXLE_COUNT_MAX) return false;
  if (usesGvmGcm(draft.vehicleType) && (!positiveMass(draft.gvmTonnes) || !positiveMass(draft.gcmTonnes))) {
    return false;
  }
  if (usesAtm(draft.vehicleType) && !positiveMass(draft.atmTonnes)) return false;
  return true;
}

function MassField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        {label} *
      </Label>
      <Input
        id={id}
        type="number"
        min="0.1"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Metric tonnes"
      />
    </div>
  );
}

function RegoFields({
  draft,
  onChange,
  idPrefix,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
  idPrefix: string;
}) {
  const powered = usesGvmGcm(draft.vehicleType);
  const trailer = usesAtm(draft.vehicleType);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-label`} className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Plate *
        </Label>
        <Input
          id={`${idPrefix}-label`}
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder="e.g. 1ABC 234"
          className="font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-type`} className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          {TRUCK_REGO_TYPE_LABEL} *
        </Label>
        <Select
          value={draft.vehicleType || undefined}
          onValueChange={(value) => {
            const vehicleType = value as VehicleType;
            onChange({
              ...draft,
              vehicleType,
              gvmTonnes: usesGvmGcm(vehicleType) ? draft.gvmTonnes : "",
              gcmTonnes: usesGvmGcm(vehicleType) ? draft.gcmTonnes : "",
              atmTonnes: usesAtm(vehicleType) ? draft.atmTonnes : "",
            });
          }}
        >
          <SelectTrigger id={`${idPrefix}-type`} className="h-9">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {VEHICLE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {VEHICLE_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-axles`} className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          {TRUCK_REGO_AXLES_LABEL} *
        </Label>
        <Input
          id={`${idPrefix}-axles`}
          type="number"
          min={AXLE_COUNT_MIN}
          max={AXLE_COUNT_MAX}
          step="1"
          inputMode="numeric"
          value={draft.axleCount}
          onChange={(e) => onChange({ ...draft, axleCount: e.target.value })}
          placeholder={`${AXLE_COUNT_MIN}–${AXLE_COUNT_MAX}`}
        />
      </div>
      {powered ? (
        <>
          <MassField
            id={`${idPrefix}-gvm`}
            label={TRUCK_REGO_GVM_LABEL}
            value={draft.gvmTonnes}
            onChange={(gvmTonnes) => onChange({ ...draft, gvmTonnes })}
          />
          <MassField
            id={`${idPrefix}-gcm`}
            label={TRUCK_REGO_GCM_LABEL}
            value={draft.gcmTonnes}
            onChange={(gcmTonnes) => onChange({ ...draft, gcmTonnes })}
          />
        </>
      ) : null}
      {trailer ? (
        <MassField
          id={`${idPrefix}-atm`}
          label={TRUCK_REGO_ATM_LABEL}
          value={draft.atmTonnes}
          onChange={(atmTonnes) => onChange({ ...draft, atmTonnes })}
        />
      ) : null}
      <MassField
        id={`${idPrefix}-tare`}
        label={TRUCK_REGO_TARE_LABEL}
        value={draft.tareTonnes}
        onChange={(tareTonnes) => onChange({ ...draft, tareTonnes })}
      />
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 sm:col-span-2">
        <input
          id={`${idPrefix}-wahva`}
          type="checkbox"
          checked={draft.wahvaAccredited}
          onChange={(e) => onChange({ ...draft, wahvaAccredited: e.target.checked })}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
            {TRUCK_REGO_WAHVA_LABEL}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{TRUCK_REGO_WAHVA_HINT}</span>
        </span>
      </label>
    </div>
  );
}

export function RegosAdmin() {
  const queryClient = useQueryClient();
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: regos = [], isLoading } = useQuery({
    queryKey: ["regos"],
    queryFn: () => api.regos.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => api.regos.create(payloadFromDraft(newDraft)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regos"] });
      setNewDraft(EMPTY_DRAFT);
      setFormError(null);
    },
    onError: (e: Error) => setFormError(e.message || "Could not add rego"),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error("No rego selected");
      return api.regos.update(editingId, payloadFromDraft(editDraft));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regos"] });
      setEditingId(null);
      setFormError(null);
    },
    onError: (e: Error) => setFormError(e.message || "Could not save rego"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.regos.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["regos"] }),
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className={MANAGER_PAGE_SHELL}>
        <PageHeader
          backHref="/manager"
          backLabel="Manager dashboard"
          title={PRODUCT_NAME}
          subtitle="Vehicle regos — plate, type, GVM/GCM or ATM, tare, number of axles, and WAHVA accreditation"
          icon={<Truck className="w-5 h-5" />}
        />

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Add rego</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            GVM and GCM for prime movers, rigids, and vans. ATM for trailers. Tare and {TRUCK_REGO_AXLES_LABEL.toLowerCase()} on every unit.
            Tick {TRUCK_REGO_WAHVA_LABEL} ({TRUCK_REGO_WAHVA_HINT}) when it applies.
          </p>
          <RegoFields draft={newDraft} onChange={setNewDraft} idPrefix="new-rego" />
          {formError && !editingId ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!draftReady(newDraft) || createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </Button>
        </div>

        <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            Current regos ({regos.length})
          </h2>
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
          {!isLoading && regos.length === 0 && (
            <div className="text-center py-8 px-4">
              <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">No regos yet</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                Regos appear in the truck dropdown on each day card. Add vehicle details above so drivers can select them when logging.
              </p>
            </div>
          )}
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {regos.map((rego) => {
              const meta = recordFromApiRego(rego);
              const complete = truckRegoMetadataComplete(meta);
              const editing = editingId === rego.id;
              return (
                <li key={rego.id} className="px-4 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-slate-800 dark:text-slate-200">{rego.label}</p>
                      <p className={`text-xs mt-0.5 ${complete ? "text-slate-500 dark:text-slate-400" : "text-amber-700 dark:text-amber-400 font-semibold"}`}>
                        {formatTruckRegoSummary(meta)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-slate-700"
                        onClick={() => {
                          setEditingId(editing ? null : rego.id);
                          setEditDraft(draftFromRego(rego));
                          setFormError(null);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/50"
                        onClick={() => deleteMutation.mutate(rego.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {editing ? (
                    <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <RegoFields draft={editDraft} onChange={setEditDraft} idPrefix={`edit-${rego.id}`} />
                      {formError && editingId === rego.id ? (
                        <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
                      ) : null}
                      <Button
                        onClick={() => updateMutation.mutate()}
                        disabled={!draftReady(editDraft) || updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Saving…
                          </>
                        ) : (
                          "Save vehicle details"
                        )}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
