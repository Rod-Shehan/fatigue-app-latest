"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSession, signIn, signOut, useSession } from "next-auth/react";
import { Briefcase, ChevronRight, LayoutDashboard, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircadiaLogo } from "@/components/branding/CircadiaLogo";
import { TAGLINE_VEHICLE } from "@/lib/branding";
import {
  activateOfflineSession,
  deactivateOfflineSession,
  getOfflineAuth,
  isDriverOfflineSnapshot,
} from "@/lib/offline-auth";
import { isOnline } from "@/lib/offline-api";
import { lobbyBranchFromCallback, type LobbyBranch } from "@/lib/lobby-url";
import { canEnterLobbyBranch, normalizeUserRole } from "@/lib/roles";
import { ROSTER_LOGIN_ERROR, ROSTER_LOGIN_MESSAGE } from "@/lib/driver-login-gate";
import { ALPHA_RESTRICTED_ERROR } from "@/lib/auth-alpha-allowlist";
import { CLIENT_PAUSED_ERROR, CLIENT_PAUSED_MESSAGE } from "@/lib/tenant";
import { clearOfflineAuth } from "@/lib/offline-auth";
import { cn } from "@/lib/utils";
import {
  appSurfaceTagline,
  getPublicAppSurface,
  lobbyBranchesForSurface,
  type AppSurface,
} from "@/lib/app-surface";
import { ProductInstallPanel } from "@/components/pwa/ProductInstallPanel";

type BranchConfig = {
  id: LobbyBranch;
  href: string;
  callbackUrl: string;
  title: string;
  description: string;
  icon: typeof Briefcase;
  iconClass: string;
  cardClass: string;
  signInHint: string;
};

const BRANCHES: BranchConfig[] = [
  {
    id: "driver",
    href: "/driver",
    callbackUrl: "/driver",
    title: "Driver",
    description: "Log shifts, keep your weekly record, and produce roadside PDFs on this device.",
    icon: Briefcase,
    iconClass: "bg-teal-700 dark:bg-teal-600",
    cardClass: "hover:border-teal-300 dark:hover:border-teal-700",
    signInHint: "Driver sign-in — log shifts and keep your weekly record on this device.",
  },
  {
    id: "manager",
    href: "/manager",
    callbackUrl: "/manager",
    title: "Manager",
    description: "Review compliance, driver overview, event maps, and fleet messaging.",
    icon: LayoutDashboard,
    iconClass: "bg-slate-900 dark:bg-slate-600",
    cardClass: "hover:border-slate-400 dark:hover:border-slate-500",
    signInHint: "Manager sign-in — fleet compliance and driver overview.",
  },
  {
    id: "owner",
    href: "/admin/security",
    callbackUrl: "/admin/security",
    title: "Owner",
    description: "Fleet security — lockdown controls, user access, audit export, and appointing managers.",
    icon: Shield,
    iconClass: "bg-violet-800 dark:bg-violet-700",
    cardClass: "hover:border-violet-300 dark:hover:border-violet-700",
    signInHint: "Owner sign-in — security, lockdown, and fleet governance.",
  },
];

function resolveBranchFromParams(searchParams: URLSearchParams): LobbyBranch {
  const branch = searchParams.get("branch");
  if (branch === "owner" || branch === "organisation") return "owner";
  if (branch === "manager" || branch === "driver") return branch;
  if (searchParams.get("ownerLogin") === "1") return "owner";
  if (searchParams.get("managerLogin") === "1") return "manager";
  const rawCallback = searchParams.get("callbackUrl");
  const callbackUrl =
    typeof rawCallback === "string" && rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : null;
  return lobbyBranchFromCallback(callbackUrl);
}

const LOBBY_ERROR_MESSAGES: Record<string, string> = {
  owner_required:
    "Owner access needs an owner account. Sign out and sign in as owner, or choose Driver or Manager.",
  manager_required:
    "Manager access needs a manager or owner account. Sign out and sign in with the right account, or choose Driver.",
  driver_role_required:
    "Driver sign-in needs a driver account (not manager or owner). Sign out and sign in with your driver email, or use the Manager card for fleet overview.",
  surface_ewd:
    "This is the EWD (driver) app. Fleet manager tools are on Enterprise.",
  surface_enterprise:
    "This is Enterprise (fleet). Driver logging is on the EWD app.",
  [ALPHA_RESTRICTED_ERROR]:
    "This email is not on the approved pilot list yet. Contact your fleet administrator if you should have access.",
  [CLIENT_PAUSED_ERROR]: CLIENT_PAUSED_MESSAGE,
};

