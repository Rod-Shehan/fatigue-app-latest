"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ManagerAccount } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { PRODUCT_NAME } from "@/lib/branding";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { ShowOncePasswordDialog } from "@/components/auth/ShowOncePasswordDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserPlus, Loader2, CheckCircle2, Users, Pencil } from "lucide-react";

const MANAGERS_QUERY_KEY = ["managers"] as const;

function formatPasswordSetAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function AddManagersView() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editManagerId, setEditManagerId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showOnceOpen, setShowOnceOpen] = useState(false);
  const [showOnceEmail, setShowOnceEmail] = useState("");
  const [showOncePassword, setShowOncePassword] = useState("");
  const [showOnceLabel, setShowOnceLabel] = useState("this manager");

  const managersQuery = useQuery({
    queryKey: MANAGERS_QUERY_KEY,
    queryFn: () => api.users.listManagers(),
  });

  const managers = managersQuery.data?.managers ?? [];
  const editManager = useMemo(
    () => (editManagerId ? managers.find((m) => m.id === editManagerId) ?? null : null),
    [editManagerId, managers]
  );

  function revealTemporaryPassword(account: ManagerAccount, temporaryPassword: string) {
    setShowOnceEmail(account.email ?? "");
    setShowOncePassword(temporaryPassword);
    setShowOnceLabel(account.name?.trim() || account.email || "this manager");
    setShowOnceOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: (data: { email: string; name?: string; password?: string }) => api.users.create(data),
    onSuccess: (data) => {
      setEmail("");
      setName("");
      setPassword("");
      void queryClient.invalidateQueries({ queryKey: MANAGERS_QUERY_KEY });
      if (data.temporary_password && data.email) {
        revealTemporaryPassword(data, data.temporary_password);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name?: string; password?: string }) =>
      api.users.update(payload.id, {
        ...(payload.name ? { name: payload.name } : null),
        ...(payload.password ? { password: payload.password } : null),
      }),
    onSuccess: (data) => {
      setEditOpen(false);
      setEditManagerId(null);
      setEditPassword("");
      void queryClient.invalidateQueries({ queryKey: MANAGERS_QUERY_KEY });
      if (data.temporary_password && data.email) {
        revealTemporaryPassword(data, data.temporary_password);
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    createMutation.mutate({
      email: email.trim(),
      name: name.trim() || undefined,
      password: password.trim() ? password : undefined,
    });
  }

  function openEdit(manager: ManagerAccount) {
    setEditManagerId(manager.id);
    setEditName(manager.name?.trim() || "");
    setEditPassword("");
    setEditOpen(true);
    updateMutation.reset();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md mx-auto px-4 py-8 md:py-12">
        <PageHeader
          backHref="/manager"
          backLabel="Manager dashboard"
          backText={MANAGER_EXPERIENCE.NAV_OVERVIEW}
          title={PRODUCT_NAME}
          subtitle="Manager accounts — owner-only identity admin"
          icon={<UserPlus className="w-5 h-5" />}
        />
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Only the organisation owner can create manager accounts and reset their login passwords.
          Passwords are shown once when you set them — existing passwords cannot be viewed.
        </p>
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4"
        >
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="manager@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9"
              required
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
            >
              Name (optional)
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
            >
              Set login password
            </Label>
            <Input
              id="password"
              type="text"
              autoComplete="off"
              placeholder="Temporary password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9"
            />
            <p className="text-[11px] text-slate-400">Shown once after save — share for first sign-in.</p>
          </div>
          {createMutation.isError && (
            <p className="text-sm text-red-600 font-medium" role="alert">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to add manager"}
            </p>
          )}
          {createMutation.isSuccess && !showOnceOpen && (
            <p className="text-sm text-green-600 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Manager saved.
            </p>
          )}
          <Button
            type="submit"
            className="w-full h-9 bg-slate-900 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white dark:text-slate-100 font-semibold gap-2"
            disabled={createMutation.isPending || !email.trim()}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            Add manager
          </Button>
        </form>

        <section
          className="mt-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
          aria-labelledby="current-managers-heading"
        >
          <div className="px-6 pt-5 pb-2 border-b border-slate-100 dark:border-slate-700/80">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
              <h2
                id="current-managers-heading"
                className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
              >
                Current managers
              </h2>
            </div>
          </div>
          <div className="p-6 pt-4">
            {managersQuery.isLoading && (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden />
                <span className="text-sm">Loading managers…</span>
              </div>
            )}
            {managersQuery.isError && (
              <p className="text-sm text-red-600 dark:text-red-400 py-2" role="alert">
                {managersQuery.error instanceof Error
                  ? managersQuery.error.message
                  : "Could not load managers"}
              </p>
            )}
            {managersQuery.isSuccess && managers.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">No manager accounts yet.</p>
            )}
            {managersQuery.isSuccess && managers.length > 0 && (
              <ul className="space-y-0 divide-y divide-slate-100 dark:divide-slate-700/90 -mx-2">
                {managers.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 px-2 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-slate-50 text-base leading-tight block">
                        {m.name?.trim() || m.email || "—"}
                      </span>
                      {m.email ? (
                        <span className="text-sm text-slate-500 dark:text-slate-400 break-all block">{m.email}</span>
                      ) : null}
                      <span className="text-[11px] text-slate-400 block mt-1">
                        {m.has_password
                          ? `Password set${formatPasswordSetAt(m.password_set_at) ? ` · ${formatPasswordSetAt(m.password_set_at)}` : ""}`
                          : "No password set"}
                      </span>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => openEdit(m)}>
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
              setEditManagerId(null);
              updateMutation.reset();
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit manager</DialogTitle>
              <DialogDescription>
                Update display name or reset the login password for {editManager?.email ?? "this manager"}.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editManagerId) return;
                updateMutation.mutate({
                  id: editManagerId,
                  name: editName.trim() || undefined,
                  password: editPassword.trim() ? editPassword : undefined,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Reset login password
                </Label>
                {editManager?.has_password ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Current password cannot be viewed. Enter a new temporary password to reset.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">No password set yet.</p>
                )}
                <Input
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  type="text"
                  autoComplete="off"
                  placeholder="New temporary password"
                />
              </div>
              {updateMutation.isError && (
                <p className="text-sm text-red-600 font-medium" role="alert">
                  {updateMutation.error instanceof Error ? updateMutation.error.message : "Update failed."}
                </p>
              )}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ShowOncePasswordDialog
          open={showOnceOpen}
          onOpenChange={setShowOnceOpen}
          accountLabel={showOnceLabel}
          email={showOnceEmail}
          temporaryPassword={showOncePassword}
        />
      </div>
    </div>
  );
}
