/** Circadia24 checklist kit brand tokens (PDF / docs). UI uses `:root` / `.dark` `--ck-*` RGB channels. */

export const CHECKLIST_BRAND = {
  midnight: "#0A1118",
  slate: "#16222F",
  cobalt: "#007AFF",
  cobaltAlt: "#1E88E5",
  emerald: "#10B981",
  red: "#EF4444",
  steel: "#64748B",
  border: "#2A3B50",
} as const;

/** Light-mode surfaces for checklist UI (mirrors globals.css `:root` `--ck-*`). */
export const CHECKLIST_BRAND_LIGHT = {
  midnight: "#F8FAFC",
  slate: "#F1F5F9",
  border: "#CBD5E1",
  fg: "#0F172A",
} as const;
