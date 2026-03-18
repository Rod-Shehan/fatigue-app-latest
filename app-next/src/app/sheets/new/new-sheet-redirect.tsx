"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSheetOfflineFirst, listSheetsOfflineFirst } from "@/lib/offline-api";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

const EMPTY_DAY = () => ({
  day_label: "",
  date: "",
  truck_rego: "",
  destination: "",
  start_kms: null,
  end_kms: null,
  work_time: Array(48).fill(false),
  breaks: Array(48).fill(false),
  non_work: Array(48).fill(false),
});

function getThisWeekSunday() {
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  return sunday.toISOString().split("T")[0];
}

function defaultDisplayNameFromSession(session: ReturnType<typeof useSession>["data"]): string {
  const raw =
    (typeof session?.user?.name === "string" && session.user.name.trim()) ||
    (typeof session?.user?.email === "string" && session.user.email.trim()) ||
    "";
  if (!raw) return "";
  if (raw.includes("@")) return raw.split("@")[0] || "";
  return raw;
}

export function NewSheetRedirect() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const defaultDriverName = defaultDisplayNameFromSession(session);
  const createMutation = useMutation({
    mutationFn: () =>
      createSheetOfflineFirst({
        driver_name: defaultDriverName,
        second_driver: "",
        driver_type: "solo",
        destination: "",
        week_starting: getThisWeekSunday(),
        days: Array(7)
          .fill(null)
          .map(() => EMPTY_DAY()),
        status: "draft",
      }),
    onSuccess: (sheet) => {
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      router.replace(`/sheets/${sheet.id}`);
    },
  });

  useEffect(() => {
    if (status === "loading") return;
    // If a draft sheet already exists, open it instead of creating another.
    listSheetsOfflineFirst()
      .then((sheets) => {
        const draft = sheets.find((s) => s.status !== "completed");
        if (draft?.id) {
          router.replace(`/sheets/${draft.id}`);
          return;
        }
        createMutation.mutate();
      })
      .catch(() => createMutation.mutate());
  }, [status]);

  const errBody =
    createMutation.error &&
    (createMutation.error as Error & { body?: { sheet_id?: string } }).body;
  const sheetId = errBody?.sheet_id;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 px-4">
      {createMutation.isPending && (
        <p className="text-slate-500 dark:text-slate-400">Creating new sheet…</p>
      )}
      {createMutation.isSuccess && <p className="text-slate-500 dark:text-slate-400">Redirecting…</p>}
      {createMutation.isError && (
        <div className="max-w-md text-center space-y-3">
          <p className="text-red-600 dark:text-red-400 font-medium">
            {createMutation.error instanceof Error ? createMutation.error.message : "Failed to create sheet."}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Complete and sign this week&apos;s sheet before starting next week.
          </p>
          {sheetId && (
            <Link href={`/sheets/${sheetId}`}>
              <Button variant="outline" className="mt-2">
                Open this week&apos;s sheet
              </Button>
            </Link>
          )}
          <Link href="/sheets">
            <Button variant="ghost">Back to sheets</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
