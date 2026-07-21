"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FlaskConical, LogOut, Map, Moon, MoreVertical, Sun, Users } from "lucide-react";
import { CircadiaLogo } from "@/components/branding/CircadiaLogo";
import { AlertSoundToggle } from "@/components/command/AlertSoundToggle";
import {
  buildDeskStatusLabels,
  CommandDeskStatusPanel,
} from "@/components/command/CommandDeskStatusPanel";
import {
  commandNavLinkGhost,
  commandOutlineButton,
  commandTextMuted,
} from "@/components/command/command-styles";
import { CommandThemeToggle } from "@/components/theme/command-theme-toggle";
import { cn } from "@/lib/utils";

type Props = {
  pendingCount: number;
  operatorName: string | null;
  sseConnected: boolean;
  alertMuted: boolean;
  armed: boolean;
  needsRearm: boolean;
  audioUnlocked: boolean;
  lastAlarmAt: number | null;
  triageDeskOnShift: boolean;
  hasActiveShift: boolean;
  wakeLockSupported: boolean;
  wakeLockActive: boolean;
  onToggleWakeLock: () => void;
  pushPermission: NotificationPermission | "unsupported";
  pushSubscribed: boolean;
  pushBusy: boolean;
  pushError?: string | null;
  onSubscribePush: () => void;
  onUnsubscribePush: () => void;
  onToggleMuted: () => void;
  onEnableAudio: () => void;
  onResumeAudio: () => void;
  isOwner: boolean;
  onSignOut: () => void;
};

function SseStatus({ connected, compact = false }: { connected: boolean; compact?: boolean }) {
  const label = connected ? "SSE live" : "Polling";
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          connected
            ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-950/50 dark:ring-emerald-800/60"
            : "bg-amber-100 ring-1 ring-amber-300 dark:bg-amber-950/50 dark:ring-amber-800/60"
        )}
        title={label}
        aria-label={label}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            connected ? "bg-emerald-500" : "animate-pulse bg-amber-500"
          )}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium",
        connected
          ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/60"
          : "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800/60"
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          connected ? "bg-emerald-400" : "animate-pulse bg-amber-400"
        )}
      />
      {label}
    </span>
  );
}

function DesktopNav({ isOwner, onSignOut }: Pick<Props, "isOwner" | "onSignOut">) {
  return (
    <>
      <Link href="/tracking" className={commandNavLinkGhost}>
        <Map className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        Event Tracker
      </Link>
      {isOwner ? (
        <>
          <Link href="/admin/users" className={commandNavLinkGhost}>
            <Users className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Users
          </Link>
          <Link href="/admin/test-desk" className={commandNavLinkGhost}>
            <FlaskConical className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Test desk
          </Link>
        </>
      ) : null}
      <button type="button" onClick={onSignOut} className={commandOutlineButton}>
        <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        Sign out
      </button>
    </>
  );
}

