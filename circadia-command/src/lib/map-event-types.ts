/**
 * Shared MapEvent type for Event Tracker UI (client-safe — no Prisma).
 */
import type { History1mPoint } from "@/lib/geo-history-1m";

export type MapEvent = {
  lat: number;
  lng: number;
  type: string;
  time: string;
  driver_name: string;
  sheetId: string;
  week_starting: string;
  day_label?: string;
  accuracy?: number;
  history_1m?: History1mPoint[];
};
