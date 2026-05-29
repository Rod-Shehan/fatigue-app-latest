"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listSheetsOfflineFirst } from "@/lib/offline-api";
import { getThisWeekSunday, normalizeWeekDateString } from "@/lib/weeks";
import type { FatigueSheet } from "@/lib/api";

/** Past weeks for this driver that still need signature (status not completed). */
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
      const second = s.second_driver?.trim().toLowerCase();
      const isMySheet = primary === me || second === me;
      return (
        isMySheet &&
        s.week_starting &&
        normalizeWeekDateString(s.week_starting) < thisSun &&
        s.status !== "completed"
      );
    });
  }, [sheets, driverName]);
}
