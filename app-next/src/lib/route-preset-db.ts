import type { RoutePreset } from "@prisma/client";
import type { RoutePresetRecord } from "@/lib/route-preset";

export function serializeRoutePreset(
  row: RoutePreset & { createdBy?: { name: string | null } | null }
): RoutePresetRecord {
  const source = row.catalogueSource === "driver" ? "driver" : "fleet";
  return {
    id: row.id,
    label: row.label,
    planned_distance_km: row.plannedDistanceKm,
    planned_on_duty_hours: row.plannedOnDutyHours,
    catalogue_source: source,
    created_by_name: row.createdBy?.name ?? null,
    sort_order: row.sortOrder,
  };
}
