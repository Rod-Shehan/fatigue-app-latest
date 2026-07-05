"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, FlaskConical, Loader2, Trash2 } from "lucide-react";
import {
  commandCard,
  commandLinkAction,
  commandOutlineButton,
  commandPrimaryButton,
} from "@/components/command/command-styles";
import { cn } from "@/lib/utils";

type DeskStatus = {
  enabled: boolean;
  bridgeEnabled: boolean;
  pendingTriageCount: number;
  pendingTestIngestCount: number;
  pendingTestLifecycleCount: number;
};

export function CommandTestDeskPanel() {
  const apiBase = "/api/internal/test-incident";
  const [status, setStatus] = useState<DeskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

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
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Inject failed");
      setLastMessage(body.message ?? "Injected");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inject failed");
    } finally {
      setBusy(null);
    }
  };

  const purge = async () => {
    if (!window.confirm("Remove all TEST* drill incidents from both desks?")) return;
    setBusy("purge");
    setError(null);
    try {
      const res = await fetch(`${apiBase}/purge`, { method: "POST", credentials: "same-origin" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Purge failed");
      setLastMessage(body.message ?? "Purged");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purge failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${commandCard} p-6`}>
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-6 w-6 shrink-0 text-teal-400" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Live alert test desk</h1>
            <p className="mt-1 text-sm text-slate-400">
              Injects drill events through the shared Autonomise pipeline — Manager Live alerts and
              Command triage both update.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : status ? (
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Test mode" value={status.enabled ? "Enabled" : "Disabled"} ok={status.enabled} />
            <Stat label="Bridge" value={status.bridgeEnabled ? "On" : "Off"} ok={status.bridgeEnabled} />
            <Stat label="Pending triage" value={String(status.pendingTriageCount)} />
            <Stat label="Test ingests" value={String(status.pendingTestIngestCount)} />
            <Stat label="Test pending" value={String(status.pendingTestLifecycleCount)} />
          </dl>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {lastMessage ? (
          <p className="mt-4 rounded-lg border border-teal-800/60 bg-teal-950/40 px-3 py-2 text-sm text-teal-200">
            {lastMessage}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className={commandPrimaryButton}
            disabled={Boolean(busy) || !status?.enabled}
            onClick={() => void inject("fatigue")}
          >
            {busy === "fatigue" ? "Injecting…" : "Inject fatigue"}
          </button>
          <button
            type="button"
            className={commandOutlineButton}
            disabled={Boolean(busy) || !status?.enabled}
            onClick={() => void inject("distraction")}
          >
            {busy === "distraction" ? "Injecting…" : "Inject distraction"}
          </button>
          <button
            type="button"
            className={commandOutlineButton}
            disabled={Boolean(busy)}
            onClick={() => void purge()}
          >
            <Trash2 className="mr-1 inline h-4 w-4 opacity-80" aria-hidden />
            Purge test incidents
          </button>
        </div>
      </div>

      <div className={`${commandCard} border-amber-800/50 bg-amber-950/20 p-5`}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-200">
          <Bell className="h-4 w-4" aria-hidden />
          Drill checklist
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-100/90">
          <li>
            <Link href="/triage" className={commandLinkAction}>
              Command triage
            </Link>{" "}
            — Enable sounds, confirm SSE live.
          </li>
          <li>
            <a
              href="https://www.circadia24.com/manager/alerts"
              className={commandLinkAction}
              target="_blank"
              rel="noreferrer"
            >
              Manager Live alerts
            </a>{" "}
            — Needs review (~30s poll).
          </li>
          <li>Inject above — both show same TEST rego; Command alarms if sounds on.</li>
        </ol>
      </div>
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums text-slate-100",
          ok === false && "text-amber-300",
          ok === true && "text-emerald-300"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
