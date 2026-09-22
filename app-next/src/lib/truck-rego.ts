/**
 * Fleet vehicle-rego catalogue metadata (manager Rego admin).
 * Day cards still store the plate string; these fields describe the vehicle.
 */

import { regoKey } from "@/lib/rego-kms-validation";

export const VEHICLE_TYPES = ["prime_mover", "rigid", "van", "trailer", "other"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  prime_mover: "Prime mover",
  rigid: "Rigid",
  van: "Van",
  trailer: "Trailer",
  other: "Other",
};

/** Powered units — GVM and GCM apply. */
export const POWERED_VEHICLE_TYPES = ["prime_mover", "rigid", "van"] as const;
export type PoweredVehicleType = (typeof POWERED_VEHICLE_TYPES)[number];

export const AXLE_COUNT_MIN = 1;
export const AXLE_COUNT_MAX = 20;

export const TRUCK_REGO_TYPE_LABEL = "Type";
export const TRUCK_REGO_GVM_LABEL = "GVM (t)";
export const TRUCK_REGO_GCM_LABEL = "GCM (t)";
export const TRUCK_REGO_ATM_LABEL = "ATM (t)";
export const TRUCK_REGO_TARE_LABEL = "Tare (t)";
export const TRUCK_REGO_AXLES_LABEL = "Number of axles";
export const TRUCK_REGO_WAHVA_LABEL = "WAHVA Accredited";
export const TRUCK_REGO_WAHVA_HINT = "RAV permit vehicle";

export function isPoweredVehicleType(value: unknown): value is PoweredVehicleType {
  return typeof value === "string" && (POWERED_VEHICLE_TYPES as readonly string[]).includes(value);
}

export function usesGvmGcm(type: unknown): boolean {
  return isPoweredVehicleType(type);
}

export function usesAtm(type: unknown): boolean {
  return type === "trailer";
}

export function findRegoByPlate<T extends { label: string }>(
  regos: T[] | undefined,
  plate: string | null | undefined
): T | null {
  const key = regoKey(plate ?? "");
  if (!key || !regos?.length) return null;
  return regos.find((r) => regoKey(r.label) === key) ?? null;
}

/** Prime movers often couple a trailer — remind, never require. */
export function hookupSuggestedForRego(rego: { vehicle_type?: string | null } | null | undefined): boolean {
  return rego?.vehicle_type === "prime_mover";
}

export function hookupSuggestedForPlate(
  regos: Array<{ label: string; vehicle_type?: string | null }> | undefined,
  plate: string | null | undefined
): boolean {
  return hookupSuggestedForRego(findRegoByPlate(regos, plate));
}

/** Which catalogue plates a form should offer (same list as Set up day, filtered). */
export type FormRegoListRole = "powered" | "trailer" | "plant" | "any";

export function formRegoMatchesRole(
  type: string | null | undefined,
  role: FormRegoListRole
): boolean {
  if (role === "any") return true;
  if (type == null || type === "") return true;
  if (role === "powered") return isPoweredVehicleType(type);
  if (role === "trailer") return type === "trailer";
  if (role === "plant") return type === "other";
  return true;
}

export function formRegoRoleForPlant(
  plant: "vehicle" | "trailer" | "forklift" | null | undefined
): FormRegoListRole {
  if (plant === "trailer") return "trailer";
  if (plant === "forklift") return "plant";
  if (plant === "vehicle") return "powered";
  return "any";
}

export function platesForFormRegoRole(
  regos: Array<{ label: string; vehicle_type?: string | null }> | undefined,
  role: FormRegoListRole,
  extraPlates: Array<string | null | undefined> = []
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const label = (raw ?? "").trim();
    const key = regoKey(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(label);
  };
  for (const extra of extraPlates) push(extra);
  for (const row of regos ?? []) {
    if (formRegoMatchesRole(row.vehicle_type, role)) push(row.label);
  }
  return out;
}

export type TruckRegoMassFields = {
  gvmTonnes: number | null;
  gcmTonnes: number | null;
  atmTonnes: number | null;
  tareTonnes: number | null;
};

export type TruckRegoMetadata = {
  vehicleType: VehicleType;
  gvmTonnes: number | null;
  gcmTonnes: number | null;
  atmTonnes: number | null;
  tareTonnes: number;
  axleCount: number;
  wahvaAccredited: boolean;
};