function lobbyErrorMessage(searchParams: URLSearchParams): string | null {
  const code = searchParams.get("error");
  if (!code) return null;
  return LOBBY_ERROR_MESSAGES[code] ?? null;
}

function roleAccountLabel(role: string | null | undefined): string {
  const normalized = normalizeUserRole(role);
  if (normalized === "owner") return "Owner account";
  if (normalized === "manager") return "Manager account";
  return "Driver account";
}

function safeCallbackUrl(searchParams: URLSearchParams, branch: BranchConfig): string {
  const raw = searchParams.get("callbackUrl");
  if (
    typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//")
  ) {
    return raw;
  }
  return branch.callbackUrl;
}

export function AppLanding({ surface }: { surface?: AppSurface }) {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const appSurface = surface ?? getPublicAppSurface();
  const allowedBranchIds = useMemo(() => new Set(lobbyBranchesForSurface(appSurface)), [appSurface]);
  const visibleBranches = useMemo(
    () => BRANCHES.filter((b) => allowedBranchIds.has(b.id)),
    [allowedBranchIds]
  );
  const initialBranch = useMemo(() => {
    const fromParams = resolveBranchFromParams(searchParams);
    if (allowedBranchIds.has(fromParams)) return fromParams;
    return visibleBranches[0]?.id ?? "driver";
  }, [searchParams, allowedBranchIds, visibleBranches]);
  const forcedSignIn = searchParams.has("callbackUrl") || searchParams.has("branch");

  const [activeBranch, setActiveBranch] = useState<LobbyBranch>(initialBranch);
  const [showSignIn, setShowSignIn] = useState(forcedSignIn);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [branchError, setBranchError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [offlineContinue, setOfflineContinue] = useState(false);
  const offlineSnapshot = getOfflineAuth();

  const branch = visibleBranches.find((b) => b.id === activeBranch) ?? visibleBranches[0] ?? BRANCHES[0];
  const callbackUrl = safeCallbackUrl(searchParams, branch);

  useEffect(() => {
    const fromParams = resolveBranchFromParams(searchParams);
    setActiveBranch(allowedBranchIds.has(fromParams) ? fromParams : visibleBranches[0]?.id ?? "driver");
    const urlError = lobbyErrorMessage(searchParams);
    if (urlError) setBranchError(urlError);
    if (searchParams.has("callbackUrl") || searchParams.has("branch")) {
      setShowSignIn(true);
    }
  }, [searchParams, allowedBranchIds, visibleBranches]);

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

  function onBranchSelect(next: BranchConfig) {
    setActiveBranch(next.id);
    setBranchError("");
    if (status === "authenticated") {
      const role = (session?.user as { role?: string | null } | undefined)?.role;
      if (!canEnterLobbyBranch(next.id, role)) {
        if (next.id === "driver") {
          setBranchError(LOBBY_ERROR_MESSAGES.driver_role_required);
        } else {
          setBranchError(
            `${next.title} access needs a ${next.title.toLowerCase()} account. Sign out and sign in with the right account, or choose another branch.`
          );
        }
        return;
      }
      window.location.href = next.href;
      return;
    }
    setShowSignIn(true);
    setShowForgotPassword(false);
    setForgotMessage("");
    setError("");
  }

  function onSignOut() {
    setSigningOut(true);
    clearOfflineAuth();
    void signOut({ callbackUrl: "/" });
  }

  async function onForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setForgotMessage("");
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setForgotMessage(
        data.message ||
          "If an account exists for that email, we sent a reset link. Check your inbox (and spam)."
      );
    } catch {
      setError("Could not request a reset. Check your connection and try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const safeRedirect =
      callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : branch.callbackUrl;
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        callbackUrl: safeRedirect,
        redirect: false,
      });
      if (res?.error) {
        setError(
          res.error === ROSTER_LOGIN_ERROR
            ? ROSTER_LOGIN_MESSAGE
            : res.error === ALPHA_RESTRICTED_ERROR
              ? LOBBY_ERROR_MESSAGES[ALPHA_RESTRICTED_ERROR]
              : res.error === CLIENT_PAUSED_ERROR
                ? CLIENT_PAUSED_MESSAGE
                : res.error === "Configuration"
                  ? "Sign-in is misconfigured on the server (check NEXTAUTH_SECRET and NEXTAUTH_URL)."
                  : "Invalid email or password."
        );
        setLoading(false);
        return;
      }
      const freshSession = await getSession();
      const signedInRole = (freshSession?.user as { role?: string | null } | undefined)?.role;
      if (!canEnterLobbyBranch(activeBranch, signedInRole)) {
        await signOut({ redirect: false });
        if (activeBranch === "driver") {
          setError(LOBBY_ERROR_MESSAGES.driver_role_required);
        } else if (activeBranch === "manager") {
          setError(LOBBY_ERROR_MESSAGES.manager_required);
        } else {
          setError(LOBBY_ERROR_MESSAGES.owner_required);
        }
        setLoading(false);
        return;
      }
      deactivateOfflineSession();
      window.location.replace(res?.url || safeRedirect);
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  }

  const signedInEmail =
    status === "authenticated" && session?.user?.email ? session.user.email : null;
  const signedInRole = (session?.user as { role?: string | null } | undefined)?.role;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-10">
      <div className="w-full max-w-3xl space-y-8">
        <div className="flex flex-col items-center text-center">
          <CircadiaLogo
            variant="full"
            product={
              appSurface === "enterprise"
                ? "enterprise"
                : appSurface === "ewd"
                  ? "ewd"
                  : "helper"
            }
            href={null}
            priority
            className="mx-auto"
          />
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-3">{TAGLINE_VEHICLE}</p>
          <p
            className="text-xs text-slate-400 dark:text-slate-500 mt-2 max-w-md"
            data-app-surface={appSurface}
          >
            {appSurfaceTagline(appSurface)}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            {signedInEmail
              ? appSurface === "legacy"
                ? "Choose how you want to use the app — your branch choice decides where you go."
                : "Sign in to continue on this product."
              : appSurface === "legacy"
                ? "Choose how you are using the app — sign in on this page when prompted."
                : "Sign in on this page when prompted."}
          </p>
          {signedInEmail ? (
            <div className="mt-3 flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Signed in as{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">{signedInEmail}</span>
                <span className="text-slate-400 dark:text-slate-500"> · {roleAccountLabel(signedInRole)}</span>
              </p>
              <button
                type="button"
                onClick={onSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : null}
          {appSurface !== "circadia" ? (
            <ProductInstallPanel className="mt-5 text-left max-w-md mx-auto w-full" compact />
          ) : null}
        </div>

        {branchError ? (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-center" role="alert">
            {branchError}
          </p>
        ) : null}

        {offlineContinue && offlineSnapshot && activeBranch === "driver" ? (
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

        <div
          className={cn(
            "grid gap-4",
            visibleBranches.length >= 3 ? "sm:grid-cols-3" : visibleBranches.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1 max-w-md mx-auto"
          )}
        >
          {visibleBranches.map((b) => {
            const Icon = b.icon;
            const selected = activeBranch === b.id;
            const branchAllowed =
              status !== "authenticated" || canEnterLobbyBranch(b.id, signedInRole);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onBranchSelect(b)}
                className={cn(
                  "group flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors text-left w-full",
                  b.cardClass,
                  selected && "ring-2 ring-slate-400 dark:ring-slate-500 border-slate-400 dark:border-slate-500"
                )}
              >
                <div
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center text-white mb-4",
                    b.iconClass
                  )}
                >
                  <Icon className="w-5 h-5" aria-hidden />
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{b.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
                  {b.description}
                </p>
                <span
                  className={cn(
                    "mt-4 inline-flex items-center gap-1 text-sm font-semibold",
                    branchAllowed
                      ? "text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {status === "authenticated" ? (branchAllowed ? "Enter" : "Not available") : "Sign in"}
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </span>
              </button>
            );
          })}
        </div>

        {showSignIn && status !== "authenticated" ? (
          showForgotPassword ? (
            <form
              onSubmit={(e) => void onForgotSubmit(e)}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5 max-w-md mx-auto"
            >
              <div className="space-y-1 text-center">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Forgot password</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter the email for your {branch.title.toLowerCase()} account. We will email a reset link when outbound
                  email is configured.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Email
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                  required
                />
              </div>
              {error ? (
                <p className="text-sm text-red-600 font-medium" role="alert">
                  {error}
                </p>
              ) : null}
              {forgotMessage ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium" role="status">
                  {forgotMessage}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full h-12 text-base bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                disabled={forgotLoading}
              >
                {forgotLoading ? "Sending…" : "Email reset link"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotMessage("");
                  setError("");
                }}
              >
                Back to sign in
              </button>
            </form>
          ) : (
          <form
            onSubmit={onSubmit}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5 max-w-md mx-auto"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">{branch.signInHint}</p>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError("");
                    setForgotMessage("");
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600 font-medium" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full h-12 text-base bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              disabled={loading}
            >
              {loading ? "Signing in…" : `Sign in to ${branch.title}`}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              onClick={() => setShowSignIn(false)}
            >
              Back to branch selection
            </button>
          </form>
          )
        ) : null}
      </div>
    </div>
  );
}
