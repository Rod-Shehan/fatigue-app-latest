"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { ManagerSubnav } from "@/components/manager/ManagerSubnav";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { api, type CameraAlertItem, type CameraAlertTriageStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, ChevronDown, ExternalLink, Loader2, Radio, Trash2, Video, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CameraAlertEventTypesPanel } from "@/app/manager/alerts/camera-alert-event-types-panel";
import { TriageShiftBanner } from "@/components/manager/TriageShiftBanner";

const HOURS_OPTIONS = [
  { label: "24 hours", value: 24 },
  { label: "48 hours", value: 48 },
  { label: "7 days", value: 168 },
  { label: "30 days", value: 720 },
] as const;

type TriageFilter = "pending" | "all" | "decided";

function formatVehicleDriverLine(alert: CameraAlertItem) {
  const vehicle = alert.vehicleRego
    ? `Rego ${alert.vehicleRego}`
    : alert.deviceHardwareId
      ? `Device ${alert.deviceHardwareId.toUpperCase()}`
      : "Vehicle unknown";
  return alert.driverName ? `${vehicle} · ${alert.driverName}` : vehicle;
}

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

function triageBadge(status: CameraAlertTriageStatus) {
  if (status === "authorized") {
    return {
      label: "Authorized",
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
      icon: CheckCircle2,
    };
  }
  if (status === "dismissed") {
    return {
      label: "Dismissed",
      className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      icon: XCircle,
    };
  }
  return {
    label: "Needs review",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    icon: null,
  };
}

