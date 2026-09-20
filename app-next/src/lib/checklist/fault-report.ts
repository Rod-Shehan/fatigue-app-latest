/**
 * WAHVA maintenance-module Fault report.
 * Same concept as a pre-departure Fault tick — a separate signed record is still required.
 * Not a week-PDF tick. Workshop repair block is not required for the driver to save.
 */

import type { ChecklistFaultMobility } from "./item-types";

export const FAULT_REPORT_FORM_TITLE = "Fault report";

export const FAULT_REPORT_DRIVER_NOTE =
  "A Fault on pre-departure does not replace this form. Complete both when the finding is from an inspection.";

export const FAULT_REPORT_WORKSHOP_NOTE =
  "Workshop completes after repair — not required to save.";

export const FAULT_REPORT_PLANTS = ["vehicle", "trailer", "forklift"] as const;
export type FaultReportPlant = (typeof FAULT_REPORT_PLANTS)[number];

export const FAULT_REPORT_PLANT_LABEL: Record<FaultReportPlant, string> = {
  vehicle: "Vehicle",
  trailer: "Trailer",
  forklift: "Forklift",
};

export const FAULT_REPORT_READING_UNITS = ["odometer_km", "hour_meter"] as const;
export type FaultReportReadingUnit = (typeof FAULT_REPORT_READING_UNITS)[number];

export const FAULT_REPORT_READING_UNIT_LABEL: Record<FaultReportReadingUnit, string> = {
  odometer_km: "Odometer (km)",
  hour_meter: "Hour meter",
};

/** Fault level. Maps onto existing defect mobility for storage. */
export const FAULT_REPORT_SEVERITIES = [
  "operational",
  "restricted",
  "inoperable",
] as const;
export type FaultReportSeverity = (typeof FAULT_REPORT_SEVERITIES)[number];

export const FAULT_REPORT_SEVERITY_LABEL: Record<FaultReportSeverity, string> = {
  operational: "Ok to drive",
  restricted: "Drive with restriction",
  inoperable: "Out of service",
};

export const FAULT_REPORT_SEVERITY_TO_MOBILITY: Record<
  FaultReportSeverity,
  ChecklistFaultMobility
> = {
  operational: "can_drive",
  restricted: "need_advice",
  inoperable: "cannot_move",
};

export function isFaultReportPlant(v: unknown): v is FaultReportPlant {
  return v === "vehicle" || v === "trailer" || v === "forklift";
}

export function isFaultReportSeverity(v: unknown): v is FaultReportSeverity {
  return v === "operational" || v === "restricted" || v === "inoperable";
}

export function isFaultReportReadingUnit(v: unknown): v is FaultReportReadingUnit {
  return v === "odometer_km" || v === "hour_meter";
}

/** `datetime-local` value in Australia/Perth. */
export function perthDateTimeLocalNow(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatPerthDateTimeLocal(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return value.trim();
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]} AWST`;
}
