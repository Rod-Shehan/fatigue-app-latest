"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, LayoutDashboard } from "lucide-react";
import { PRODUCT_NAME, TAGLINE_VEHICLE } from "@/lib/branding";

function LoginForm() {
  const searchParams = useSearchParams();
  // Default to "/" so the app can route drivers vs managers automatically.
  const rawCallback = searchParams.get("callbackUrl") ?? "/";
  // Prevent open redirect: only allow same-origin paths (start with /, not // or protocol)
  const callbackUrl =
    typeof rawCallback === "string" &&
    rawCallback.startsWith("/") &&
    !rawCallback.startsWith("//")
      ? rawCallback
      : "/";
  const managerLoginHint = searchParams.get("managerLogin") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent, redirectTo: string = callbackUrl) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const safeRedirect =
      typeof redirectTo === "string" &&
      redirectTo.startsWith("/") &&
      !redirectTo.startsWith("//")
        ? redirectTo
        : "/";
    try {
      // Let NextAuth perform the redirect after setting cookies to avoid race conditions
      // where a client-side push happens before the session is available.
      const res = await signIn("credentials", {
        email,
        password,
        callbackUrl: safeRedirect,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }
      // Navigate via full reload so middleware/server sees the new session immediately.
      // Use replace so Back doesn't return to a different login state.
      window.location.replace(res?.url || safeRedirect);
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-600 flex items-center justify-center mb-4 shadow-sm text-white dark:text-slate-200">
            <LogIn className="w-6 h-6 text-white dark:text-slate-900" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {PRODUCT_NAME}
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            {TAGLINE_VEHICLE}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Drivers log shifts. Managers review compliance and event maps.
          </p>
        </div>
        {managerLoginHint && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold">Manager sign-in</p>
            <p className="text-xs mt-1 text-amber-800 dark:text-amber-200/90">
              Use a <strong>manager</strong> account below (or tap &quot;Sign in as Manager&quot; after entering email). You will be taken to the manager dashboard after signing in.
            </p>
          </div>
        )}
        <form
          onSubmit={onSubmit}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5"
        >
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9"
              required={true}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9"
              required={false}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 font-medium" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-3">
            <Button
              type="submit"
              className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full h-9 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium gap-2"
              disabled={loading}
              onClick={(e) => onSubmit(e, "/manager")}
            >
              <LayoutDashboard className="w-4 h-4" /> Sign in as Manager
            </Button>
          </div>
        </form>
        <p className="text-xs text-center text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-snug">
          {process.env.NODE_ENV === "development" ? (
            <>
              <strong className="text-slate-500 dark:text-slate-400">Local dev:</strong> leave both fields blank to sign in as
              dev@localhost, or enter any email with a blank password to sign in without a stored password.
            </>
          ) : (
            <>
              Use the password set for your account (e.g. when a manager created it), or the shared server password if your
              deployment sets <code className="text-[10px]">NEXTAUTH_CREDENTIALS_PASSWORD</code>.{" "}
              <span className="text-slate-500 dark:text-slate-400">
                Blank password is not accepted on this server — only in local development.
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
