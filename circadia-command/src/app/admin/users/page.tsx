"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { UserCog } from "lucide-react";
import { CommandHeaderActions } from "@/components/command/CommandHeaderActions";
import { CommandPageHeader } from "@/components/command/CommandPageHeader";
import { CommandShell } from "@/components/command/CommandShell";
import {
  commandCard,
  commandInput,
  commandLabel,
  commandLinkAction,
  commandListItem,
  commandPrimaryButton,
  commandSectionTitle,
} from "@/components/command/command-styles";

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
      <CommandShell>
        <p className="text-center text-slate-400">Loading…</p>
      </CommandShell>
    );
  }

  return (
    <CommandShell>
      <CommandPageHeader
        title="Command users"
        subtitle="Owner console · create usernames and passwords"
        icon={<UserCog className="h-5 w-5" strokeWidth={2} aria-hidden />}
        actions={<CommandHeaderActions onSignOut={() => void signOut()} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${commandCard} p-6`}>
          <h2 className={commandSectionTitle}>Add user</h2>
          <form className="mt-4 space-y-3" onSubmit={(e) => void createUser(e)}>
            <label className={commandLabel}>
              Username
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={commandInput}
                placeholder="jane.ops"
              />
            </label>
            <label className={commandLabel}>
              Display name
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={commandInput}
                placeholder="Jane Ops"
              />
            </label>
            <label className={commandLabel}>
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={commandInput}
                placeholder="Min. 6 characters"
              />
            </label>
            <label className={commandLabel}>
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "command_operator" | "command_owner")}
                className={commandInput}
              >
                <option value="command_operator">Operator (triage only)</option>
                <option value="command_owner">Owner (triage + manage users)</option>
              </select>
            </label>
            <button type="submit" disabled={busy} className={commandPrimaryButton}>
              Create user
            </button>
          </form>
        </section>

        <section className={`${commandCard} p-6`}>
          <h2 className={commandSectionTitle}>Existing users</h2>
          <ul className="mt-4 space-y-3">
            {operators.map((op) => (
              <li key={op.operator_id} className={commandListItem}>
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
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setResetId(op.operator_id);
                        setResetPassword("");
                      }}
                      className={`${commandLinkAction} disabled:opacity-50`}
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleActive(op)}
                      className="text-sm text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-50"
                    >
                      {op.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
                {resetId === op.operator_id && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-700/80 pt-3">
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="New password (min 6)"
                      className="min-w-[200px] flex-1 rounded-lg border border-slate-600 bg-slate-900/80 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resetUserPassword(op.operator_id)}
                      className={`${commandPrimaryButton} px-3 py-1.5 text-xs`}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetId(null)}
                      className="text-xs text-slate-500 hover:text-slate-300"
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
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </CommandShell>
  );
}
