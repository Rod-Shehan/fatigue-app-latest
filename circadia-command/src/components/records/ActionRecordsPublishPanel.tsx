"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  commandCard,
  commandLabel,
  commandPrimaryButton,
  commandSectionTitle,
  commandTextMuted,
} from "@/components/command/command-styles";
import {
  ACTION_RECORD_PACK_LABELS,
  ACTION_RECORD_PACKS,
  ACTION_RECORD_WINDOW_LABELS,
  ACTION_RECORD_WINDOWS,
  type ActionRecordPack,
  type ActionRecordPreview,
  type ActionRecordWindow,
} from "@/lib/action-records-publish";
import { cn } from "@/lib/utils";

function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

export function ActionRecordsPublishPanel() {
  const [window, setWindow] = useState<ActionRecordWindow>("24h");
  const [pack, setPack] = useState<ActionRecordPack>("list");
  const [preview, setPreview] = useState<ActionRecordPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async (nextWindow: ActionRecordWindow) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/records/publish?window=${nextWindow}&preview=1`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as ActionRecordPreview & { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Could not load action records.");
      setPreview(body);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Could not load action records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreview(window);
  }, [loadPreview, window]);

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/records/publish?window=${window}&pack=${pack}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Could not publish action records.");
      }
      const blob = await res.blob();
      const fallback =
        pack === "video"
          ? `circadia-command-action-records-video-${window}.zip`
          : `circadia-command-action-records-list-${window}.csv`;
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = filenameFromDisposition(res.headers.get("Content-Disposition"), fallback);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish action records.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={cn(commandCard, "p-5")}>
        <h2 className={commandSectionTitle}>Publish</h2>
        <p className={cn("mt-1 text-sm", commandTextMuted)}>
          Download actioned Command events for the selected window. The list is a CSV of metadata
          and the action taken. The video pack is a report with clips, the same metadata, and a CSV.
        </p>

        <fieldset className="mt-5">
          <legend className={commandLabel}>Window</legend>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {ACTION_RECORD_WINDOWS.map((value) => (
              <label
                key={value}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/40"
              >
                <input
                  type="radio"
                  name="action-record-window"
                  checked={window === value}
                  onChange={() => setWindow(value)}
                />
                {ACTION_RECORD_WINDOW_LABELS[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className={commandLabel}>Pack</legend>
          <div className="mt-2 flex flex-col gap-2">
            {ACTION_RECORD_PACKS.map((value) => (
              <label
                key={value}
                className="inline-flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/40"
              >
                <input
                  type="radio"
                  name="action-record-pack"
                  className="mt-0.5"
                  checked={pack === value}
                  onChange={() => setPack(value)}
                />
                <span>{ACTION_RECORD_PACK_LABELS[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={commandPrimaryButton}
            disabled={loading || publishing || !preview}
            onClick={() => void publish()}
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            {publishing ? "Publishing…" : "Publish"}
          </button>
          <p className={cn("text-sm", commandTextMuted)}>
            {loading
              ? "Loading preview…"
              : preview
                ? `${preview.count} actioned event${preview.count === 1 ? "" : "s"} in ${preview.windowLabel.toLowerCase()}${preview.truncated ? " (first 500)" : ""}`
                : "No preview"}
          </p>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </section>

      <section className={cn(commandCard, "overflow-hidden")}>
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h2 className={commandSectionTitle}>Preview</h2>
        </div>
        {loading ? (
          <p className={cn("px-5 py-8 text-sm", commandTextMuted)}>Loading actioned events…</p>
        ) : !preview || preview.records.length === 0 ? (
          <p className={cn("px-5 py-8 text-sm", commandTextMuted)}>
            No actioned events in this window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Event time</th>
                  <th className="px-4 py-2 font-medium">Driver</th>
                  <th className="px-4 py-2 font-medium">Vehicle</th>
                  <th className="px-4 py-2 font-medium">Outcome</th>
                  <th className="px-4 py-2 font-medium">Action taken</th>
                </tr>
              </thead>
              <tbody>
                {preview.records.map((row) => (
                  <tr
                    key={row.lifecycleId}
                    className="border-t border-slate-200 dark:border-slate-800"
                  >
                    <td className="px-4 py-2 whitespace-nowrap">{row.eventAtLabel}</td>
                    <td className="px-4 py-2">{row.driverName || "—"}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{row.vehicleRego || "—"}</td>
                    <td className="px-4 py-2">{row.outcome}</td>
                    <td className="px-4 py-2">{row.actionTaken}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
