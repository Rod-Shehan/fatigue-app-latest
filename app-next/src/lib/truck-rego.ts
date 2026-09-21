/**
 * Fleet vehicle-rego catalogue metadata (manager Rego admin).
 * Day cards still store the plate string; these fields describe the vehicle.
 */

export const VEHICLE_TYPES = ["prime_mover", "rigid", "van", "other"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  prime_mover: "Prime mover",
  rigid: "Rigid",
  van: "Van",
  other: "Other",
};

export const AXLE_GROUPS = [2, 3, 4] as const;
export type AxleGroups = (typeof AXLE_GROUPS)[number];

export const TRUCK_REGO_TYPE_LABEL = "Type";
export const TRUCK_REGO_MASS_LABEL = "GVM / GCM (t)";
export const TRUCK_REGO_AXLES_LABEL = "Axle groups";
export const TRUCK_REGO_WAHVA_LABEL = "WAHVA Accredited";
export const TRUCK_REGO_WAHVA_HINT = "RAV permit vehicle";

export type TruckRegoMetadata = {
  vehicleType: VehicleType;
  gvmGcmTonnes: number;
  axleGroups: AxleGroups;
  wahvaAccredited: boolean;
};

export type TruckRegoRecord = {
  id: string;
  label: string;
  sortOrder: number;
  vehicleType: VehicleType | null;
  gvmGcmTonnes: number | null;
  axleGroups: AxleGroups | null;
  wahvaAccredited: boolean;
};

export function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === "string" && (VEHICLE_TYPES as readonly string[]).includes(value);
}

export function isAxleGroups(value: unknown): value is AxleGroups {
  return typeof value === "number" && Number.isInteger(value) && (AXLE_GROUPS as readonly number[]).includes(value);
}

export function parseGvmGcmTonnes(raw: unknown): number | { error: string } {
  if (raw == null || raw === "") return { error: `${TRUCK_REGO_MASS_LABEL} is required` };
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    return { error: `${TRUCK_REGO_MASS_LABEL} must be a positive number in metric tonnes` };
  }
  return Math.round(n * 100) / 100;
}

export function parseAxleGroups(raw: unknown): AxleGroups | { error: string } {
  if (raw == null || raw === "") return { error: `${TRUCK_REGO_AXLES_LABEL} is required` };
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (!isAxleGroups(n)) return { error: `${TRUCK_REGO_AXLES_LABEL} must be 2, 3, or 4` };
  return n;
}

export function parseVehicleType(raw: unknown): VehicleType | { error: string } {
  if (raw == null || raw === "") return { error: `${TRUCK_REGO_TYPE_LABEL} is required` };
  if (!isVehicleType(raw)) {
    return { error: `${TRUCK_REGO_TYPE_LABEL} must be Prime mover, Rigid, Van, or Other` };
  }
  return raw;
}

export function parseWahvaAccredited(raw: unknown): boolean | { error: string } {
  if (raw == null || raw === "") return { error: `${TRUCK_REGO_WAHVA_LABEL} is required` };
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === "yes" || raw === 1 || raw === "1") return true;
  if (raw === "false" || raw === "no" || raw === 0 || raw === "0") return false;
  return { error: `${TRUCK_REGO_WAHVA_LABEL} must be yes or no` };
}

export function truckRegoMetadataComplete(
  row: Pick<TruckRegoRecord, "vehicleType" | "gvmGcmTonnes" | "axleGroups">
): boolean {
  return row.vehicleType != null && row.gvmGcmTonnes != null && row.axleGroups != null;
}

export function formatTruckRegoSummary(row: Pick<TruckRegoRecord, "vehicleType" | "gvmGcmTonnes" | "axleGroups" | "wahvaAccredited">): string {
  if (!truckRegoMetadataComplete(row)) return "Needs vehicle details";
  const type = VEHICLE_TYPE_LABELS[row.vehicleType!];
  const mass = `${row.gvmGcmTonnes} t`;
  const axles = `${row.axleGroups} axle groups`;
  const wahva = row.wahvaAccredited ? TRUCK_REGO_WAHVA_LABEL : "Not WAHVA accredited";
  return `${type} · ${mass} · ${axles} · ${wahva}`;
}

