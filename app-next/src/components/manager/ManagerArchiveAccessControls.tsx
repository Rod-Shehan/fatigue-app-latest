"use client";

import { useState } from "react";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import {
  COLD_RETRIEVAL_SLA_BUSINESS_DAYS,
  HOT_WINDOW_ALL_LIVE,
  formatHotWindowSummary,
} from "@/lib/hot-cold-records";

type ManagerArchiveAccessControlsProps = {
  /** Prefill when user tried to open a cold week. */
  defaultFromWeek?: string;
  defaultToWeek?: string;
};

export function ManagerArchiveAccessControls({
  defaultFromWeek = "",
  defaultToWeek = "",
}: ManagerArchiveAccessControlsProps) {
  const [open, setOpen] = useState(false);
  const [fromWeek, setFromWeek] = useState(defaultFromWeek);
  const [toWeek, setToWeek] = useState(defaultToWeek);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setFromWeek(defaultFromWeek);
    setToWeek(defaultToWeek || defaultFromWeek);
    setReason("");
    setMessage(null);
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/manager/archive-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWeekStarting: fromWeek.trim(),
          toWeekStarting: toWeek.trim(),
          reason: reason.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error || MANAGER_EXPERIENCE.ARCHIVE_ACCESS_ERROR);
        return;
      }
      setMessage(data.message || MANAGER_EXPERIENCE.ARCHIVE_ACCESS_SUCCESS);
    } catch {
      setError(MANAGER_EXPERIENCE.ARCHIVE_ACCESS_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 sm:px-6">
        <p className="min-w-0 flex-1 leading-snug">
          {HOT_WINDOW_ALL_LIVE
            ? MANAGER_EXPERIENCE.ARCHIVE_ACCESS_LIVE_BANNER_ALL_HOT
            : formatHotWindowSummary()}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 border-slate-300 text-xs dark:border-slate-600"
          onClick={openDialog}
        >
          <Archive className="h-3.5 w-3.5" aria-hidden />
          {MANAGER_EXPERIENCE.ARCHIVE_ACCESS_CHIP}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{MANAGER_EXPERIENCE.ARCHIVE_ACCESS_TITLE}</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block">{MANAGER_EXPERIENCE.ARCHIVE_ACCESS_HINT}</span>
              <span className="block">
                {MANAGER_EXPERIENCE.ARCHIVE_ACCESS_SLA(COLD_RETRIEVAL_SLA_BUSINESS_DAYS)}
              </span>
              <span className="block">{MANAGER_EXPERIENCE.ARCHIVE_ACCESS_SOR_NOTE}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1">
              <Label htmlFor="archive-from">{MANAGER_EXPERIENCE.ARCHIVE_ACCESS_RANGE_FROM}</Label>
              <Input
                id="archive-from"
                type="date"
                value={fromWeek}
                onChange={(e) => setFromWeek(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="archive-to">{MANAGER_EXPERIENCE.ARCHIVE_ACCESS_RANGE_TO}</Label>
              <Input
                id="archive-to"
                type="date"
                value={toWeek}
                onChange={(e) => setToWeek(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="archive-reason">{MANAGER_EXPERIENCE.ARCHIVE_ACCESS_REASON}</Label>
              <Textarea
                id="archive-reason"
                rows={3}
                value={reason}
                placeholder={MANAGER_EXPERIENCE.ARCHIVE_ACCESS_REASON_PLACEHOLDER}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
              />
            </div>
            {message ? (
              <p className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {MANAGER_EXPERIENCE.ARCHIVE_ACCESS_CANCEL}
            </Button>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !fromWeek.trim() || !toWeek.trim() || reason.trim().length < 3}
            >
              {busy ? "Sending…" : MANAGER_EXPERIENCE.ARCHIVE_ACCESS_SUBMIT}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
