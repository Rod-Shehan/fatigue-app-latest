"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listSheetsOfflineFirst } from "@/lib/offline-api";
import { getThisWeekSunday } from "@/lib/weeks";
import { isUnsignedPastWeekSheet } from "@/lib/sheet-record";
import type { FatigueSheet } from "@/lib/api";

/** Past weeks for this driver that still need a week signature (same rule as the open sheet). */
export function useUnsignedPastWeeks(driverName: string | undefined) {
  const { data: sheets = [] } = useQuery({
    queryKey: ["sheets"],
    queryFn: () => listSheetsOfflineFirst(),
  });

  return useMemo(() => {
    const me = (driverName ?? "").trim().toLowerCase();
    if (!me) return [] as FatigueSheet[];
    const thisSun = getThisWeekSunday();
    return sheets.filter((s) => {
      const primary = s.driver_name?.trim().toLowerCase();
      return (
        primary === me &&
        isUnsignedPastWeekSheet(s.week_starting, s.status, s.signature, thisSun)
      );
    });
  }, [sheets, driverName]);
}
