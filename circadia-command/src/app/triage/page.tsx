"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { ActionPanel } from "@/components/triage/ActionPanel";
import { MediaViewport } from "@/components/triage/MediaViewport";
import { QueuePanel } from "@/components/triage/QueuePanel";
import { TriageShiftBanner } from "@/components/triage/TriageShiftBanner";
import { CommandHeaderActions } from "@/components/command/CommandHeaderActions";
import { CommandPageHeader } from "@/components/command/CommandPageHeader";
import { CommandShell } from "@/components/command/CommandShell";
import { useKeyboardTriage } from "@/hooks/use-keyboard-triage";
import { useCommandSse } from "@/hooks/use-command-sse";
import { useInvalidateTriageQueue, useTriageQueue } from "@/hooks/use-triage-queue";
import type { TriageShiftSnapshot } from "@/lib/triage-shift";

export default function TriagePage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [shiftSnapshot, setShiftSnapshot] = useState<TriageShiftSnapshot | null>(null);
  const [triageDeskOnShift, setTriageDeskOnShift] = useState(false);

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

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/v1/triage/shift/current", { credentials: "same-origin" });
      if (!res.ok || cancelled) return;
      const body = await res.json();
      if (!cancelled) {
        setShiftSnapshot(body.snapshot ?? null);
        setTriageDeskOnShift(body.viewer?.onShift === true);
      }
    })();
    const interval = window.setInterval(() => {
      void fetch("/api/v1/triage/shift/current", { credentials: "same-origin" })
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (!body || cancelled) return;
          setShiftSnapshot(body.snapshot ?? null);
          setTriageDeskOnShift(body.viewer?.onShift === true);
        });
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [authReady]);

  const incidents = data?.incidents ?? [];
  const selected = incidents.find((i) => i.lifecycle_id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && incidents[0]) setSelectedId(incidents[0].lifecycle_id);
  }, [incidents, selectedId]);

  const runMutate = useCallback(
    async (action: "VERIFIED_FALSE_POSITIVE" | "VERIFIED_TRUE_FATIGUE") => {
      if (!selectedId || !triageDeskOnShift) return;
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
    [selectedId, invalidate, triageDeskOnShift]
  );

  useKeyboardTriage(
    triageDeskOnShift ? selectedId : null,
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
      <CommandShell wide>
        <p className="animate-pulse text-center text-slate-400">Loading command console…</p>
      </CommandShell>
    );
  }

  if (isError) {
    return (
      <CommandShell wide>
        <div className="mx-auto max-w-md rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center">
          <p className="font-semibold text-amber-300">CONNECTION INTERRUPTED</p>
          <p className="mt-2 text-sm text-slate-300">{(error as Error).message}</p>
          <p className="mt-3 text-xs text-slate-500">
            Check DATABASE_URL, run db:push, and apply SQL migrations 001–005.
          </p>
        </div>
      </CommandShell>
    );
  }

  return (
    <CommandShell wide>
      <CommandPageHeader
        compact
        title="Circadia Command"
        subtitle={`Live triage · ${data?.queue_depth ?? 0} pending${operatorName ? ` · ${operatorName}` : ""}`}
        icon={<Shield className="h-5 w-5" strokeWidth={2} aria-hidden />}
        actions={
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
                sseConnected
                  ? "bg-emerald-950/50 text-emerald-300 ring-1 ring-emerald-800/60"
                  : "bg-amber-950/50 text-amber-300 ring-1 ring-amber-800/60"
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  sseConnected ? "bg-emerald-400" : "animate-pulse bg-amber-400"
                }`}
              />
              {sseConnected ? "SSE live" : "Polling"}
            </span>
            <CommandHeaderActions
              onSignOut={() => void signOut()}
              showUsersLink={isOwner}
              triageActive
            />
          </>
        }
      />

      {shiftSnapshot ? (
        <div className="mb-4">
          <TriageShiftBanner snapshot={shiftSnapshot} onShift={triageDeskOnShift} />
        </div>
      ) : null}

      <div className="grid h-[calc(100vh-9rem)] grid-cols-1 gap-4 lg:grid-cols-12">
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
            triageDeskOnShift={triageDeskOnShift}
            onDismiss={() => void runMutate("VERIFIED_FALSE_POSITIVE")}
            onEscalate={() => void runMutate("VERIFIED_TRUE_FATIGUE")}
            onSimulate={() => void simulate()}
          />
        </section>
      </div>
    </CommandShell>
  );
}
