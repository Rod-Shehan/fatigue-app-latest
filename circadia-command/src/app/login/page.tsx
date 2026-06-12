"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

const SKIP_WEBAUTHN =
  process.env.NEXT_PUBLIC_COMMAND_SKIP_WEBAUTHN === "true" ||
  (process.env.NEXT_PUBLIC_COMMAND_SKIP_WEBAUTHN !== "false" &&
    process.env.NODE_ENV === "development");

type Step = "email" | "webauthn" | "busy";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(SKIP_WEBAUTHN ? "email" : "email");
  const [email, setEmail] = useState("operator@circadia.local");
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [flow, setFlow] = useState<"register" | "login">("login");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const devSignIn = async () => {
    setError(null);
    setStep("busy");
    try {
      const res = await fetch("/api/dev/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Dev sign-in failed");
      router.replace("/triage");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dev sign-in failed");
      setStep("email");
    }
  };

  const beginEmail = async () => {
    if (SKIP_WEBAUTHN) {
      await devSignIn();
      return;
    }

    setError(null);
    setStep("busy");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Sign-in failed");

      setOperatorId(body.operator_id);
      setFlow(body.step);
      setStatus(
        body.step === "register"
          ? "Register your hardware passkey (YubiKey or platform authenticator)."
          : "Present your registered passkey to continue."
      );
      setStep("webauthn");
      setTimeout(() => void runWebAuthn(body.operator_id, body.step), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setStep("email");
    }
  };

  const runWebAuthn = async (opId: string, kind: "register" | "login") => {
    setError(null);
    setStep("busy");
    try {
      if (kind === "register") {
        const optRes = await fetch("/api/auth/register-options", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operator_id: opId }),
        });
        const options = await optRes.json();
        if (!optRes.ok) throw new Error(options.message ?? "Could not start registration");

        const attestation = await startRegistration({ optionsJSON: options });
        const verifyRes = await fetch("/api/auth/verify-register", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attestation),
        });
        const verifyBody = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(verifyBody.message ?? "Passkey registration failed");
      } else {
        const optRes = await fetch("/api/auth/login-options", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operator_id: opId }),
        });
        const options = await optRes.json();
        if (!optRes.ok) throw new Error(options.message ?? "Could not start login");

        const assertion = await startAuthentication({ optionsJSON: options });
        const verifyRes = await fetch("/api/auth/login-verify", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assertion),
        });
        const verifyBody = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(verifyBody.message ?? "Passkey verification failed");
      }

      router.replace("/triage");
    } catch (e) {
      setError(e instanceof Error ? e.message : "WebAuthn failed");
      setStep("webauthn");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-command-border bg-command-panel p-8 shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight">Circadia Command</h1>
        <p className="mt-2 text-sm text-slate-400">
          {SKIP_WEBAUTHN
            ? "Development sign-in (passkey disabled)"
            : "Operator sign-in · hardware MFA required"}
        </p>

        {step === "email" && (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void beginEmail();
            }}
          >
            <label className="block text-sm text-slate-300">
              Operator email
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2 text-slate-100 outline-none focus:border-command-amber"
                placeholder="operator@circadia.local"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-command-amber px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
            >
              {SKIP_WEBAUTHN ? "Sign in" : "Continue"}
            </button>
          </form>
        )}

        {!SKIP_WEBAUTHN && step === "webauthn" && (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-slate-300">{status}</p>
            <button
              type="button"
              onClick={() => operatorId && void runWebAuthn(operatorId, flow)}
              className="w-full rounded-lg border border-command-amber bg-command-amber/10 px-4 py-2.5 text-sm font-medium text-command-amber hover:bg-command-amber/20"
            >
              {flow === "register" ? "Register passkey" : "Use passkey"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className="w-full text-xs text-slate-500 hover:text-slate-300"
            >
              Use a different email
            </button>
          </div>
        )}

        {step === "busy" && (
          <p className="mt-8 animate-pulse text-center text-sm text-slate-400">
            {SKIP_WEBAUTHN ? "Signing in…" : "Waiting for authenticator…"}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
