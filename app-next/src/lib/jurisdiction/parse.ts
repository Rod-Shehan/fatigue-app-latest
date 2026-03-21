import type { JurisdictionCode } from "./types";
import { DEFAULT_JURISDICTION_CODE } from "./types";

const IMPLEMENTED = new Set<string>(["WA_OSH_3132"]);

/**
 * Parse stored or client-supplied jurisdiction; unknown values fall back to default (WA).
 */
export function parseJurisdictionCode(input: unknown): JurisdictionCode {
  if (typeof input === "string" && IMPLEMENTED.has(input)) {
    return input as JurisdictionCode;
  }
  return DEFAULT_JURISDICTION_CODE;
}
