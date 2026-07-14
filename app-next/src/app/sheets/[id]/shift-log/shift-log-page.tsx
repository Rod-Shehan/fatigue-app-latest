"use client";

import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSheetOfflineFirst } from "@/lib/offline-api";
import { PageHeader } from "@/components/PageHeader";
import { PRODUCT_NAME } from "@/lib/branding";
import { useSession } from "next-auth/react";
import { getDisplayNameFromSession } from "@/lib/session-display-name";
import { isFleetManagerRole } from "@/lib/roles";
import { resolveSheetDriverDisplayName } from "@/lib/sheet-driver-display-name";
import { FileText, Loader2 } from "lucide-react";
import ShiftLogView from "@/components/fatigue/ShiftLogView";

const LAST_SHEET_KEY = "fatigue-last-sheet-id";

export default function ShiftLogPage({ sheetId }: { sheetId: string }) {
  const { data: session, status: sessionStatus } = useSession();
  const sessionRole = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const isManager = isFleetManagerRole(sessionRole);
  useEffect(() => {
    if (sheetId) {
      try {
        sessionStorage.setItem(LAST_SHEET_KEY, sheetId);
      } catch {
        /* ignore */
      }
    }
  }, [sheetId]);

  const { data: sheet, isLoading } = useQuery({
    queryKey: ["sheet", sheetId],
    queryFn: () => getSheetOfflineFirst(sheetId),
  });

  if (isLoading || !sheet) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-6">
        <div className="max-w-[800px] mx-auto px-4 py-6">
          <PageHeader
            backHref={`/sheets/${sheetId}`}
            backLabel={PRODUCT_NAME}
            title="Shift Log"
            subtitle="Loading…"
            driverDisplayName={isManager ? undefined : getDisplayNameFromSession(session ?? null) || undefined}
            icon={<FileText className="w-5 h-5" />}
          />
          <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading shift log…</p>
          </div>
        </div>
      </div>
    );
  }

  const days = sheet.days ?? [];
  const weekStarting = sheet.week_starting ?? "";
  const sheetDriverName = (sheet.driver_name || "").trim();

  const subtitle = [
    weekStarting && `Week starting ${new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const sessionDisplayName = getDisplayNameFromSession(session ?? null);
  const resolvedDriverName = resolveSheetDriverDisplayName({
    sheetDriverName,
    sessionDisplayName,
    isFleetOversight: isManager,
    sessionLoading: sessionStatus === "loading",
  });

  const driverDisplayName = isManager ? undefined : sessionDisplayName || sheetDriverName || undefined;

  const driverIdentity =
    resolvedDriverName && resolvedDriverName !== "—"
      ? {
          name: resolvedDriverName,
          isManagerView: isManager,
        }
      : undefined;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-6">
      <div className="max-w-[800px] mx-auto px-4 py-6">
        <PageHeader
          backHref={`/sheets/${sheetId}`}
          backLabel={PRODUCT_NAME}
          title="Shift Log"
          subtitle={subtitle || undefined}
          driverDisplayName={driverDisplayName}
          driverIdentity={driverIdentity}
          icon={<FileText className="w-5 h-5" />}
        />
        <ShiftLogView days={days} weekStarting={weekStarting} />
      </div>
    </div>
  );
}
