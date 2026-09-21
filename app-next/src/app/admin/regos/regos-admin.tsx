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
  AXLE_GROUPS,
  TRUCK_REGO_AXLES_LABEL,
  TRUCK_REGO_MASS_LABEL,
  TRUCK_REGO_TYPE_LABEL,
  TRUCK_REGO_WAHVA_HINT,
  TRUCK_REGO_WAHVA_LABEL,
  VEHICLE_TYPE_LABELS,
  VEHICLE_TYPES,
  formatTruckRegoSummary,
  truckRegoMetadataComplete,
  type VehicleType,
} from "@/lib/truck-rego";
import { Loader2, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { useState } from "react";

type Draft = {
  label: string;
  vehicleType: VehicleType | "";
  gvmGcmTonnes: string;
  axleGroups: "" | "2" | "3" | "4";
  wahvaAccredited: boolean;
};

const EMPTY_DRAFT: Draft = {
  label: "",
  vehicleType: "",
  gvmGcmTonnes: "",
  axleGroups: "",
  wahvaAccredited: false,
};

function draftFromRego(rego: Rego): Draft {
  return {
    label: rego.label,
    vehicleType: rego.vehicle_type ?? "",
    gvmGcmTonnes: rego.gvm_gcm_tonnes != null ? String(rego.gvm_gcm_tonnes) : "",
    axleGroups: rego.axle_groups != null ? String(rego.axle_groups) as Draft["axleGroups"] : "",
    wahvaAccredited: Boolean(rego.wahva_accredited),
  };
}

function payloadFromDraft(draft: Draft) {
  return {
    label: draft.label.trim(),
    vehicle_type: draft.vehicleType as VehicleType,
    gvm_gcm_tonnes: Number(draft.gvmGcmTonnes),
    axle_groups: Number(draft.axleGroups) as 2 | 3 | 4,
    wahva_accredited: draft.wahvaAccredited,
  };
}

function draftReady(draft: Draft): boolean {
  return Boolean(
    draft.label.trim() &&
      draft.vehicleType &&
      draft.gvmGcmTonnes.trim() &&
      Number(draft.gvmGcmTonnes) > 0 &&
      draft.axleGroups
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
          onValueChange={(value) => onChange({ ...draft, vehicleType: value as VehicleType })}
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
        <Label htmlFor={`${idPrefix}-mass`} className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          {TRUCK_REGO_MASS_LABEL} *
        </Label>
        <Input
          id={`${idPrefix}-mass`}
          type="number"
          min="0.1"
          step="0.1"
          inputMode="decimal"
          value={draft.gvmGcmTonnes}
          onChange={(e) => onChange({ ...draft, gvmGcmTonnes: e.target.value })}
          placeholder="Metric tonnes"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-axles`} className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          {TRUCK_REGO_AXLES_LABEL} *
        </Label>
        <Select
          value={draft.axleGroups || undefined}
          onValueChange={(value) => onChange({ ...draft, axleGroups: value as Draft["axleGroups"] })}
        >
          <SelectTrigger id={`${idPrefix}-axles`} className="h-9">
            <SelectValue placeholder="Select axle groups" />
          </SelectTrigger>
          <SelectContent>
            {AXLE_GROUPS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
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
          subtitle="Vehicle regos — plate plus type, GVM/GCM, axle groups, and WAHVA accreditation"
          icon={<Truck className="w-5 h-5" />}
        />

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Add rego</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Every vehicle needs {TRUCK_REGO_TYPE_LABEL.toLowerCase()}, {TRUCK_REGO_MASS_LABEL}, {TRUCK_REGO_AXLES_LABEL.toLowerCase()},
            and whether it is {TRUCK_REGO_WAHVA_LABEL} ({TRUCK_REGO_WAHVA_HINT}).
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
              const complete = truckRegoMetadataComplete({
                vehicleType: rego.vehicle_type,
                gvmGcmTonnes: rego.gvm_gcm_tonnes,
                axleGroups: rego.axle_groups,
              });
              const editing = editingId === rego.id;
              return (
                <li key={rego.id} className="px-4 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-slate-800 dark:text-slate-200">{rego.label}</p>
                      <p className={`text-xs mt-0.5 ${complete ? "text-slate-500 dark:text-slate-400" : "text-amber-700 dark:text-amber-400 font-semibold"}`}>
                        {formatTruckRegoSummary({
                          vehicleType: rego.vehicle_type,
                          gvmGcmTonnes: rego.gvm_gcm_tonnes,
                          axleGroups: rego.axle_groups,
                          wahvaAccredited: rego.wahva_accredited,
                        })}
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