function AlertEventCard({
  alert,
  expanded,
  onToggle,
  collapsible,
  onTriage,
  triagePending,
  triageError,
  allowDelete,
  triageDeskOnShift,
  onDelete,
  deletePending,
  selectionMode,
  selected,
  onSelectChange,
}: {
  alert: CameraAlertItem;
  expanded: boolean;
  onToggle: () => void;
  collapsible: boolean;
  onTriage: (decision: "authorized" | "dismissed", note: string) => void;
  triagePending: boolean;
  triageError: string | null;
  allowDelete: boolean;
  triageDeskOnShift: boolean;
  onDelete: () => void;
  deletePending: boolean;
  selectionMode: boolean;
  selected: boolean;
  onSelectChange: (selected: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [videoError, setVideoError] = useState(false);
  const triage = triageBadge(alert.triageStatus);
  const TriageIcon = triage.icon;
  const canTriage =
    triageDeskOnShift &&
    alert.accepted &&
    !alert.eventWebhookPending &&
    alert.triageStatus === "pending";
  const decided = alert.triageStatus !== "pending";

  useEffect(() => {
    setVideoError(false);
  }, [alert.mediaUrl]);

  return (
    <article
      className={cn(
        "rounded-xl border bg-white shadow-sm transition-colors dark:bg-slate-900",
        selected
          ? "border-rose-400 ring-2 ring-rose-300/60 dark:border-rose-600 dark:ring-rose-900/60"
          : expanded
            ? "border-teal-600 dark:border-teal-500"
            : "border-slate-200 dark:border-slate-700"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {selectionMode && allowDelete ? (
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            checked={selected}
            onChange={(e) => onSelectChange(e.target.checked)}
            aria-label={`Select ${alert.displayName ?? "event"}`}
          />
        ) : null}
        {collapsible ? (
          <button
            type="button"
            onClick={() => (selectionMode ? onSelectChange(!selected) : onToggle())}
            className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left"
            aria-expanded={expanded}
          >
            <AlertEventHeader alert={alert} triage={triage} TriageIcon={TriageIcon} />
            {!selectionMode ? (
              <ChevronDown
                className={cn(
                  "mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform",
                  expanded && "rotate-180"
                )}
                aria-hidden
              />
            ) : null}
          </button>
        ) : (
          <div className="min-w-0 flex-1 pb-0">
            <AlertEventHeader alert={alert} triage={triage} TriageIcon={TriageIcon} />
          </div>
        )}
      </div>

      {expanded && !selectionMode && (
        <div className={cn("px-4 pb-4", collapsible && "border-t border-slate-100 pt-4 dark:border-slate-800")}>
          {!alert.accepted && alert.rejectReason && (
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
              {alert.eventWebhookPending
                ? "Autonomise sent video metadata but not the event webhook — check Event URL in Autonomise API settings."
                : `Not shown in coaching workflow: ${alert.rejectReason.replace(/_/g, " ")}`}
            </p>
          )}

          {decided && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/60">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {alert.triageStatus === "authorized" ? "Follow-up authorized" : "Dismissed as false positive"}
              </p>
              {alert.triageDecidedBy && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {alert.triageDecidedBy}
                  {alert.triageDecidedAt ? ` · ${formatWhen(alert.triageDecidedAt)}` : ""}
                </p>
              )}
              {alert.triageNote && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{alert.triageNote}</p>
              )}
            </div>
          )}

          <div className="mb-3 aspect-video w-full overflow-hidden rounded-lg bg-black/90 flex items-center justify-center">
            {alert.mediaUrl && !videoError ? (
              <video
                key={alert.mediaUrl}
                src={alert.mediaUrl}
                className="max-h-full max-w-full"
                controls
                playsInline
                preload="metadata"
                onError={() => setVideoError(true)}
              />
            ) : alert.mediaUrl && videoError ? (
              <div className="px-4 text-center text-sm text-slate-400">
                <p>Clip could not play in the browser.</p>
                <a
                  href={alert.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-teal-400 hover:underline"
                >
                  Open clip in new tab
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </div>
            ) : (
              <div className="px-4 text-center text-sm text-slate-400">
                {alert.mediaUnavailable
                  ? "No clip from Autonomise for this event — check device alarm is set to Raise Media for fatigue."
                  : alert.mediaPending
                    ? "Fetching clip from Autonomise…"
                    : "No video for this event."}
              </div>
            )}
          </div>

          {canTriage && (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                {MANAGER_EXPERIENCE.ALERTS_WORKFLOW_HINT}
              </p>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. spoke with driver, fatigue after long leg"
                className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              {triageError && (
                <p className="mb-2 text-sm text-rose-700 dark:text-rose-400">{triageError}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="flex-1"
                  disabled={triagePending}
                  onClick={() => onTriage("authorized", note)}
                >
                  {triagePending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Authorize follow-up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={triagePending}
                  onClick={() => onTriage("dismissed", note)}
                >
                  Dismiss as false positive
                </Button>
              </div>
            </>
          )}

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

          {allowDelete && (
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deletePending || triagePending}
                className="text-rose-700 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-900 dark:hover:bg-rose-950/40"
                onClick={() => {
                  const label = alert.displayName ?? "this event";
                  if (
                    window.confirm(
                      `Delete "${label}" from Circadia?\n\nThis removes the stored webhook row and any paired clip. It cannot be undone.`
                    )
                  ) {
                    onDelete();
                  }
                }}
              >
                {deletePending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" aria-hidden />
                )}
                Delete event (testing)
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function AlertEventHeader({
  alert,
  triage,
  TriageIcon,
}: {
  alert: CameraAlertItem;
  triage: ReturnType<typeof triageBadge>;
  TriageIcon: typeof CheckCircle2 | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
          {alert.displayName ?? "Camera event"}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          {formatVehicleDriverLine(alert)}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {alert.triggerAt && alert.triggerAt !== alert.receivedAt
            ? `Detected ${formatWhen(alert.triggerAt)} · received ${formatWhen(alert.receivedAt)}`
            : formatWhen(alert.receivedAt)}
        </p>
        {!alert.mediaUrl && alert.mediaPending && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Fetching clip…</p>
        )}
        {!alert.mediaUrl && alert.mediaUnavailable && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No clip on Autonomise</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
            tierChipClass(alert.tier, alert.accepted)
          )}
        >
          {alert.accepted ? (alert.tier === "core" ? "Priority" : "Monitor") : "Filtered"}
        </span>
        {alert.accepted && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              triage.className
            )}
          >
            {TriageIcon ? <TriageIcon className="h-3 w-3" aria-hidden /> : null}
            {triage.label}
          </span>
        )}
        {alert.mediaUrl && (
          <span className="inline-flex items-center gap-1 text-[10px] text-teal-700 dark:text-teal-400">
            <Video className="h-3 w-3" aria-hidden />
            Clip
          </span>
        )}
      </div>
    </div>
  );
}

export function ManagerAlertsView() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFiltered, setShowFiltered] = useState(false);
  const [hours, setHours] = useState(24);
  const [triageFilter, setTriageFilter] = useState<TriageFilter>("pending");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const queryKey = ["manager", "camera-alerts", showFiltered, hours, triageFilter] as const;

  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      api.manager.cameraAlerts({
        acceptedOnly: !showFiltered,
        hours,
        triageFilter,
        limit: showFiltered ? 200 : undefined,
      }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const shiftQuery = useQuery({
    queryKey: ["triage-shift", "current"],
    queryFn: () => api.triageShiftCurrent(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const triageDeskOnShift = shiftQuery.data?.viewer.onShift ?? false;

  const triageMutation = useMutation({
    mutationFn: (args: { id: string; decision: "authorized" | "dismissed"; note: string; vendorEventId: string | null }) =>
      api.manager.cameraAlertTriage(args.id, {
        decision: args.decision,
        note: args.note || null,
        vendorEventId: args.vendorEventId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager", "camera-alerts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.manager.cameraAlertDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager", "camera-alerts"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const chunkSize = 100;
      const summaries = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        summaries.push(await api.manager.cameraAlertBulkDelete(ids.slice(i, i + chunkSize)));
      }
      return summaries;
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      setSelectionMode(false);
      queryClient.invalidateQueries({ queryKey: ["manager", "camera-alerts"] });
    },
  });

  const allowDelete = data?.testingTools?.allowDelete === true;

  const alerts = data?.alerts ?? [];
  const filteredAlerts = alerts.filter((a) => !a.accepted);
  const collapsible = alerts.length > 1 && !selectionMode;
  const selectedCount = selectedIds.size;
  const bulkDeletePending = bulkDeleteMutation.isPending;

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [showFiltered, hours, triageFilter]);

  function toggleSelected(id: string, next: boolean) {
    setSelectedIds((current) => {
      const copy = new Set(current);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(alerts.map((alert) => alert.id)));
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filteredAlerts.map((alert) => alert.id)));
  }

  function handleBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const batches = Math.ceil(ids.length / 100);
    const batchNote = batches > 1 ? ` This runs in ${batches} batches.` : "";
    if (
      !window.confirm(
        `Delete ${ids.length} event${ids.length === 1 ? "" : "s"} from Circadia?${batchNote}\n\nThis removes stored webhook rows and paired clips. It cannot be undone.`
      )
    ) {
      return;
    }
    bulkDeleteMutation.mutate(ids);
  }

  const defaultExpandedId = useMemo(() => {
    if (alerts.length === 0) return null;
    if (alerts.length === 1) return alerts[0].id;
    const pending = alerts.find((a) => a.accepted && a.triageStatus === "pending");
    return pending?.id ?? alerts[0].id;
  }, [alerts]);

  useEffect(() => {
    if (alerts.length === 0) {
      setExpandedId(null);
      return;
    }
    setExpandedId((current) => {
      if (current && alerts.some((a) => a.id === current)) return current;
      return defaultExpandedId;
    });
  }, [alerts, defaultExpandedId]);

  const liveLabel = isLoading ? "Loading…" : isFetching ? "Updating…" : "Live";

  const pendingCount =
    triageFilter === "pending"
      ? alerts.length
      : alerts.filter((a) => a.accepted && a.triageStatus === "pending").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-lg px-4 py-4 md:max-w-2xl md:px-6 md:py-5">
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

        {shiftQuery.data ? (
          <div className="mb-4">
            <TriageShiftBanner
              snapshot={shiftQuery.data.snapshot}
              onShift={shiftQuery.data.viewer.onShift}
            />
          </div>
        ) : null}

        <CameraAlertEventTypesPanel diagnostics={data?.diagnostics} />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(["pending", "all", "decided"] as const).map((filter) => (
            <Button
              key={filter}
              type="button"
              size="sm"
              variant={triageFilter === filter ? "default" : "outline"}
              onClick={() => setTriageFilter(filter)}
            >
              {filter === "pending" ? "Need review" : filter === "decided" ? "Closed" : "All"}
            </Button>
          ))}
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="ml-auto rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            aria-label="Time range"
          >
            {HOURS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Radio
              className={cn(
                "h-4 w-4",
                isLoading || isError ? "text-slate-400" : "text-emerald-600"
              )}
              aria-hidden
            />
            <span>{liveLabel}</span>
            {triageFilter === "pending" && pendingCount > 0 && (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                · {pendingCount} awaiting review
              </span>
            )}
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
            {showFiltered ? "Accepted only" : "Show filtered"}
          </Button>
        </div>

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
            {triageFilter === "pending" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setTriageFilter("all")}
              >
                Show all events
              </Button>
            )}
            <Link href="/manager" className="mt-4 inline-block text-sm text-teal-700 hover:underline dark:text-teal-400">
              Back to overview
            </Link>
          </div>
        ) : (
          <>
            {allowDelete ? (
              <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                {!selectionMode ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectionMode(true)}
                    >
                      Select to delete
                    </Button>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Use <strong>Show filtered</strong> to load excess events for bulk cleanup.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectionMode(false);
                          setSelectedIds(new Set());
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={selectAllVisible}>
                        Select all on screen ({alerts.length})
                      </Button>
                      {showFiltered && filteredAlerts.length > 0 ? (
                        <Button type="button" size="sm" variant="outline" onClick={selectAllFiltered}>
                          Select filtered ({filteredAlerts.length})
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={selectedCount === 0 || bulkDeletePending}
                        className="text-rose-700 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-900 dark:hover:bg-rose-950/40"
                        onClick={handleBulkDelete}
                      >
                        {bulkDeletePending ? (
                          <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                            Deleting…
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                            Delete selected ({selectedCount})
                          </>
                        )}
                      </Button>
                    </div>
                    {bulkDeleteMutation.isError ? (
                      <p className="text-xs text-rose-700 dark:text-rose-300">
                        {bulkDeleteMutation.error instanceof Error
                          ? bulkDeleteMutation.error.message
                          : "Bulk delete failed"}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tap rows or use checkboxes to select. Up to 200 events load per screen; repeat after
                      delete if more remain.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
            <div className="flex flex-col gap-3">
            {alerts.map((alert) => (
              <AlertEventCard
                key={alert.id}
                alert={alert}
                expanded={selectionMode ? false : !collapsible || expandedId === alert.id}
                collapsible={collapsible}
                onToggle={() =>
                  setExpandedId((current) => (current === alert.id ? null : alert.id))
                }
                triagePending={triageMutation.isPending && triageMutation.variables?.id === alert.id}
                triageError={
                  triageMutation.isError && triageMutation.variables?.id === alert.id
                    ? triageMutation.error instanceof Error
                      ? triageMutation.error.message
                      : "Could not save decision"
                    : null
                }
                onTriage={(decision, note) =>
                  triageMutation.mutate({
                    id: alert.id,
                    decision,
                    note,
                    vendorEventId: alert.vendorEventId,
                  })
                }
                allowDelete={allowDelete}
                triageDeskOnShift={triageDeskOnShift}
                deletePending={deleteMutation.isPending && deleteMutation.variables === alert.id}
                onDelete={() => deleteMutation.mutate(alert.id)}
                selectionMode={selectionMode}
                selected={selectedIds.has(alert.id)}
                onSelectChange={(next) => toggleSelected(alert.id, next)}
              />
            ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
