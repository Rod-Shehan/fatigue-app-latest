/**
 * Audit identity for the three checklist modules.
 * Each type is a separate call-up (WAHVA / WHS / CoR) — never merge packs.
 *
 * Prestart: vehicle registration first, driver second.
 * FFW: driver name.
 * Dimension & Load: the loaded combination (trailer/dolly when present, else rigid/prime).
 */

import type { ChecklistRecord, ChecklistRecordType } from "./record";

export type LoadCombinationUnitRole = "trailer" | "dolly";

export type LoadCombinationUnit = {
  role: LoadCombinationUnitRole;
  rego: string;
};

export function headerString(
  header: ChecklistRecord["header"] | undefined,
  key: string
): string {
  const v = header?.[key];
  return v == null ? "" : String(v).trim();
}

/** Split stored "ABC, DEF" lists from Dimension & Load headers. */
export function parseRegoList(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function unitsFromLoadHeader(
  header: ChecklistRecord["header"] | undefined
): LoadCombinationUnit[] {
  const trailers = parseRegoList(headerString(header, "trailer_regos") || headerString(header, "trailer_rego"));
  const dollies = parseRegoList(headerString(header, "dolly_regos"));
  const units: LoadCombinationUnit[] = [
    ...trailers.map((rego) => ({ role: "trailer" as const, rego })),
    ...dollies.map((rego) => ({ role: "dolly" as const, rego })),
  ];
  return units;
}

export function formatLoadCombinationLine(opts: {
  truckRego: string;
  units: LoadCombinationUnit[];
}): string {
  const truck = opts.truckRego.trim();
  const bits: string[] = [];
  if (truck) bits.push(`Prime ${truck}`);
  for (const u of opts.units) {
    const reg = u.rego.trim();
    if (!reg) continue;
    bits.push(u.role === "dolly" ? `Dolly ${reg}` : `Trailer ${reg}`);
  }
  return bits.join(" + ") || "—";
}

/**
 * CoR / load audit key: first trailer, else first dolly, else prime mover.
 * WAHVA prestart stays on the vehicle being inspected (usually the prime).
 */
export function loadAuditVehicleRego(opts: {
  truckRego: string;
  units: LoadCombinationUnit[];
}): string {
  const trailer = opts.units.find((u) => u.role === "trailer" && u.rego.trim());
  if (trailer) return trailer.rego.trim();
  const dolly = opts.units.find((u) => u.role === "dolly" && u.rego.trim());
  if (dolly) return dolly.rego.trim();
  return opts.truckRego.trim();
}

export function serializeLoadCombinationHeader(opts: {
  truckRego: string;
  units: LoadCombinationUnit[];
  client?: string;
  driverName?: string;
  loadType?: string;
  loadWeight?: string;
}): Record<string, string> {
  const truck = opts.truckRego.trim();
  const units = opts.units
    .map((u) => ({ role: u.role, rego: u.rego.trim() }))
    .filter((u) => u.rego);
  const trailers = units.filter((u) => u.role === "trailer").map((u) => u.rego);
  const dollies = units.filter((u) => u.role === "dolly").map((u) => u.rego);
  const combination = formatLoadCombinationLine({ truckRego: truck, units });
  const auditKey = loadAuditVehicleRego({ truckRego: truck, units });
  const header: Record<string, string> = {};
  if (opts.client?.trim()) header.client = opts.client.trim();
  if (opts.driverName?.trim()) header.driver_name = opts.driverName.trim();
  if (truck) header.truck_rego = truck;
  if (trailers[0]) header.trailer_rego = trailers[0];
  if (trailers.length) header.trailer_regos = trailers.join(", ");
  if (dollies.length) header.dolly_regos = dollies.join(", ");
  if (opts.loadType?.trim()) header.load_type = opts.loadType.trim();
  if (opts.loadWeight?.trim()) header.load_weight = opts.loadWeight.trim();
  if (combination !== "—") header.combination = combination;
  if (auditKey) header.audit_vehicle = auditKey;
  return header;
}

export function lastLoadCombinationFromRecords(
  records: ChecklistRecord[] | undefined | null
): { truckRego: string; units: LoadCombinationUnit[] } | null {
  const loads = (records ?? []).filter((r) => r.type === "dimension_load");
  const last = loads[loads.length - 1];
  if (!last) return null;
  const truckRego = headerString(last.header, "truck_rego");
  const units = unitsFromLoadHeader(last.header);
  if (!truckRego && units.length === 0) return null;
  return { truckRego, units };
}

export function checklistAuditIdentity(record: ChecklistRecord): {
  type: ChecklistRecordType;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  summary: string;
} {
  const driver = headerString(record.header, "driver_name");
  if (record.type === "ffw") {
    return {
      type: "ffw",
      primaryLabel: "Driver",
      primaryValue: driver || "—",
      secondaryLabel: "",
      secondaryValue: "",
      summary: driver || "Fitness for Work",
    };
  }
  if (record.type === "prestart") {
    const vehicle =
      headerString(record.header, "vehicle_rego") || headerString(record.header, "truck_rego");
    return {
      type: "prestart",
      primaryLabel: "Vehicle",
      primaryValue: vehicle || "—",
      secondaryLabel: "Driver",
      secondaryValue: driver,
      summary: vehicle ? `Vehicle ${vehicle}` : driver || "Prestart",
    };
  }
  const combination = headerString(record.header, "combination");
  const auditVehicle = headerString(record.header, "audit_vehicle");
  const client = headerString(record.header, "client");
  return {
    type: "dimension_load",
    primaryLabel: "Load / combination",
    primaryValue: combination || auditVehicle || "—",
    secondaryLabel: "Driver",
    secondaryValue: driver,
    summary: [client, combination || auditVehicle].filter(Boolean).join(" · ") || "Dimension & Load",
  };
}
