"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const HOURS_OPTIONS = [
  { label: "24 hours", value: 24 },
  { label: "7 days", value: 168 },
  { label: "30 days", value: 720 },
] as const;

export function FalsePositiveExportPanel({ embedded }: { embedded?: boolean }) {
  const [hours, setHours] = useState(168);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/manager/camera-alerts/false-positive-export?hours=${hours}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `false-positive-capture-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={embedded ? "space-y-3" : "rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          False positive export
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Download dismissed events with normalised trigger-reason columns for spreadsheet analysis.
        </p>
      </div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
        Time range
      </label>
      <select
        value={hours}
        onChange={(e) => setHours(Number(e.target.value))}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
      >
        {HOURS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Button type="button" variant="outline" className="w-full" disabled={downloading} onClick={() => void handleExport()}>
        {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}
        Export CSV
      </Button>
      {error ? <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p> : null}
    </div>
  );
}
