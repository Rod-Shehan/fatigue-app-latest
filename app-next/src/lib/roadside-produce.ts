import { ROADSIDE_PRODUCE_DAYS } from "@/lib/roadside-pdf";
import { formatSheetDisplayDate, getSheetDayDateString, normalizeWeekDateString } from "@/lib/weeks";

/** Inclusive calendar-day window ending on `toYmd` (Perth regulatory day). */
export function getRoadsideProduceFromYmd(toYmd: string, days: number = ROADSIDE_PRODUCE_DAYS): string {
  const [y, m, d] = toYmd.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const yy = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, "0");
  const dd = String(start.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** True when any day of the Sunday-based week overlaps [fromYmd, toYmd]. */
export function weekOverlapsProduceWindow(
  weekStarting: string,
  fromYmd: string,
  toYmd: string
): boolean {
  const ws = normalizeWeekDateString(weekStarting);
  for (let i = 0; i < 7; i++) {
    const day = getSheetDayDateString(ws, i);
    if (day >= fromYmd && day <= toYmd) return true;
  }
  return false;
}

export function selectSheetsForRoadsideProduce<T extends { weekStarting: string }>(
  sheets: T[],
  fromYmd: string,
  toYmd: string
): T[] {
  return sheets
    .filter((s) => s.weekStarting && weekOverlapsProduceWindow(s.weekStarting, fromYmd, toYmd))
    .sort((a, b) =>
      normalizeWeekDateString(a.weekStarting).localeCompare(normalizeWeekDateString(b.weekStarting))
    );
}

export function formatProduceWindowLabel(fromYmd: string, toYmd: string): string {
  return `${formatSheetDisplayDate(fromYmd)} – ${formatSheetDisplayDate(toYmd)}`;
}
