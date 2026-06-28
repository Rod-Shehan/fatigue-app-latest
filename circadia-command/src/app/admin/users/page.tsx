"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type OperatorRow = {
  operator_id: string;
  username: string | null;
  full_name: string;
  role: string;
  role_label: string;
  is_active: boolean;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"command_operator" | "command_owner">("command_operator");

  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const meRes = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (meRes.status === 401) {
      router.replace("/login");
      return;
    }
    const me = await meRes.json();
    if (me.role !== "command_owner") {
      router.replace("/triage");
      return;
    }

    const res = await fetch("/api/v1/admin/operators", { credentials: "same-origin" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message ?? "Failed to load users");
    setOperators(body.operators ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/operators", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, full_name: fullName, password, role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Could not create user");
      setUsername("");
      setFullName("");
      setPassword("");
      setRole("command_operator");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const resetUserPassword = async (operatorId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/operators/${operatorId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Could not reset password");
      setResetId(null);
      setResetPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (operator: OperatorRow) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/operators/${operator.operator_id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !operator.is_active }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Could not update user");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-command-border pb-4">
        <div>
          <h1 className="text-xl font-bold">Command users</h1>
          <p className="text-sm text-slate-400">Owner console · create usernames and passwords</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/triage" className="text-command-amber hover:underline">
            Triage
          </Link>
          <button type="button" onClick={() => void signOut()} className="text-slate-500 hover:text-slate-300">
            Sign out
          </button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-command-border bg-command-panel p-6">
          <h2 className="font-semibold text-slate-100">Add user</h2>
          <form className="mt-4 space-y-3" onSubmit={(e) => void createUser(e)}>
            <label className="block text-sm text-slate-300">
              Username
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2 text-slate-100"
                placeholder="jane.ops"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Display name
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2 text-slate-100"
                placeholder="Jane Ops"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2 text-slate-100"
                placeholder="Min. 6 characters"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "command_operator" | "command_owner")}
                className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2 text-slate-100"
              >
                <option value="command_operator">Operator (triage only)</option>
                <option value="command_owner">Owner (triage + manage users)</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-command-amber px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60"
            >
              Create user
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-command-border bg-command-panel p-6">
          <h2 className="font-semibold text-slate-100">Existing users</h2>
          <ul className="mt-4 space-y-3">
            {operators.map((op) => (
              <li
                key={op.operator_id}
                className="rounded-lg border border-command-border bg-command-bg/50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-100">
                      {op.username ?? "—"}{" "}
                      <span className="text-xs font-normal text-slate-500">· {op.full_name}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {op.role_label}
                      {!op.is_active ? " · inactive" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setResetId(op.operator_id);
                        setResetPassword("");
                      }}
                      className="text-command-amber hover:underline disabled:opacity-50"
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleActive(op)}
                      className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
                    >
                      {op.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
                {resetId === op.operator_id && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-command-border pt-3">
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="New password (min 6)"
                      className="min-w-[200px] flex-1 rounded border border-command-border bg-command-bg px-2 py-1 text-sm text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resetUserPassword(op.operator_id)}
                      className="rounded bg-command-amber px-3 py-1 text-xs font-semibold text-black"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetId(null)}
                      className="text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </main>
  );
}
