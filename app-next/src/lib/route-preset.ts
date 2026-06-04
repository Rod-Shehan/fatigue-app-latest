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
  planned_distance_km: number | null;
  planned_on_duty_hours: number | null;
  catalogue_source: CatalogueSource;
  created_by_name: string | null;
  sort_order: number;
};

export type RoutePresetCreateInput = {
  label: string;
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
