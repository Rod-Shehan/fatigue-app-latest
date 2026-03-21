import type { JurisdictionCode } from "./types";
import { isNhvrProvisionalEnabled } from "./flags";

/** Base option always available. */
export const JURISDICTION_OPTIONS: readonly { value: JurisdictionCode; label: string }[] = [
  { value: "WA_OSH_3132", label: "Western Australia — OSH Reg 3.132" },
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
