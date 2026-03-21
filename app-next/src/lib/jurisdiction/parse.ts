import type { JurisdictionCode } from "./types";
import { DEFAULT_JURISDICTION_CODE } from "./types";
import { isNhvrProvisionalEnabled } from "./flags";

function allowedCodes(): Set<string> {
  const s = new Set<string>(["WA_OSH_3132"]);
  if (isNhvrProvisionalEnabled()) s.add("NHVR_PROVISIONAL");
  return s;
}

/**
 * Parse stored or client-supplied jurisdiction; unknown values fall back to default (WA).
 * `NHVR_PROVISIONAL` is accepted only when {@link isNhvrProvisionalEnabled} is true; otherwise coerced to WA.
 */
export function parseJurisdictionCode(input: unknown): JurisdictionCode {
  if (typeof input === "string" && input === "NHVR_PROVISIONAL" && !isNhvrProvisionalEnabled()) {
    return DEFAULT_JURISDICTION_CODE;
  }
  if (typeof input === "string" && allowedCodes().has(input)) {
    return input as JurisdictionCode;
  }
  return DEFAULT_JURISDICTION_CODE;
}
