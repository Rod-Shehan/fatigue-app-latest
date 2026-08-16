"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CIRCADIA_DESK_PATH, CIRCADIA_DESK_TITLE } from "@/lib/circadia-desk";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function CircadiaDeskShell({ children }: { children: ReactNode }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(display-mode: standalone)")?.matches) {
      setInstalled(true);
    }
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register(`${CIRCADIA_DESK_PATH}/sw.js`, {
        scope: `${CIRCADIA_DESK_PATH}/`,
      });
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <div className="min-h-screen min-w-[960px] bg-slate-50 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{CIRCADIA_DESK_TITLE}</p>
        {installed ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Desktop app</p>
        ) : installEvent ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void installEvent.prompt();
            }}
          >
            <Download className="w-3.5 h-3.5" aria-hidden />
            Install desktop app
          </Button>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chrome or Edge: menu → Install {CIRCADIA_DESK_TITLE}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
