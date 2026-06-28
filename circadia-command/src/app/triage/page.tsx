"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ActionPanel } from "@/components/triage/ActionPanel";
import { MediaViewport } from "@/components/triage/MediaViewport";
import { QueuePanel } from "@/components/triage/QueuePanel";
import { useKeyboardTriage } from "@/hooks/use-keyboard-triage";
import { useCommandSse } from "@/hooks/use-command-sse";
import { useInvalidateTriageQueue, useTriageQueue } from "@/hooks/use-triage-queue";

export default function TriagePage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const { connected: sseConnected } = useCommandSse(authReady);
  const { data, isLoading, isError, error } = useTriageQueue(authReady, sseConnected);
  const invalidate = useInvalidateTriageQueue();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const body = await res.json();
      if (!cancelled && body.authenticated) {
        setOperatorName(body.name ?? null);
        setIsOwner(body.role === "command_owner");
        setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const incidents = data?.incidents ?? [];
  const selected = incidents.find((i) => i.lifecycle_id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && incidents[0]) setSelectedId(incidents[0].lifecycle_id);
  }, [incidents, selectedId]);

  const runMutate = useCallback(
    async (action: "VERIFIED_FALSE_POSITIVE" | "VERIFIED_TRUE_FATIGUE") => {
      if (!selectedId) return;
      setBusy(true);
      try {
        await fetch("/api/v1/triage/claim", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lifecycle_id: selectedId,
            idempotency_key: `claim_${selectedId}`,
          }),
        });
        const res = await fetch("/api/v1/triage/mutate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lifecycle_id: selectedId,
            action,
            idempotency_key: `mutate_${selectedId}_${action}`,
            operator_notes: action === "VERIFIED_FALSE_POSITIVE" ? "Operator dismiss" : "Operator escalate",
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.message ?? "Mutation failed");
        }
        await invalidate();
        setSelectedId(null);
      } finally {
        setBusy(false);
      }
    },
    [selectedId, invalidate]
  );

  useKeyboardTriage(
    selectedId,
    () => void runMutate("VERIFIED_FALSE_POSITIVE"),
    () => void runMutate("VERIFIED_TRUE_FATIGUE")
  );

  const simulate = async () => {
    setBusy(true);
    try {
      await fetch("/api/internal/simulate-ingest", { method: "POST", credentials: "same-origin" });
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
  };

  if (!authReady || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-slate-400">Loading command console…</p>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-command-amber/50 bg-command-amber/10 p-6 text-center">
          <p className="font-semibold text-command-amber">CONNECTION INTERRUPTED</p>
          <p className="mt-2 text-sm text-slate-300">{(error as Error).message}</p>
          <p className="mt-3 text-xs text-slate-500">
            Check DATABASE_URL, run db:push, and apply SQL migrations 001–005.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <header className="mb-4 flex items-center justify-between border-b border-command-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Circadia Command</h1>
          <p className="text-sm text-slate-400">
            Live triage · {data?.queue_depth ?? 0} pending
            {operatorName ? ` · ${operatorName}` : ""}
            <span
              className={`ml-2 inline-flex items-center gap-1 ${sseConnected ? "text-command-safe" : "text-command-amber"}`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${sseConnected ? "bg-command-safe" : "bg-command-amber animate-pulse"}`}
              />
              {sseConnected ? "SSE live" : "Polling"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isOwner && (
            <a href="/admin/users" className="text-xs text-command-amber hover:underline">
              Users
            </a>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="lg:col-span-3">
          <QueuePanel incidents={incidents} selectedId={selectedId} onSelect={setSelectedId} />
        </section>
        <section className="lg:col-span-6">
          <MediaViewport incident={selected} />
        </section>
        <section className="lg:col-span-3">
          <ActionPanel
            selectedId={selectedId}
            busy={busy}
            onDismiss={() => void runMutate("VERIFIED_FALSE_POSITIVE")}
            onEscalate={() => void runMutate("VERIFIED_TRUE_FATIGUE")}
            onSimulate={() => void simulate()}
          />
        </section>
      </div>
    </main>
  );
}
