"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { PRODUCT_NAME } from "@/lib/branding";
import { formatRoutePresetOption } from "@/lib/route-preset";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export function RoutesCatalogueAdmin() {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [startLocation, setStartLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [hours, setHours] = useState("");
  const [km, setKm] = useState("");

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["route-presets"],
    queryFn: () => api.routePresets.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.routePresets.create({
        label: label.trim(),
        start_location: startLocation.trim() || null,
        destination: destination.trim() || null,
        planned_on_duty_hours: hours === "" ? null : Number(hours),
        planned_distance_km: km === "" ? null : Number(km),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-presets"] });
      setLabel("");
      setStartLocation("");
      setDestination("");
      setHours("");
      setKm("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.routePresets.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["route-presets"] }),
  });

  const handleAdd = () => {
    if (!label.trim()) return;
    createMutation.mutate();
  };

  const canSubmit =
    label.trim() &&
    !createMutation.isPending &&
    ((hours !== "" && !Number.isNaN(Number(hours)) && Number(hours) > 0) ||
      (km !== "" && !Number.isNaN(Number(km)) && Number(km) >= 0));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <PageHeader
          backHref="/manager"
          backLabel="Manager dashboard"
          title={PRODUCT_NAME}
          subtitle="Route catalogue — saved run plans for the day setup dropdown"
          icon={<MapPin className="w-5 h-5" />}
        />

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          Managers add <span className="font-medium">fleet</span> routes; drivers can add their own{" "}
          <span className="font-medium">driver</span> routes from day setup or here. Everyone picks from the same
          list to save time; custom adhoc plans on a day still work.
        </p>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Add route</h2>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Route name</Label>
            <Input
              placeholder="e.g. Perth – Kalgoorlie"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="text-base"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Start location</Label>
              <Input
                placeholder="e.g. Perth"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Destination</Label>
              <Input
                placeholder="e.g. Kalgoorlie"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Expected hours</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="e.g. 9"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Expected km</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="e.g. 420"
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={!canSubmit} className="gap-2 w-full sm:w-auto">
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add to catalogue
          </Button>
          {createMutation.isError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              Could not save route. Check name and at least hours or km.
            </p>
          )}
        </div>

        <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            Catalogue ({presets.length})
          </h2>
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
          {!isLoading && presets.length === 0 && (
            <div className="text-center py-8 px-4">
              <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">No routes yet</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add routes above or from <Link href="/driver" className="text-teal-700 dark:text-teal-400 underline">day setup</Link>{" "}
                when logging a run plan.
              </p>
            </div>
          )}
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {presets.map((preset) => (
              <li key={preset.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-slate-800 dark:text-slate-200 truncate">{formatRoutePresetOption(preset)}</p>
                  {(preset.start_location || preset.destination) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {[preset.start_location, preset.destination].filter(Boolean).join(" → ")}
                    </p>
                  )}
                  {preset.created_by_name && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Added by {preset.created_by_name}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/50"
                  onClick={() => deleteMutation.mutate(preset.id)}
                  disabled={deleteMutation.isPending}
                  aria-label={`Remove ${preset.label}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
