"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ActionPanel } from "@/components/triage/ActionPanel";
import { MediaViewport } from "@/components/triage/MediaViewport";
import { QueuePanel } from "@/components/triage/QueuePanel";
import { TriageQueueBanner } from "@/components/triage/TriageQueueBanner";
import { TriageShiftBanner } from "@/components/triage/TriageShiftBanner";
import { AlertSoundToggle } from "@/components/command/AlertSoundToggle";
import { CommandDeskTopBar } from "@/components/command/CommandDeskTopBar";
import { CommandShell } from "@/components/command/CommandShell";
import { commandTextMuted } from "@/components/command/command-styles";
import { cn } from "@/lib/utils";
import { useKeyboardTriage } from "@/hooks/use-keyboard-triage";
import { useCommandPushSubscribe } from "@/hooks/use-command-push-subscribe";
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock";
import { useFatigueAlertControls } from "@/hooks/use-fatigue-alert-controls";
import { useCommandSse } from "@/hooks/use-command-sse";
import { useTriageIncidentAlerts } from "@/hooks/use-triage-incident-alerts";
import { useInvalidateTriageQueue, useTriageQueue } from "@/hooks/use-triage-queue";
import type { TriageShiftSnapshot } from "@/lib/triage-shift";
import type { IncidentResolutionActionType } from "@/lib/triage-resolution";
import type { FalsePositiveReasonId } from "@/lib/false-positive-reasons";
import type { VerifiedDistractionReasonId } from "@/lib/verified-distraction-reasons";

