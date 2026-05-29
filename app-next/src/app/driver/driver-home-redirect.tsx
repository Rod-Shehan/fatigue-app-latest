"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { listSheetsOfflineFirst } from "@/lib/offline-api";
import { findSheetForWeekStarting, getThisWeekSunday } from "@/lib/weeks";
import { Button } from "@/components/ui/button";

/** Send drivers straight to this week's sheet (or create it). */
export function DriverHomeRedirect() {
  const router = useRouter();
  const { data: sheets, isLoading, isError } = useQuery({
    queryKey: ["sheets"],
    queryFn: () => listSheetsOfflineFirst(),
  });

  useEffect(() => {
    if (isLoading || !sheets) return;
    const thisSunday = getThisWeekSunday();
    const currentWeek = findSheetForWeekStarting(sheets, thisSunday);
    if (currentWeek?.id) {
      router.replace(`/sheets/${currentWeek.id}`);
      return;
    }
    // Always create/open the regulatory current week — never an older open draft.
    router.replace("/sheets/new");
  }, [isLoading, sheets, router]);

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 px-4 text-center">
        <p className="text-slate-600 dark:text-slate-300">Could not load your records.</p>
        <Link href="/sheets">
          <Button variant="outline">Your weeks</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950 px-4">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-hidden />
      <p className="text-sm text-slate-500 dark:text-slate-400">Opening this week…</p>
    </div>
  );
}
