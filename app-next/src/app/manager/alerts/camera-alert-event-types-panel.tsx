"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type CameraAlertEventSettingsSnapshot } from "@/lib/api";
import { defaultEnabledAlarmIds } from "@/lib/integrations/fatigue-event-catalogue";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_LABELS: Record<string, string> = {
  core: "Core — fatigue & distraction",
  fatigue_adjacent: "ADAS & fatigue-related",
  safety_other: "Other safety",
};

const PRESET_BUTTONS = [
  { id: "core_only" as const, label: "Fatigue core only" },
  { id: "core_plus_adas" as const, label: "Core + ADAS" },
] as const;

export type CameraAlertOptionsDiagnostics = {
  clipsWithMediaFilteredOut?: number;
  mediaWithoutMatchingEvent?: number;
  ingestMedia?: number;
};

type CollapsibleDiagnosticsBannerProps = {
  tone: "sky" | "amber";
  summary: string;
  children: React.ReactNode;
};

function CollapsibleDiagnosticsBanner({ tone, summary, children }: CollapsibleDiagnosticsBannerProps) {
  const [open, setOpen] = useState(false);
  const toneStyles =
    tone === "sky"
      ? {
          border: "border-sky-300 dark:border-sky-800",
          bg: "bg-sky-50 dark:bg-sky-950/40",
          text: "text-sky-900 dark:text-sky-200",
        }
      : {
          border: "border-amber-300 dark:border-amber-800",
          bg: "bg-amber-50 dark:bg-amber-950/40",
          text: "text-amber-900 dark:text-amber-200",
        };

  return (
    <div className={cn("overflow-hidden rounded-lg border", toneStyles.border, toneStyles.bg)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm",
          toneStyles.text
        )}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 font-medium leading-snug">{summary}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className={cn("border-t px-4 py-3 text-sm leading-relaxed", toneStyles.border, toneStyles.text)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function AlertOptionsDiagnostics({ diagnostics }: { diagnostics: CameraAlertOptionsDiagnostics }) {
  const hiddenCount = diagnostics.clipsWithMediaFilteredOut ?? 0;
  const orphanCount = diagnostics.mediaWithoutMatchingEvent ?? 0;
  if (hiddenCount === 0 && orphanCount === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {hiddenCount > 0 ? (
        <CollapsibleDiagnosticsBanner
          tone="sky"
          summary={`${hiddenCount} alert${hiddenCount === 1 ? "" : "s"} hidden by accepted types`}
        >
          These alerts have video but {hiddenCount === 1 ? "is" : "are"} hidden by your accepted type
          filter — enable types below (for example Following Distance Warning) to see them.
        </CollapsibleDiagnosticsBanner>
      ) : null}
      {orphanCount > 0 ? (
        <CollapsibleDiagnosticsBanner
          tone="amber"
          summary={`${orphanCount} clip${orphanCount === 1 ? "" : "s"} missing event webhook`}
        >
          Media webhook received ({diagnostics.ingestMedia ?? 0}) with no event row at all for these
          clips. Check Autonomise Event URL is{" "}
          <code className="text-xs">…/api/integrations/autonomise/events</code> and Red events are
          included.
        </CollapsibleDiagnosticsBanner>
      ) : null}
    </div>
  );
}

function groupEntriesByTier(entries: CameraAlertEventSettingsSnapshot["entries"]) {
  const groups = new Map<string, CameraAlertEventSettingsSnapshot["entries"]>();
  for (const entry of entries) {
    const list = groups.get(entry.tier) ?? [];
    list.push(entry);
    groups.set(entry.tier, list);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    const order = ["core", "fatigue_adjacent", "safety_other"];
    return order.indexOf(a) - order.indexOf(b);
  });
}

type CameraAlertEventTypesPanelProps = {
  diagnostics?: CameraAlertOptionsDiagnostics;
};

export function CameraAlertEventTypesPanel({ diagnostics }: CameraAlertEventTypesPanelProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[] | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["manager", "camera-alert-event-settings"],
    queryFn: () => api.manager.cameraAlertEventSettings(),
  });

  const settings = data?.settings;
  const enabledIds = draftIds ?? settings?.enabledAlarmIds ?? [];

  useEffect(() => {
    if (settings && draftIds === null) {
      setDraftIds(settings.enabledAlarmIds);
    }
  }, [settings, draftIds]);

  const dirty = useMemo(() => {
    if (!settings || draftIds === null) return false;
    const saved = new Set(settings.enabledAlarmIds);
    if (saved.size !== draftIds.length) return true;
    return draftIds.some((id) => !saved.has(id));
  }, [settings, draftIds]);

  const saveMutation = useMutation({
    mutationFn: (ids: string[]) => api.manager.updateCameraAlertEventSettings(ids),
    onSuccess: (result) => {
      setDraftIds(result.settings.enabledAlarmIds);
      queryClient.setQueryData(["manager", "camera-alert-event-settings"], result);
      queryClient.invalidateQueries({ queryKey: ["manager", "camera-alerts"] });
    },
  });

  const enabledCount = enabledIds.length;
  const totalCount = settings?.entries.length ?? 0;

  function toggleId(id: string) {
    setDraftIds((current) => {
      const ids = current ?? settings?.enabledAlarmIds ?? [];
      if (ids.includes(id)) {
        const next = ids.filter((v) => v !== id);
        return next.length === 0 ? ids : next;
      }
      return [...ids, id];
    });
  }

  function applyPreset(preset: "core_only" | "core_plus_adas") {
    setDraftIds(defaultEnabledAlarmIds(preset));
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
          <SlidersHorizontal className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden />
          Alert Options
          {!isLoading && settings && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              · {enabledCount} of {totalCount} enabled
            </span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          {diagnostics ? <AlertOptionsDiagnostics diagnostics={diagnostics} /> : null}
          <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
            Choose which camera events appear in this inbox and are accepted from Autonomise. Changes
            apply to new webhooks and re-filter recent history.
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading event types…
            </div>
          ) : isError || !settings ? (
            <p className="text-sm text-rose-700 dark:text-rose-300">Could not load event settings.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {PRESET_BUTTONS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyPreset(preset.id)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="space-y-4">
                {groupEntriesByTier(settings.entries).map(([tier, entries]) => (
                  <div key={tier}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {TIER_LABELS[tier] ?? tier}
                    </p>
                    <ul className="space-y-2">
                      {entries.map((entry) => (
                        <li key={entry.vendorAlarmId}>
                          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              checked={enabledIds.includes(entry.vendorAlarmId)}
                              onChange={() => toggleId(entry.vendorAlarmId)}
                            />
                            <span>
                              {entry.displayName}
                              <span className="ml-1 text-xs text-slate-400">({entry.family})</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!dirty || saveMutation.isPending}
                  onClick={() => saveMutation.mutate(enabledIds)}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Save accepted types"
                  )}
                </Button>
                {dirty && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraftIds(settings.enabledAlarmIds)}
                  >
                    Reset
                  </Button>
                )}
                {saveMutation.isError && (
                  <span className="text-xs text-rose-700 dark:text-rose-300">
                    {saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : "Could not save"}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
