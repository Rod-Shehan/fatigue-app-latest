/** Local HH:MM for time inputs on a sheet calendar day (display only — rules use event ISO times). */
export function isoToLocalHHMM(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Build an ISO timestamp for HH:MM on a sheet day YYYY-MM-DD (local wall clock on that day). */
export function hhmmOnSheetDayToIso(sheetDayYmd: string, hhmm: string): string {
  return new Date(`${sheetDayYmd}T${hhmm}:00`).toISOString();
}

export function sheetDayEndMs(sheetDayYmd: string): number {
  return new Date(`${sheetDayYmd}T23:59:59`).getTime();
}