function OverflowExtras({
  wakeLockSupported,
  wakeLockActive,
  onToggleWakeLock,
  pushPermission,
  pushSubscribed,
  pushBusy,
  pushError,
  onSubscribePush,
  onUnsubscribePush,
}: Pick<
  Props,
  | "wakeLockSupported"
  | "wakeLockActive"
  | "onToggleWakeLock"
  | "pushPermission"
  | "pushSubscribed"
  | "pushBusy"
  | "pushError"
  | "onSubscribePush"
  | "onUnsubscribePush"
>) {
  return (
    <>
      {wakeLockSupported ? (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={onToggleWakeLock}
        >
          {wakeLockActive ? (
            <Sun className="h-4 w-4 opacity-90" aria-hidden />
          ) : (
            <Moon className="h-4 w-4 opacity-90" aria-hidden />
          )}
          {wakeLockActive ? "Keep screen on" : "Allow screen sleep"}
        </button>
      ) : null}
      {pushPermission !== "unsupported" ? (
        <>
          <button
            type="button"
            role="menuitem"
            disabled={pushBusy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => void (pushSubscribed ? onUnsubscribePush() : onSubscribePush())}
          >
            <BellIcon />
            {pushSubscribed ? "Background alerts on" : "Enable background alerts"}
          </button>
          {pushError ? (
            <p className="px-3 pb-2 text-xs text-red-600 dark:text-red-400">{pushError}</p>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function BellIcon() {
  return (
    <svg className="h-4 w-4 opacity-90" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a5 5 0 00-5 5v2.5c0 .6-.2 1.2-.6 1.7L5 14.5h14l-1.4-2.3c-.4-.5-.6-1.1-.6-1.7V8a5 5 0 00-5-5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 17a2 2 0 004 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function MobileOverflowMenu(props: Props) {
  const { isOwner, onSignOut } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const status = buildDeskStatusLabels({
    armed: props.armed,
    needsRearm: props.needsRearm,
    muted: props.alertMuted,
    sseConnected: props.sseConnected,
    triageDeskOnShift: props.triageDeskOnShift,
    hasActiveShift: props.hasActiveShift,
    lastAlarmAt: props.lastAlarmAt,
    pushPermission: props.pushPermission,
    pushSubscribed: props.pushSubscribed,
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More actions"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <CommandDeskStatusPanel {...status} />
          <Link
            href="/tracking"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <Map className="h-4 w-4 opacity-90" aria-hidden />
            Event Tracker
          </Link>
          {isOwner ? (
            <>
              <Link
                href="/admin/users"
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setOpen(false)}
              >
                <Users className="h-4 w-4 opacity-90" aria-hidden />
                Users
              </Link>
              <Link
                href="/admin/test-desk"
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setOpen(false)}
              >
                <FlaskConical className="h-4 w-4 opacity-90" aria-hidden />
                Test desk
              </Link>
            </>
          ) : null}
          <OverflowExtras {...props} />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut className="h-4 w-4 opacity-90" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CommandDeskTopBar(props: Props) {
  const {
    pendingCount,
    operatorName,
    sseConnected,
    alertMuted,
    armed,
    needsRearm,
    audioUnlocked,
    onToggleMuted,
    onEnableAudio,
    onResumeAudio,
    isOwner,
    onSignOut,
  } = props;
  const subtitle = `Live triage · ${pendingCount} pending${operatorName ? ` · ${operatorName}` : ""}`;

  return (
    <>
      <header className="sticky top-0 z-40 -mx-4 mb-3 border-b border-slate-200/80 bg-slate-50/95 px-3 py-2 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95 md:hidden">
        <div className="flex items-center gap-1.5">
          <CircadiaLogo variant="icon" size={36} href={null} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              Triage · {pendingCount} pending
            </p>
            {operatorName ? (
              <p className={cn("truncate text-xs", commandTextMuted)}>{operatorName}</p>
            ) : null}
          </div>
          <SseStatus connected={sseConnected} compact />
          <AlertSoundToggle
            compact
            armed={armed}
            needsRearm={needsRearm}
            muted={alertMuted}
            audioUnlocked={audioUnlocked}
            onToggleMuted={onToggleMuted}
            onEnableAudio={onEnableAudio}
            onResumeAudio={onResumeAudio}
          />
          <CommandThemeToggle className="h-9 w-9 shrink-0" />
          <MobileOverflowMenu {...props} onSignOut={onSignOut} isOwner={isOwner} />
        </div>
      </header>

      <header className="mb-6 hidden md:block">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CircadiaLogo variant="full" href={null} priority />
            <p className={cn("mt-1 truncate text-sm", commandTextMuted)}>{subtitle}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <SseStatus connected={sseConnected} />
            <AlertSoundToggle
              armed={armed}
              needsRearm={needsRearm}
              muted={alertMuted}
              audioUnlocked={audioUnlocked}
              onToggleMuted={onToggleMuted}
              onEnableAudio={onEnableAudio}
              onResumeAudio={onResumeAudio}
            />
            <DesktopNav isOwner={isOwner} onSignOut={onSignOut} />
          </div>
        </div>
      </header>
    </>
  );
}
