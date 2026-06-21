"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { ManagerSubnav } from "@/components/manager/ManagerSubnav";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { api, type CameraAlertItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Bell, ExternalLink, Loader2, Radio, Video } from "lucide-react";
import { cn } from "@/lib/utils";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function tierChipClass(tier: string | null, accepted: boolean) {
  if (!accepted) return "bg-slate-500 text-white";
  if (tier === "core") return "bg-rose-600 text-white";
  if (tier === "fatigue_adjacent") return "bg-amber-600 text-white";
  return "bg-sky-600 text-white";
}

function AlertCard({
  alert,
  selected,
  onSelect,
}: {
  alert: CameraAlertItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-teal-600 bg-teal-50/80 shadow-sm dark:border-teal-500 dark:bg-teal-950/40"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {alert.displayName ?? "Camera event"}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {alert.vehicleRego ? `Rego ${alert.vehicleRego}` : "Vehicle unknown"}
            {alert.driverName ? ` · ${alert.driverName}` : ""}
          </p>
          <p className="text-xs text-slate-500 mt-1">{formatWhen(alert.receivedAt)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
            tierChipClass(alert.tier, alert.accepted)
          )}
        >
          {alert.accepted ? (alert.tier === "core" ? "Priority" : "Monitor") : "Filtered"}
        </span>
      </div>
      {alert.mediaPending && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Video pending…</p>
      )}
      {alert.mediaUrl && (
        <p className="mt-2 text-xs text-teal-700 dark:text-teal-400 flex items-center gap-1">
          <Video className="h-3.5 w-3.5" aria-hidden />
          Clip available
        </p>
      )}
    </button>
  );
}

function AlertDetail({ alert }: { alert: CameraAlertItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {alert.displayName ?? "Camera event"}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {alert.vehicleRego ? `Rego ${alert.vehicleRego}` : "Vehicle unknown"}
          {alert.driverName ? ` · ${alert.driverName}` : ""}
        </p>
        <p className="text-xs text-slate-500 mt-1">{formatWhen(alert.receivedAt)}</p>
        {!alert.accepted && alert.rejectReason && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {alert.eventWebhookPending
              ? "Autonomise sent video metadata but not the event webhook — check Event URL in Autonomise API settings."
              : `Not shown in coaching workflow: ${alert.rejectReason.replace(/_/g, " ")}`}
          </p>
        )}
      </div>

      <div className="mb-4 aspect-video w-full overflow-hidden rounded-lg bg-black/90 flex items-center justify-center">
        {alert.mediaUrl ? (
          <video
            key={alert.mediaUrl}
            src={alert.mediaUrl}
            className="max-h-full max-w-full"
            controls
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="px-4 text-center text-sm text-slate-400">
            {alert.mediaPending
              ? "Video not ready yet — Autonomise may send a media webhook shortly."
              : "No video for this event."}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        {MANAGER_EXPERIENCE.ALERTS_WORKFLOW_HINT}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="flex-1" disabled title="Coming soon">
          Authorize follow-up
        </Button>
        <Button type="button" variant="outline" className="flex-1" disabled title="Coming soon">
          Dismiss as false positive
        </Button>
      </div>

      {alert.mediaUrl && (
        <a
          href={alert.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-teal-700 hover:underline dark:text-teal-400"
        >
          Open clip in new tab
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
    </div>
  );
}

export function ManagerAlertsView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFiltered, setShowFiltered] = useState(false);

  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["manager", "camera-alerts", showFiltered],
    queryFn: () => api.manager.cameraAlerts({ acceptedOnly: !showFiltered }),
    refetchInterval: 12_000,
  });

  const alerts = data?.alerts ?? [];
  const selected = useMemo(
    () => alerts.find((a) => a.id === selectedId) ?? alerts[0] ?? null,
    [alerts, selectedId]
  );

  const liveLabel = data?.configured
    ? isFetching
      ? "Updating…"
      : "Live"
    : "Webhook not configured";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-lg px-4 py-4 md:max-w-5xl md:px-6 md:py-5">
        <PageHeader
          backHref="/manager"
          backLabel={MANAGER_EXPERIENCE.NAV_RISK_BRIEF}
          backText={MANAGER_EXPERIENCE.NAV_OVERVIEW}
          title={MANAGER_EXPERIENCE.NAV_ALERTS}
          icon={<Bell className="h-5 w-5" />}
          compact
          showLobbyLink={false}
        />
        <ManagerSubnav compact />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Radio
              className={cn(
                "h-4 w-4",
                data?.configured ? "text-emerald-600" : "text-amber-600"
              )}
              aria-hidden
            />
            <span>{liveLabel}</span>
            {dataUpdatedAt > 0 && (
              <span className="text-xs text-slate-400">
                · {new Date(dataUpdatedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFiltered((v) => !v)}
          >
            {showFiltered ? "Fatigue only" : "Show filtered"}
          </Button>
        </div>

        {data?.diagnostics?.mediaWithoutMatchingEvent ? (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Media webhook received ({data.diagnostics.ingestMedia}) with no event row at all for{" "}
            {data.diagnostics.mediaWithoutMatchingEvent} clip
            {data.diagnostics.mediaWithoutMatchingEvent === 1 ? "" : "s"}. Check Autonomise Event URL is{" "}
            <code className="text-xs">…/api/integrations/autonomise/events</code> and Red events are included.
          </div>
        ) : null}

        {!data?.configured && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {MANAGER_EXPERIENCE.ALERTS_NOT_CONFIGURED}
          </div>
        )}

        {data?.configured && data?.diagnostics?.apiConfigured === false && alerts.some((a) => a.mediaPending) ? (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Video fetch is not configured — add <code className="text-xs">AUTONOMISE_PRIMARY_KEY</code> on Vercel
            (same Primary API key as Autonomise admin) and redeploy.
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" aria-hidden />
            Loading alerts…
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            Could not load alerts. Try again shortly.
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center dark:border-slate-600 dark:bg-slate-900/40">
            <Bell className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" aria-hidden />
            <p className="font-medium text-slate-800 dark:text-slate-200">{MANAGER_EXPERIENCE.ALERTS_EMPTY_TITLE}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
              {MANAGER_EXPERIENCE.ALERTS_EMPTY_BODY}
            </p>
            <Link href="/manager" className="mt-4 inline-block text-sm text-teal-700 hover:underline dark:text-teal-400">
              Back to overview
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[minmax(0,340px),1fr]">
            <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto md:max-h-[calc(100vh-11rem)]">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  selected={selected?.id === alert.id}
                  onSelect={() => setSelectedId(alert.id)}
                />
              ))}
            </div>
            <div className="md:sticky md:top-4 md:self-start">
              {selected ? (
                <AlertDetail alert={selected} />
              ) : (
                <p className="text-sm text-slate-500">Select an alert</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