export default function TriagePage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolutionLifecycleId, setResolutionLifecycleId] = useState<string | null>(null);
  const [dismissCaptureLifecycleId, setDismissCaptureLifecycleId] = useState<string | null>(null);
  const [distractionCaptureLifecycleId, setDistractionCaptureLifecycleId] = useState<string | null>(null);
  const [dismissNote, setDismissNote] = useState("");
  const [dismissReasons, setDismissReasons] = useState<FalsePositiveReasonId[]>([]);
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [distractionNote, setDistractionNote] = useState("");
  const [distractionReasons, setDistractionReasons] = useState<VerifiedDistractionReasonId[]>([]);
  const [distractionError, setDistractionError] = useState<string | null>(null);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [shiftSnapshot, setShiftSnapshot] = useState<TriageShiftSnapshot | null>(null);
  const [triageDeskOnShift, setTriageDeskOnShift] = useState(false);

  const {
    muted: alertMuted,
    armed,
    needsRearm,
    audioUnlocked,
    lastAlarmAt,
    toggleMuted,
    enableAudio,
    resumeAudio,
  } = useFatigueAlertControls();
  const {
    permission: pushPermission,
    subscribed: pushSubscribed,
    busy: pushBusy,
    lastError: pushError,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = useCommandPushSubscribe();
  const hasActiveShift = Boolean(shiftSnapshot?.current);
  const wakeLock = useScreenWakeLock(authReady && triageDeskOnShift && armed);
  const { connected: sseConnected } = useCommandSse(authReady, {
    onShift: triageDeskOnShift,
    hasActiveShift,
    muted: alertMuted,
  });
  const { data, isLoading, isError, error } = useTriageQueue(authReady, sseConnected);
  const invalidate = useInvalidateTriageQueue();

  const resolutionMode = Boolean(
    resolutionLifecycleId && selectedId && resolutionLifecycleId === selectedId
  );
  const dismissCaptureMode = Boolean(
    dismissCaptureLifecycleId && selectedId && dismissCaptureLifecycleId === selectedId
  );
  const distractionCaptureMode = Boolean(
    distractionCaptureLifecycleId && selectedId && distractionCaptureLifecycleId === selectedId
  );

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

  useEffect(() => {
    const readSelect = () => {
      const select = new URLSearchParams(window.location.search).get("select");
      if (select) setSelectedId(select);
    };
    readSelect();
    window.addEventListener("popstate", readSelect);
    return () => window.removeEventListener("popstate", readSelect);
  }, []);

  const handleEnableAudio = useCallback(async () => {
    const ok = await enableAudio();
    if (ok && pushPermission === "default") {
      await subscribePush();
    }
    return ok;
  }, [enableAudio, pushPermission, subscribePush]);

  const handleResumeAudio = useCallback(async () => {
    const ok = await resumeAudio();
    if (ok && pushPermission === "default") {
      await subscribePush();
    }
    return ok;
  }, [resumeAudio, pushPermission, subscribePush]);

  useTriageIncidentAlerts(incidents, authReady, {
    onShift: triageDeskOnShift,
    hasActiveShift,
    muted: alertMuted,
  });

  const selected = incidents.find((i) => i.lifecycle_id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && incidents[0]) setSelectedId(incidents[0].lifecycle_id);
  }, [incidents, selectedId]);

  useEffect(() => {
    if (resolutionLifecycleId && !incidents.some((i) => i.lifecycle_id === resolutionLifecycleId)) {
      setResolutionLifecycleId(null);
      setResolutionError(null);
    }
    if (dismissCaptureLifecycleId && !incidents.some((i) => i.lifecycle_id === dismissCaptureLifecycleId)) {
      setDismissCaptureLifecycleId(null);
      setDismissNote("");
      setDismissReasons([]);
      setDismissError(null);
    }
    if (
      distractionCaptureLifecycleId &&
      !incidents.some((i) => i.lifecycle_id === distractionCaptureLifecycleId)
    ) {
      setDistractionCaptureLifecycleId(null);
      setDistractionNote("");
      setDistractionReasons([]);
      setDistractionError(null);
    }
  }, [incidents, resolutionLifecycleId, dismissCaptureLifecycleId, distractionCaptureLifecycleId]);

  const advanceQueue = useCallback(
    (closedId: string) => {
      const remaining = incidents.filter((i) => i.lifecycle_id !== closedId);
      setSelectedId(remaining[0]?.lifecycle_id ?? null);
      setResolutionLifecycleId(null);
      setDismissCaptureLifecycleId(null);
      setDistractionCaptureLifecycleId(null);
      setDismissNote("");
      setDismissReasons([]);
      setDismissError(null);
      setDistractionNote("");
      setDistractionReasons([]);
      setDistractionError(null);
      setResolutionError(null);
    },
    [incidents]
  );

  const beginDismissCapture = useCallback(() => {
    if (!selectedId || !triageDeskOnShift || resolutionMode || dismissCaptureMode || distractionCaptureMode)
      return;
    setDismissError(null);
    setDismissNote("");
    setDismissReasons([]);
    setDismissCaptureLifecycleId(selectedId);
    setResolutionLifecycleId(null);
    setDistractionCaptureLifecycleId(null);
  }, [selectedId, triageDeskOnShift, resolutionMode, dismissCaptureMode, distractionCaptureMode]);

  const beginDistractionCapture = useCallback(() => {
    if (!selectedId || !triageDeskOnShift || resolutionMode || dismissCaptureMode || distractionCaptureMode)
      return;
    setDistractionError(null);
    setDistractionNote("");
    setDistractionReasons([]);
    setDistractionCaptureLifecycleId(selectedId);
    setResolutionLifecycleId(null);
    setDismissCaptureLifecycleId(null);
  }, [selectedId, triageDeskOnShift, resolutionMode, dismissCaptureMode, distractionCaptureMode]);

  const cancelDistractionCapture = useCallback(() => {
    setDistractionCaptureLifecycleId(null);
    setDistractionNote("");
    setDistractionReasons([]);
    setDistractionError(null);
  }, []);

  const cancelDismissCapture = useCallback(() => {
    setDismissCaptureLifecycleId(null);
    setDismissNote("");
    setDismissReasons([]);
    setDismissError(null);
  }, []);

  const runDismiss = useCallback(async () => {
    if (!selectedId || !triageDeskOnShift || resolutionMode || dismissReasons.length === 0) return;
    setBusy(true);
    setDismissError(null);
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
          action: "VERIFIED_FALSE_POSITIVE",
          idempotency_key: `mutate_${selectedId}_VERIFIED_FALSE_POSITIVE`,
          operator_notes: dismissNote.trim() || undefined,
          false_positive_reasons: dismissReasons,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDismissError(body.message ?? "Mutation failed");
        return;
      }
      await invalidate();
      advanceQueue(selectedId);
    } finally {
      setBusy(false);
    }
  }, [
    selectedId,
    invalidate,
    triageDeskOnShift,
    resolutionMode,
    dismissReasons,
    dismissNote,
    advanceQueue,
  ]);

  const runVerifyDistraction = useCallback(async () => {
    if (!selectedId || !triageDeskOnShift || resolutionMode || distractionReasons.length === 0) return;
    setBusy(true);
    setDistractionError(null);
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
      const res = await fetch("/api/v1/triage/verify-distraction", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lifecycle_id: selectedId,
          verified_distraction_reasons: distractionReasons,
          note: distractionNote.trim() || undefined,
          idempotency_key: `verify_distraction_${selectedId}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDistractionError(body.message ?? "Could not record verified distraction");
        return;
      }
      await invalidate();
      advanceQueue(selectedId);
    } finally {
      setBusy(false);
    }
  }, [
    selectedId,
    invalidate,
    triageDeskOnShift,
    resolutionMode,
    distractionReasons,
    distractionNote,
    advanceQueue,
  ]);

  const beginResolution = useCallback(async () => {
    if (!selectedId || !triageDeskOnShift || resolutionMode || dismissCaptureMode || distractionCaptureMode)
      return;
    setBusy(true);
    setResolutionError(null);
    try {
      const claimRes = await fetch("/api/v1/triage/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lifecycle_id: selectedId,
          idempotency_key: `claim_${selectedId}`,
        }),
      });
      if (!claimRes.ok) {
        const body = await claimRes.json().catch(() => ({}));
        alert(body.message ?? "Could not claim incident");
        return;
      }
      setResolutionLifecycleId(selectedId);
      setDismissCaptureLifecycleId(null);
      setDistractionCaptureLifecycleId(null);
    } finally {
      setBusy(false);
    }
  }, [selectedId, triageDeskOnShift, resolutionMode, dismissCaptureMode, distractionCaptureMode]);

  const cancelResolution = useCallback(async () => {
    if (!resolutionLifecycleId) return;
    setBusy(true);
    try {
      await fetch("/api/v1/triage/resolve", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifecycle_id: resolutionLifecycleId }),
      });
    } finally {
      setResolutionLifecycleId(null);
      setResolutionError(null);
      setBusy(false);
    }
  }, [resolutionLifecycleId]);

  const submitResolution = useCallback(
    async (actionType: IncidentResolutionActionType, resolutionNotes: string) => {
      if (!resolutionLifecycleId) return;
      setBusy(true);
      setResolutionError(null);
      try {
        const res = await fetch("/api/v1/triage/resolve", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lifecycle_id: resolutionLifecycleId,
            action_type: actionType,
            resolution_notes: resolutionNotes,
            idempotency_key: `resolve_${resolutionLifecycleId}_${actionType}`,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setResolutionError(body.message ?? "Could not record resolution");
          return;
        }
        const closedId = resolutionLifecycleId;
        await invalidate();
        advanceQueue(closedId);
      } finally {
        setBusy(false);
      }
    },
    [resolutionLifecycleId, invalidate, advanceQueue]
  );

  useKeyboardTriage(
    triageDeskOnShift && !resolutionMode && !dismissCaptureMode && !distractionCaptureMode
      ? selectedId
      : null,
    () => beginDismissCapture(),
    () => void beginResolution(),
    () => beginDistractionCapture()
  );

  const simulate = async () => {
    setBusy(true);
    setSimulateError(null);
    try {
      const res = await fetch("/api/internal/simulate-ingest", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setSimulateError(body.message ?? body.error ?? `Simulate failed (${res.status})`);
        return;
      }
      await invalidate();
    } catch {
      setSimulateError("Network error — could not reach simulate ingest.");
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
        <p className={cn("animate-pulse text-center", commandTextMuted)}>Loading command console…</p>
      </CommandShell>
    );
  }

  if (isError) {
    return (
      <CommandShell wide>
        <div className="mx-auto max-w-md rounded-xl border border-amber-400 bg-amber-50 p-6 text-center dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="font-semibold text-amber-900 dark:text-amber-300">CONNECTION INTERRUPTED</p>
          <p className="mt-2 text-sm text-amber-950 dark:text-slate-300">{(error as Error).message}</p>
          <p className={cn("mt-3 text-xs", commandTextMuted)}>
            Check DATABASE_URL, run db:push, and apply SQL migrations 001–005.
          </p>
        </div>
      </CommandShell>
    );
  }

  return (
    <CommandShell wide>
      <CommandDeskTopBar
        pendingCount={data?.queue_depth ?? 0}
        operatorName={operatorName}
        sseConnected={sseConnected}
        alertMuted={alertMuted}
        armed={armed}
        needsRearm={needsRearm}
        audioUnlocked={audioUnlocked}
        lastAlarmAt={lastAlarmAt}
        triageDeskOnShift={triageDeskOnShift}
        hasActiveShift={hasActiveShift}
        wakeLockSupported={wakeLock.supported}
        wakeLockActive={wakeLock.active}
        onToggleWakeLock={wakeLock.toggle}
        pushPermission={pushPermission}
        pushSubscribed={pushSubscribed}
        pushBusy={pushBusy}
        pushError={pushError}
        onSubscribePush={() => void subscribePush()}
        onUnsubscribePush={() => void unsubscribePush()}
        onToggleMuted={toggleMuted}
        onEnableAudio={() => void handleEnableAudio()}
        onResumeAudio={() => void handleResumeAudio()}
        isOwner={isOwner}
        onSignOut={() => void signOut()}
      />

      {shiftSnapshot ? (
        <div className="mb-3 md:mb-4">
          <TriageShiftBanner snapshot={shiftSnapshot} onShift={triageDeskOnShift} />
        </div>
      ) : null}

      <div className="hidden md:block">
        <TriageQueueBanner
          activePending={data?.queue_depth ?? 0}
          visibleCount={incidents.length}
        />
      </div>

      {!armed ? (
        <div className="mb-3 flex flex-col gap-3 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 dark:border-amber-600/50 dark:bg-amber-950/30 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-950 dark:text-amber-100">
            Tap the <strong>speaker icon</strong> in the top bar so this device plays the desk alarm on new
            incidents. Allow notifications when prompted for alerts while the screen is off.
          </p>
          <div className="hidden sm:block">
            <AlertSoundToggle
              armed={armed}
              needsRearm={needsRearm}
              muted={alertMuted}
              audioUnlocked={audioUnlocked}
              onToggleMuted={toggleMuted}
              onEnableAudio={() => void handleEnableAudio()}
              onResumeAudio={() => void handleResumeAudio()}
            />
          </div>
        </div>
      ) : needsRearm ? (
        <div className="mb-3 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/30 dark:text-amber-100 sm:mb-4">
          Sounds are enabled but the browser suspended audio. Tap the <strong>speaker icon</strong> to resume the
          desk alarm.
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:grid lg:h-[calc(100vh-9rem)] lg:min-h-0 lg:grid-cols-12">
        <section className="hidden min-h-0 flex-col lg:col-span-3 lg:flex">
          <QueuePanel
            incidents={incidents}
            selectedId={selectedId}
            lockedId={resolutionMode ? resolutionLifecycleId : null}
            onSelect={setSelectedId}
          />
        </section>
        <section className="order-1 flex min-h-0 flex-col lg:order-none lg:col-span-6">
          <MediaViewport incident={selected} locked={resolutionMode} />
        </section>
        <section className="order-2 flex min-h-0 flex-col lg:order-none lg:col-span-3">
          <ActionPanel
            selectedId={selectedId}
            busy={busy}
            triageDeskOnShift={triageDeskOnShift}
            resolutionMode={resolutionMode}
            dismissCaptureMode={dismissCaptureMode}
            distractionCaptureMode={distractionCaptureMode}
            dismissNote={dismissNote}
            dismissReasons={dismissReasons}
            dismissError={dismissError}
            distractionNote={distractionNote}
            distractionReasons={distractionReasons}
            distractionError={distractionError}
            resolutionError={resolutionError}
            onBeginDismissCapture={beginDismissCapture}
            onDismissNoteChange={setDismissNote}
            onDismissReasonsChange={setDismissReasons}
            onConfirmDismiss={() => void runDismiss()}
            onCancelDismissCapture={cancelDismissCapture}
            onBeginDistractionCapture={beginDistractionCapture}
            onDistractionNoteChange={setDistractionNote}
            onDistractionReasonsChange={setDistractionReasons}
            onConfirmDistraction={() => void runVerifyDistraction()}
            onCancelDistractionCapture={cancelDistractionCapture}
            onBeginResolution={() => void beginResolution()}
            onResolve={(actionType, notes) => void submitResolution(actionType, notes)}
            onCancelResolution={() => void cancelResolution()}
            onSimulate={() => void simulate()}
            simulateError={simulateError}
          />
        </section>
        <section className="order-3 flex min-h-0 flex-col lg:hidden">
          <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", commandTextMuted)}>
            Other pending
          </p>
          <QueuePanel
            incidents={incidents}
            selectedId={selectedId}
            lockedId={resolutionMode ? resolutionLifecycleId : null}
            onSelect={setSelectedId}
            hideSelected
          />
        </section>
      </div>
    </CommandShell>
  );
}
