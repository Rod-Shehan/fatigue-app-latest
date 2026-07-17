"use client";

import Link from "next/link";
import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { commandCard, commandOutlineButton, commandPrimaryButton } from "@/components/command/command-styles";
import { isAndroid, isStandaloneDisplay, isiOS } from "@/lib/pwa-display";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Props = {
  compact?: boolean;
};

export function InstallCommandApp({ compact = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStandalone(isStandaloneDisplay());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!mounted || standalone) return null;

  const installFromBrowser = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  const canNativeInstall = Boolean(installPrompt);
  const ios = isiOS();
  const android = isAndroid();

  if (compact) {
    if (canNativeInstall) {
      return (
        <button
          type="button"
          disabled={installing}
          onClick={() => void installFromBrowser()}
          className={`${commandPrimaryButton} w-full`}
        >
          <Download className="h-4 w-4" aria-hidden />
          {installing ? "Installing…" : "Install Command app"}
        </button>
      );
    }
    return (
      <p className="text-center text-sm text-slate-500">
        <Link href="/install" className="font-medium text-teal-400 hover:text-teal-300">
          Install as app
        </Link>
        {" · "}
        home screen or desktop
      </p>
    );
  }

  return (
    <section className={`${commandCard} p-4`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-950/60 text-teal-300 ring-1 ring-teal-800/60">
          <Smartphone className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-100">Install Circadia24 Command</h2>
          <p className="mt-1 text-sm text-slate-400">
            Add to your home screen for a full-screen operator app — same login, faster access on
            phone or tablet.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canNativeInstall && (
          <button
            type="button"
            disabled={installing}
            onClick={() => void installFromBrowser()}
            className={commandPrimaryButton}
          >
            <Download className="h-4 w-4" aria-hidden />
            {installing ? "Installing…" : "Install app"}
          </button>
        )}
        {ios && (
          <button
            type="button"
            onClick={() => setShowIosHelp((v) => !v)}
            className={commandOutlineButton}
          >
            {showIosHelp ? "Hide steps" : "iPhone / iPad steps"}
          </button>
        )}
        {!canNativeInstall && !ios && android && (
          <p className="text-xs text-slate-500">
            Open Chrome menu → <strong className="text-slate-400">Install app</strong> or{" "}
            <strong className="text-slate-400">Add to Home screen</strong>.
          </p>
        )}
        {!canNativeInstall && !ios && !android && (
          <p className="text-xs text-slate-500">
            In Chrome or Edge, use the install icon in the address bar, or browser menu →{" "}
            <strong className="text-slate-400">Install Circadia24 Command</strong>.
          </p>
        )}
      </div>

      {showIosHelp && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-400">
          <li>Open this page in <strong className="text-slate-300">Safari</strong>.</li>
          <li>
            Tap <strong className="text-slate-300">Share</strong> (square with arrow).
          </li>
          <li>
            Tap <strong className="text-slate-300">Add to Home Screen</strong>, then Add.
          </li>
        </ol>
      )}
    </section>
  );
}
