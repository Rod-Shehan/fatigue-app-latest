"use client";

import { useEffect, useState } from "react";
import { isAndroid, isiOS } from "@/lib/device-setup";
import {
  EWD_INSTALL_ANDROID_STEPS,
  EWD_INSTALL_ANDROID_TITLE,
  EWD_INSTALL_IPHONE_STEPS,
  EWD_INSTALL_IPHONE_TITLE,
  EWD_INSTALL_THIS_PHONE_BADGE,
} from "@/lib/ewd-install";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Android Chrome / Edge native install. iOS Safari never fires this. */
export function useEwdNativeInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };

  return { canNativeInstall: Boolean(promptEvent), install };
}

function RecipeCard({
  title,
  steps,
  highlight,
}: {
  title: string;
  steps: readonly string[];
  highlight: boolean;
}) {
  return (
    <div
      role="listitem"
      className={cn(
        "rounded-xl border p-3",
        highlight
          ? "border-teal-500 bg-teal-50 ring-1 ring-teal-400/60 dark:border-teal-500 dark:bg-teal-950/40 dark:ring-teal-600/40"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/40"
      )}
    >
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
        {highlight ? (
          <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {EWD_INSTALL_THIS_PHONE_BADGE}
          </span>
        ) : null}
      </div>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

/** Always shows iPhone and Android recipes. Highlights the phone the driver is holding. */
export function EwdInstallRecipes({ className }: { className?: string }) {
  const ios = isiOS();
  const android = isAndroid();

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)} role="list">
      <RecipeCard title={EWD_INSTALL_IPHONE_TITLE} steps={EWD_INSTALL_IPHONE_STEPS} highlight={ios} />
      <RecipeCard title={EWD_INSTALL_ANDROID_TITLE} steps={EWD_INSTALL_ANDROID_STEPS} highlight={android} />
    </div>
  );
}