export type TruckRegoRecord = {
  id: string;
  label: string;
  sortOrder: number;
  vehicleType: VehicleType | null;
  gvmTonnes: number | null;
  gcmTonnes: number | null;
  atmTonnes: number | null;
  tareTonnes: number | null;
  axleCount: number | null;
  wahvaAccredited: boolean;
};

export function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === "string" && (VEHICLE_TYPES as readonly string[]).includes(value);
}

export function isAxleCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= AXLE_COUNT_MIN && value <= AXLE_COUNT_MAX;
}

function parseTonnes(
  raw: unknown,
  label: string,
  opts: { required: boolean }
): number | null | { error: string } {
  if (raw == null || raw === "") {
    return opts.required ? { error: `${label} is required` } : null;
  }
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    return { error: `${label} must be a positive number in metric tonnes` };
  }
  return Math.round(n * 100) / 100;
}

export function parseAxleCount(raw: unknown): number | { error: string } {
  if (raw == null || raw === "") return { error: `${TRUCK_REGO_AXLES_LABEL} is required` };
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (!isAxleCount(n)) {
    return { error: `${TRUCK_REGO_AXLES_LABEL} must be a whole number from ${AXLE_COUNT_MIN} to ${AXLE_COUNT_MAX}` };
  }
  return n;
}

