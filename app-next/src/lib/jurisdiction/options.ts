import type { JurisdictionCode } from "./types";
import { isNhvrProvisionalEnabled } from "./flags";

/** Base option always available. */
export const JURISDICTION_OPTIONS: readonly { value: JurisdictionCode; label: string }[] = [
  { value: "WA_OSH_3132", label: "WA: WHS r184E · OSH r3.132" },
] as const;

/** Options for the sheet header selector (client); NHVR appears only when flags are on. */
export function getJurisdictionOptions(): { value: JurisdictionCode; label: string }[] {
  const base = [...JURISDICTION_OPTIONS];
  if (isNhvrProvisionalEnabled()) {
    base.push({
      value: "NHVR_PROVISIONAL",
      label: "NHVR BFM (provisional — not certified EWD)",
    });
  }
  return base;
}

/** Human-readable label for PDF / roadside snapshot (not necessarily equal to dropdown text). */
export function jurisdictionDisplayLabel(code: JurisdictionCode): string {
  switch (code) {
    case "WA_OSH_3132":
      return "WA: WHS r184E · OSH r3.132";
    case "NHVR_PROVISIONAL":
      return "NHVR BFM (provisional — not certified EWD)";
    default:
      return code;
  }
}
