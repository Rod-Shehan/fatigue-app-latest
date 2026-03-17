"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, LayoutDashboard, UserCircle2, Truck } from "lucide-react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl") ?? "/sheets";
  // Prevent open redirect: only allow same-origin paths (start with /, not // or protocol)
  const callbackUrl =
    typeof rawCallback === "string" &&
    rawCallback.startsWith("/") &&
    !rawCallback.startsWith("//")
      ? rawCallback
      : "/sheets";
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
        : "/sheets";
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
      window.location.assign(res?.url || safeRedirect);
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
            Driver Fatigue Log
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            WA Commercial Vehicle Fatigue Management
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Drivers log shifts. Managers review compliance and event maps.
          </p>
        </div>
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
            <div className="flex flex-col gap-1 pt-1">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                After signing in:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link
                  href="/sheets"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <UserCircle2 className="w-3.5 h-3.5" />
                  Driver sheets
                </Link>
                <Link
                  href="/manager"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Manager dashboard
                </Link>
                <Link
                  href="/admin/regos"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Manage regos
                </Link>
              </div>
            </div>
          </div>
        </form>
        <p className="text-xs text-center text-slate-400 dark:text-slate-500">
          {process.env.NODE_ENV === "development"
            ? "Dev: leave email and password blank to sign in."
            : "Testing mode: enter any email and leave password blank."}
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