export function parseVehicleType(raw: unknown): VehicleType | { error: string } {
  if (raw == null || raw === "") return { error: `${TRUCK_REGO_TYPE_LABEL} is required` };
  if (!isVehicleType(raw)) {
    return { error: `${TRUCK_REGO_TYPE_LABEL} must be Prime mover, Rigid, Van, Trailer, or Other` };
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

export function massesForVehicleType(
  type: VehicleType,
  masses: Partial<TruckRegoMassFields>
): TruckRegoMassFields {
  const tareTonnes = masses.tareTonnes ?? null;
  if (usesGvmGcm(type)) {
    return {
      gvmTonnes: masses.gvmTonnes ?? null,
      gcmTonnes: masses.gcmTonnes ?? null,
      atmTonnes: null,
      tareTonnes,
    };
  }
  if (usesAtm(type)) {
    return {
      gvmTonnes: null,
      gcmTonnes: null,
      atmTonnes: masses.atmTonnes ?? null,
      tareTonnes,
    };
  }
  return { gvmTonnes: null, gcmTonnes: null, atmTonnes: null, tareTonnes };
}

export function truckRegoMetadataComplete(
  row: Pick<TruckRegoRecord, "vehicleType" | "gvmTonnes" | "gcmTonnes" | "atmTonnes" | "tareTonnes" | "axleCount">
): boolean {
  if (row.vehicleType == null || row.tareTonnes == null || row.axleCount == null) return false;
  if (usesGvmGcm(row.vehicleType)) return row.gvmTonnes != null && row.gcmTonnes != null;
  if (usesAtm(row.vehicleType)) return row.atmTonnes != null;
  return true;
}

function formatTonnesValue(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** GVM / GCM / ATM / Tare that apply to this vehicle — for the day sheet and load check. */
export function formatTruckRegoMassLine(
  row: Pick<TruckRegoRecord, "vehicleType" | "gvmTonnes" | "gcmTonnes" | "atmTonnes" | "tareTonnes">
): string {
  const parts: string[] = [];
  if (usesGvmGcm(row.vehicleType)) {
    if (row.gvmTonnes != null) parts.push(`GVM ${formatTonnesValue(row.gvmTonnes)} t`);
    if (row.gcmTonnes != null) parts.push(`GCM ${formatTonnesValue(row.gcmTonnes)} t`);
  }
  if (usesAtm(row.vehicleType) && row.atmTonnes != null) {
    parts.push(`ATM ${formatTonnesValue(row.atmTonnes)} t`);
  }
  if (row.tareTonnes != null) parts.push(`Tare ${formatTonnesValue(row.tareTonnes)} t`);
  return parts.join(" · ");
}

export function formatTruckRegoSelectLabel(
  plate: string,
  row: Pick<TruckRegoRecord, "vehicleType" | "gvmTonnes" | "gcmTonnes" | "atmTonnes" | "tareTonnes"> | null | undefined
): string {
  if (!row?.vehicleType) return plate;
  const type = VEHICLE_TYPE_LABELS[row.vehicleType];
  const mass = formatTruckRegoMassLine(row);
  return mass ? `${plate} · ${type} · ${mass}` : `${plate} · ${type}`;
}

export function formatTruckRegoSummary(
  row: Pick<
    TruckRegoRecord,
    "vehicleType" | "gvmTonnes" | "gcmTonnes" | "atmTonnes" | "tareTonnes" | "axleCount" | "wahvaAccredited"
  >
): string {
  if (!truckRegoMetadataComplete(row)) return "Needs vehicle details";
  const type = VEHICLE_TYPE_LABELS[row.vehicleType!];
  const mass = formatTruckRegoMassLine(row);
  const axles = `${row.axleCount} axles`;
  const wahva = row.wahvaAccredited ? TRUCK_REGO_WAHVA_LABEL : "Not WAHVA accredited";
  return [type, mass, axles, wahva].filter(Boolean).join(" · ");
}

function isFieldError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

function bodyHas(body: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((k) => k in body);
}

function readMass(body: Record<string, unknown>, snake: string, camel: string, label: string, required: boolean) {
  if (!bodyHas(body, snake, camel) && !required) return null;
  return parseTonnes(body[snake] ?? body[camel], label, { required });
}

export function parseTruckRegoCreate(body: Record<string, unknown>):
  | (TruckRegoMetadata & { label: string; sortOrder?: number })
  | { error: string } {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return { error: "label required" };

  const vehicleType = parseVehicleType(body.vehicle_type ?? body.vehicleType);
  if (isFieldError(vehicleType)) return vehicleType;

  const gvmTonnes = parseTonnes(body.gvm_tonnes ?? body.gvmTonnes, TRUCK_REGO_GVM_LABEL, {
    required: usesGvmGcm(vehicleType),
  });
  if (isFieldError(gvmTonnes)) return gvmTonnes;
  const gcmTonnes = parseTonnes(body.gcm_tonnes ?? body.gcmTonnes, TRUCK_REGO_GCM_LABEL, {
    required: usesGvmGcm(vehicleType),
  });
  if (isFieldError(gcmTonnes)) return gcmTonnes;
  const atmTonnes = parseTonnes(body.atm_tonnes ?? body.atmTonnes, TRUCK_REGO_ATM_LABEL, {
    required: usesAtm(vehicleType),
  });
  if (isFieldError(atmTonnes)) return atmTonnes;
  const tareTonnes = parseTonnes(body.tare_tonnes ?? body.tareTonnes, TRUCK_REGO_TARE_LABEL, { required: true });
  if (isFieldError(tareTonnes)) return tareTonnes;
  if (tareTonnes == null) return { error: `${TRUCK_REGO_TARE_LABEL} is required` };

  const axleCount = parseAxleCount(body.axle_count ?? body.axleCount);
  if (isFieldError(axleCount)) return axleCount;
  const wahvaAccredited = parseWahvaAccredited(body.wahva_accredited ?? body.wahvaAccredited);
  if (isFieldError(wahvaAccredited)) return wahvaAccredited;

  const sortOrder =
    typeof body.sort_order === "number"
      ? body.sort_order
      : typeof body.sortOrder === "number"
        ? body.sortOrder
        : undefined;

  const masses = massesForVehicleType(vehicleType, { gvmTonnes, gcmTonnes, atmTonnes, tareTonnes });
  return { label, vehicleType, ...masses, tareTonnes, axleCount, wahvaAccredited, sortOrder };
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
    if (isFieldError(vehicleType)) return vehicleType;
    out.vehicleType = vehicleType;
  }
  if (bodyHas(body, "gvm_tonnes", "gvmTonnes")) {
    const gvmTonnes = readMass(body, "gvm_tonnes", "gvmTonnes", TRUCK_REGO_GVM_LABEL, false);
    if (isFieldError(gvmTonnes)) return gvmTonnes;
    out.gvmTonnes = gvmTonnes;
  }
  if (bodyHas(body, "gcm_tonnes", "gcmTonnes")) {
    const gcmTonnes = readMass(body, "gcm_tonnes", "gcmTonnes", TRUCK_REGO_GCM_LABEL, false);
    if (isFieldError(gcmTonnes)) return gcmTonnes;
    out.gcmTonnes = gcmTonnes;
  }
  if (bodyHas(body, "atm_tonnes", "atmTonnes")) {
    const atmTonnes = readMass(body, "atm_tonnes", "atmTonnes", TRUCK_REGO_ATM_LABEL, false);
    if (isFieldError(atmTonnes)) return atmTonnes;
    out.atmTonnes = atmTonnes;
  }
  if (bodyHas(body, "tare_tonnes", "tareTonnes")) {
    const tareTonnes = parseTonnes(body.tare_tonnes ?? body.tareTonnes, TRUCK_REGO_TARE_LABEL, { required: true });
    if (isFieldError(tareTonnes)) return tareTonnes;
    if (tareTonnes == null) return { error: `${TRUCK_REGO_TARE_LABEL} is required` };
    out.tareTonnes = tareTonnes;
  }
  if (bodyHas(body, "axle_count", "axleCount")) {
    const axleCount = parseAxleCount(body.axle_count ?? body.axleCount);
    if (isFieldError(axleCount)) return axleCount;
    out.axleCount = axleCount;
  }
  if ("wahva_accredited" in body || "wahvaAccredited" in body) {
    const wahvaAccredited = parseWahvaAccredited(body.wahva_accredited ?? body.wahvaAccredited);
    if (isFieldError(wahvaAccredited)) return wahvaAccredited;
    out.wahvaAccredited = wahvaAccredited;
  }

  if (Object.keys(out).length === 0) return { error: "No fields to update" };

  if (out.vehicleType) {
    const masses = massesForVehicleType(out.vehicleType, out);
    out.gvmTonnes = masses.gvmTonnes;
    out.gcmTonnes = masses.gcmTonnes;
    out.atmTonnes = masses.atmTonnes;
    if (masses.tareTonnes != null) out.tareTonnes = masses.tareTonnes;
  }
  return out;
}

export function serializeTruckRego(row: {
  id: string;
  label: string;
  sortOrder: number;
  vehicleType?: string | null;
  gvmTonnes?: number | null;
  gcmTonnes?: number | null;
  atmTonnes?: number | null;
  tareTonnes?: number | null;
  axleCount?: number | null;
  wahvaAccredited?: boolean | null;
  /** Legacy combined mass — used only if the split columns are still empty. */
  gvmGcmTonnes?: number | null;
  axleGroups?: number | null;
}) {
  const vehicleType = isVehicleType(row.vehicleType) ? row.vehicleType : null;
  const gvmTonnes = row.gvmTonnes ?? (usesGvmGcm(vehicleType) ? row.gvmGcmTonnes ?? null : null);
  const axleCount =
    row.axleCount != null && isAxleCount(row.axleCount)
      ? row.axleCount
      : row.axleGroups != null && isAxleCount(row.axleGroups)
        ? row.axleGroups
        : null;
  return {
    id: row.id,
    label: row.label,
    sort_order: row.sortOrder,
    vehicle_type: vehicleType,
    gvm_tonnes: gvmTonnes,
    gcm_tonnes: row.gcmTonnes ?? null,
    atm_tonnes: row.atmTonnes ?? null,
    tare_tonnes: row.tareTonnes ?? null,
    axle_count: axleCount,
    wahva_accredited: Boolean(row.wahvaAccredited),
  };
}

export function recordFromApiRego(rego: {
  vehicle_type?: string | null;
  gvm_tonnes?: number | null;
  gcm_tonnes?: number | null;
  atm_tonnes?: number | null;
  tare_tonnes?: number | null;
  axle_count?: number | null;
  wahva_accredited?: boolean | null;
}): Pick<TruckRegoRecord, "vehicleType" | "gvmTonnes" | "gcmTonnes" | "atmTonnes" | "tareTonnes" | "axleCount" | "wahvaAccredited"> {
  return {
    vehicleType: isVehicleType(rego.vehicle_type) ? rego.vehicle_type : null,
    gvmTonnes: rego.gvm_tonnes ?? null,
    gcmTonnes: rego.gcm_tonnes ?? null,
    atmTonnes: rego.atm_tonnes ?? null,
    tareTonnes: rego.tare_tonnes ?? null,
    axleCount: rego.axle_count ?? null,
    wahvaAccredited: Boolean(rego.wahva_accredited),
  };
}
