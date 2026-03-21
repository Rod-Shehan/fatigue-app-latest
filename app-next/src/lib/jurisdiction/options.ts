import type { JurisdictionCode } from "./types";

/** UI labels for sheet-level jurisdiction (extend when new engines ship). */
export const JURISDICTION_OPTIONS: readonly { value: JurisdictionCode; label: string }[] = [
  { value: "WA_OSH_3132", label: "Western Australia — OSH Reg 3.132" },
] as const;
