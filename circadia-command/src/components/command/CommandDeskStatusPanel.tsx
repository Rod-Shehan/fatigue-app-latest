"use client";

import type { ReactNode } from "react";

type Props = {
  soundsLabel: string;
  connectionLabel: string;
  shiftLabel: string;
  lastAlarmLabel: string;
  backgroundLabel: string;
  children?: ReactNode;
};

export function CommandDeskStatusPanel({
  soundsLabel,
  connectionLabel,
  shiftLabel,
  lastAlarmLabel,
  backgroundLabel,
  children,
}: Props) {
  return (
    <div className="space-y-1 border-t border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
      <p>
        <span className="font-medium text-slate-700 dark:text-slate-300">Sounds:</span> {soundsLabel}
      </p>
      <p>
        <span className="font-medium text-slate-700 dark:text-slate-300">Background:</span>{" "}
        {backgroundLabel}
      </p>
      <p>
        <span className="font-medium text-slate-700 dark:text-slate-300">Connection:</span>{" "}
        {connectionLabel}
      </p>
      <p>
        <span className="font-medium text-slate-700 dark:text-slate-300">Shift:</span> {shiftLabel}
      </p>
      <p>
        <span className="font-medium text-slate-700 dark:text-slate-300">Last alarm:</span>{" "}
        {lastAlarmLabel}
      </p>
      {children}
    </div>
  );
}

function formatLastAlarm(ms: number | null): string {
  if (!ms) return "None this session";
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function buildDeskStatusLabels(options: {
  armed: boolean;
  needsRearm: boolean;
  muted: boolean;
  sseConnected: boolean;
  triageDeskOnShift: boolean;
  hasActiveShift: boolean;
  lastAlarmAt: number | null;
  pushPermission: NotificationPermission | "unsupported";
  pushSubscribed: boolean;
}): {
  soundsLabel: string;
  connectionLabel: string;
  shiftLabel: string;
  lastAlarmLabel: string;
  backgroundLabel: string;
} {
  let soundsLabel = "Off";
  if (options.muted) soundsLabel = "Muted";
  else if (!options.armed) soundsLabel = "Not enabled";
  else if (options.needsRearm) soundsLabel = "Needs tap to resume";
  else soundsLabel = "On";

  const connectionLabel = options.sseConnected ? "SSE live" : "Polling";
  const shiftLabel = !options.hasActiveShift
    ? "No shift scheduled"
    : options.triageDeskOnShift
      ? "On shift"
      : "View only";

  let backgroundLabel = "Off";
  if (options.pushPermission === "unsupported") backgroundLabel = "Not supported";
  else if (options.pushPermission === "denied") backgroundLabel = "Blocked";
  else if (options.pushSubscribed) backgroundLabel = "On";
  else if (options.pushPermission === "granted") backgroundLabel = "Needs enable";

  return {
    soundsLabel,
    connectionLabel,
    shiftLabel,
    lastAlarmLabel: formatLastAlarm(options.lastAlarmAt),
    backgroundLabel,
  };
}
