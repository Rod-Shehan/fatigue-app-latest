"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, FlaskConical, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DeskStatus = {
  enabled: boolean;
  bridgeEnabled: boolean;
  pendingTriageCount: number;
  pendingTestIngestCount: number;
  pendingTestLifecycleCount: number;
};

type InjectResult = {
  ok: boolean;
  message?: string;
  ingestId?: string;
  lifecycleId?: string | null;
  vehicleRegistration?: string;
  vendorAlarmId?: string | null;
  bridgeSkippedReason?: string | null;
};

type Props = {
  /** app-next: same-origin. Command: proxy routes under /api/internal/test-incident */
  apiBase?: string;
  managerAlertsHref?: string;
  commandTriageHref?: string;
  backHref?: string;
  backLabel?: string;
};

export function TestDeskPanel({
  apiBase = "/api/internal/test-incident",
  managerAlertsHref = "/manager/alerts",
  commandTriageHref = "https://command.circadia24.com/triage",
  backHref,
  backLabel = "Back",
}: Props) {
  const [status, setStatus] = useState<DeskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInject, setLastInject] = useState<InjectResult | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiBase, { credentials: "same-origin" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Could not load test desk status");
      setStatus(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const inject = async (kind: "fatigue" | "distraction") => {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const body = (await res.json()) as InjectResult & { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Inject failed");
      setLastInject(body);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inject failed");
    } finally {
      setBusy(null);
    }
  };

  const purge = async () => {
    if (
      !window.confirm(
        "Remove all TEST* / drill-* incidents from Manager and Command queues?"
      )
    ) {
      return;
    }
    setBusy("purge");
    setError(null);
    try {
      const res = await fetch(`${apiBase}/purge`, {
        method: "POST",
        credentials: "same-origin",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Purge failed");
      setLastInject(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purge failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {backHref ? (
        <Link href={backHref} className="text-sm text-teal-700 hover:underline dark:text-teal-400">
          ← {backLabel}
        </Link>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-6 w-6 shrink-0 text-teal-600" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Live alert test desk
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Injects Autonomise-shaped drill events into the shared pipeline. Both{" "}
              <strong>Manager Live alerts</strong> and <strong>Command triage</strong> should update.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading status…
          </p>
        ) : status ? (
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Test mode" value={status.enabled ? "Enabled" : "Disabled"} ok={status.enabled} />
            <Stat label="Command bridge" value={status.bridgeEnabled ? "On" : "Off"} ok={status.bridgeEnabled} />
            <Stat label="Pending triage (all)" value={String(status.pendingTriageCount)} />
            <Stat label="Test ingests stored" value={String(status.pendingTestIngestCount)} />
            <Stat label="Test pending lifecycle" value={String(status.pendingTestLifecycleCount)} />
          </dl>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={Boolean(busy) || !status?.enabled}
            onClick={() => void inject("fatigue")}
          >
            {busy === "fatigue" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Inject fatigue (TEST*)
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={Boolean(busy) || !status?.enabled}
            onClick={() => void inject("distraction")}
          >
            {busy === "distraction" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Inject distraction (TEST*)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(busy)}
            onClick={() => void purge()}
          >
            {busy === "purge" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            )}
            Purge test incidents
          </Button>
        </div>

        {lastInject ? (
          <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-3 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
            <p className="font-medium">{lastInject.message ?? (lastInject.ok ? "Injected" : "Failed")}</p>
            {lastInject.vehicleRegistration ? (
              <p className="mt-1 font-mono text-xs opacity-90">
                {lastInject.vehicleRegistration}
                {lastInject.lifecycleId ? ` · lifecycle ${lastInject.lifecycleId.slice(0, 8)}…` : ""}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
          <Bell className="h-4 w-4" aria-hidden />
          Live drill checklist
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-950/90 dark:text-amber-100/90">
          <li>
            Open{" "}
            <Link href={managerAlertsHref} className="font-medium underline">
              Manager Live alerts
            </Link>{" "}
            on phone A — filter <strong>Needs review</strong> (polls ~30s).
          </li>
          <li>
            Open{" "}
            <a href={commandTriageHref} className="font-medium underline" target="_blank" rel="noreferrer">
              Command triage
            </a>{" "}
            on phone B — click <strong>Enable sounds</strong>, confirm <strong>SSE live</strong>.
          </li>
          <li>Click inject above — both desks should show the same TEST rego; Command should alarm.</li>
          <li>After drill, use <strong>Purge test incidents</strong> to clean up.</li>
        </ol>
      </div>
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/50">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          ok === false && "text-amber-700 dark:text-amber-300",
          ok === true && "text-emerald-700 dark:text-emerald-300"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