export function parseTruckRegoCreate(body: Record<string, unknown>):
  | (TruckRegoMetadata & { label: string; sortOrder?: number })
  | { error: string } {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return { error: "label required" };

  const vehicleType = parseVehicleType(body.vehicle_type ?? body.vehicleType);
  if (typeof vehicleType === "object") return vehicleType;
  const gvmGcmTonnes = parseGvmGcmTonnes(body.gvm_gcm_tonnes ?? body.gvmGcmTonnes);
  if (typeof gvmGcmTonnes === "object") return gvmGcmTonnes;
  const axleGroups = parseAxleGroups(body.axle_groups ?? body.axleGroups);
  if (typeof axleGroups === "object") return axleGroups;
  const wahvaAccredited = parseWahvaAccredited(body.wahva_accredited ?? body.wahvaAccredited);
  if (typeof wahvaAccredited === "object") return wahvaAccredited;

  const sortOrder =
    typeof body.sort_order === "number"
      ? body.sort_order
      : typeof body.sortOrder === "number"
        ? body.sortOrder
        : undefined;

  return { label, vehicleType, gvmGcmTonnes, axleGroups, wahvaAccredited, sortOrder };
}

export function parseTruckRegoPatch(body: Record<string, unknown>):
  | Partial<TruckRegoMetadata & { label: string; sortOrder: number }>
  | { error: string } {
  const out: Partial<TruckRegoMetadata & { label: string; sortOrder: number }> = {};

  if ("label" in body) {
    if (typeof body.label !== "string" || !body.label.trim()) return { error: "label required" };
    out.label = body.label.trim();
  }
  if ("sort_order" in body || "sortOrder" in body) {
    const raw = body.sort_order ?? body.sortOrder;
    if (typeof raw !== "number") return { error: "sort_order must be a number" };
    out.sortOrder = raw;
  }
  if ("vehicle_type" in body || "vehicleType" in body) {
    const vehicleType = parseVehicleType(body.vehicle_type ?? body.vehicleType);
    if (typeof vehicleType === "object") return vehicleType;
    out.vehicleType = vehicleType;
  }
  if ("gvm_gcm_tonnes" in body || "gvmGcmTonnes" in body) {
    const gvmGcmTonnes = parseGvmGcmTonnes(body.gvm_gcm_tonnes ?? body.gvmGcmTonnes);
    if (typeof gvmGcmTonnes === "object") return gvmGcmTonnes;
    out.gvmGcmTonnes = gvmGcmTonnes;
  }
  if ("axle_groups" in body || "axleGroups" in body) {
    const axleGroups = parseAxleGroups(body.axle_groups ?? body.axleGroups);
    if (typeof axleGroups === "object") return axleGroups;
    out.axleGroups = axleGroups;
  }
  if ("wahva_accredited" in body || "wahvaAccredited" in body) {
    const wahvaAccredited = parseWahvaAccredited(body.wahva_accredited ?? body.wahvaAccredited);
    if (typeof wahvaAccredited === "object") return wahvaAccredited;
    out.wahvaAccredited = wahvaAccredited;
  }

  if (Object.keys(out).length === 0) return { error: "No fields to update" };
  return out;
}

export function serializeTruckRego(row: {
  id: string;
  label: string;
  sortOrder: number;
  vehicleType?: string | null;
  gvmGcmTonnes?: number | null;
  axleGroups?: number | null;
  wahvaAccredited?: boolean | null;
}) {
  return {
    id: row.id,
    label: row.label,
    sort_order: row.sortOrder,
    vehicle_type: isVehicleType(row.vehicleType) ? row.vehicleType : null,
    gvm_gcm_tonnes: row.gvmGcmTonnes ?? null,
    axle_groups: isAxleGroups(row.axleGroups) ? row.axleGroups : null,
    wahva_accredited: Boolean(row.wahvaAccredited),
  };
}
