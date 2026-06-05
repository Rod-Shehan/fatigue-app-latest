"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Briefcase, ChevronRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME, TAGLINE_VEHICLE } from "@/lib/branding";
import {
  activateOfflineSession,
  getOfflineAuth,
  isDriverOfflineSnapshot,
} from "@/lib/offline-auth";
import { isOnline } from "@/lib/offline-api";
import { cn } from "@/lib/utils";

const BRANCHES = [
  {
    href: "/driver",
    title: "Driver",
    description: "Log shifts, keep your weekly record, and produce roadside PDFs on this device.",
    icon: Briefcase,
    iconClass: "bg-teal-700 dark:bg-teal-600",
    cardClass: "hover:border-teal-300 dark:hover:border-teal-700",
  },
  {
    href: "/manager",
    title: "Manager",
    description: "Review compliance, driver overview, event maps, and fleet messaging.",
    icon: LayoutDashboard,
    iconClass: "bg-slate-900 dark:bg-slate-600",
    cardClass: "hover:border-slate-400 dark:hover:border-slate-500",
  },
] as const;

export function AppLobby() {
  const { data: session, status } = useSession();
  const [offlineContinue, setOfflineContinue] = useState(false);
  const offlineSnapshot = getOfflineAuth();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!isDriverOfflineSnapshot(offlineSnapshot)) {
        if (!cancelled) setOfflineContinue(false);
        return;
      }
      if (!isOnline()) {
        if (!cancelled) setOfflineContinue(true);
        return;
      }
      try {
        const res = await fetch("/api/ping", { method: "HEAD", cache: "no-store" });
        if (!cancelled) setOfflineContinue(!res.ok);
      } catch {
        if (!cancelled) setOfflineContinue(true);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [offlineSnapshot?.userId]);

  function continueOffline() {
    activateOfflineSession();
    window.location.replace("/driver");
  }

  const signedInLabel =
    status === "authenticated" && session?.user?.email
      ? session.user.name?.trim() || session.user.email
      : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-10">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {PRODUCT_NAME}
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{TAGLINE_VEHICLE}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Choose how you are using the app today.</p>
          {signedInLabel ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Signed in as <span className="font-semibold text-slate-700 dark:text-slate-200">{signedInLabel}</span>
            </p>
          ) : null}
        </div>

        {offlineContinue && offlineSnapshot ? (
          <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 p-4 space-y-3">
            <p className="text-sm text-teal-950 dark:text-teal-100 leading-relaxed">
              You are offline. Continue on this device as{" "}
              <strong>{offlineSnapshot.name || offlineSnapshot.email}</strong> without signing in again.
            </p>
            <Button
              type="button"
              className="w-full h-12 text-base font-semibold bg-teal-700 hover:bg-teal-800 text-white"
              onClick={continueOffline}
            >
              Continue offline as Driver
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {BRANCHES.map((branch) => {
            const Icon = branch.icon;
            return (
              <Link
                key={branch.href}
                href={branch.href}
                className={cn(
                  "group flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors",
                  branch.cardClass
                )}
              >
                <div
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center text-white mb-4",
                    branch.iconClass
                  )}
                >
                  <Icon className="w-5 h-5" aria-hidden />
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{branch.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
                  {branch.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
                  Enter
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="text-center text-sm">
          <a
            href={`/login?callbackUrl=${encodeURIComponent("/admin/security")}&ownerLogin=1`}
            className="font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            Organisation / IT sign-in
          </a>
        </p>
      </div>
    </div>
  );
}
