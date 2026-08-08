/**
 * Route catalogue presets (ADR 0003) — shared DB entries for run-plan autofill.
 */

import {
  runPlanValidationError,
  type RouteSource,
  type RunPlanFields,
} from "@/lib/route-plan";

export type CatalogueSource = "fleet" | "driver";

export type RoutePresetRecord = {
  id: string;
  label: string;
  start_location: string | null;
  destination: string | null;
  planned_distance_km: number | null;
  planned_on_duty_hours: number | null;
  catalogue_source: CatalogueSource;
  created_by_name: string | null;
  sort_order: number;
};

export type RoutePresetCreateInput = {
  label: string;
  start_location?: string | null;
  destination?: string | null;
  planned_distance_km?: number | null;
  planned_on_duty_hours?: number | null;
  catalogue_source?: CatalogueSource;
  sort_order?: number;
};

export function catalogueSourceForSession(isManager: boolean): CatalogueSource {
  return isManager ? "fleet" : "driver";
}

export function routeSourceForCatalogue(source: CatalogueSource): RouteSource {
  return source === "fleet" ? "org_preset" : "driver_saved";
}

export function validateRoutePresetCreateInput(input: RoutePresetCreateInput): string | null {
  const label = (input.label ?? "").trim();
  if (!label) return "Route name is required.";
  return runPlanValidationError({
    route_label: label,
    planned_distance_km: input.planned_distance_km ?? null,
    planned_on_duty_hours: input.planned_on_duty_hours ?? null,
  });
}

export function runPlanFieldsFromPreset(preset: RoutePresetRecord): RunPlanFields {
  return {
    route_label: preset.label,
    planned_distance_km: preset.planned_distance_km,
    planned_on_duty_hours: preset.planned_on_duty_hours,
    route_source: routeSourceForCatalogue(preset.catalogue_source),
    route_preset_id: preset.id,
  };
}

/** Infer from/to from preset fields, or parse "Perth – Kalgoorlie" style labels. */
export function parseRouteLabelToLocations(label: string): {
  start_location?: string;
  destination?: string;
} {
  const trimmed = label.trim();
  if (!trimmed) return {};
  const separators = [/\s*[–—-]\s*/, /\s+to\s+/i, /\s*\/\s*/, /\s*→\s*/];
  for (const sep of separators) {
    const parts = trimmed.split(sep).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { start_location: parts[0], destination: parts[parts.length - 1] };
    }
  }
  return { destination: trimmed };
}

export type DayCardFieldsFromPreset = RunPlanFields & {
  /** Always set (may be "") so preset selection overwrites stale From/To. */
  start_location: string;
  destination: string;
};

/** Run plan + day-card route fields when a catalogue preset is selected. */
export function dayCardFieldsFromPreset(preset: RoutePresetRecord): DayCardFieldsFromPreset {
  const explicitStart = (preset.start_location ?? "").trim();
  const explicitDest = (preset.destination ?? "").trim();
  const parsed = parseRouteLabelToLocations(preset.label);
  return {
    ...runPlanFieldsFromPreset(preset),
    // Always strings: selecting a plan owns From/To (clear when unknown).
    start_location: explicitStart || parsed.start_location || "",
    destination: explicitDest || parsed.destination || "",
  };
}

export function formatRoutePresetOption(preset: RoutePresetRecord): string {
  const parts: string[] = [preset.label];
  const hrs = preset.planned_on_duty_hours;
  const km = preset.planned_distance_km;
  if (hrs != null && !Number.isNaN(Number(hrs)) && Number(hrs) > 0) {
    parts.push(`~${Number(hrs)}h`);
  }
  if (km != null && !Number.isNaN(Number(km)) && Number(km) >= 0) {
    parts.push(`~${Number(km)} km`);
  }
  const tag = preset.catalogue_source === "fleet" ? "Fleet" : "Driver";
  return `${parts.join(" · ")} (${tag})`;
}
