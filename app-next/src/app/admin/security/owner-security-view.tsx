"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Loader2, Download, UserPlus, LogOut, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { PRODUCT_NAME } from "@/lib/branding";
import { MANAGER_EXPERIENCE, MANAGER_PAGE_SHELL } from "@/lib/manager-experience";
import { api } from "@/lib/api";
import type { SystemPolicySnapshot } from "@/lib/system-policy";
import { TriageShiftAdminPanel } from "./triage-shift-admin-panel";
import { ChecklistDeliverySettingsPanel } from "@/components/driver/ChecklistDeliverySettingsPanel";
import { MaintenanceContactSettingsPanel } from "@/components/manager/MaintenanceContactSettingsPanel";

const POLICY_KEY = ["admin", "policy"] as const;
const USERS_KEY = ["admin", "users"] as const;

function AccountList({ children }: { children: ReactNode }) {
  return (
    <ul className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
      {children}
    </ul>
  );
}

function AccountRow({
  name,
  detail,
  actions,
}: {
  name: string;
  detail: string;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </li>
  );
}

function PolicyToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 cursor-pointer">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{description}</span>
      </span>
    </label>
  );
}

export function OwnerSecurityView({
  isOwner,
  userEmail,
  currentUserId,
}: {
  isOwner: boolean;
  userEmail: string;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [claimError, setClaimError] = useState<string | null>(null);

  const policyQuery = useQuery({
    queryKey: POLICY_KEY,
    queryFn: () => api.admin.getPolicy(),
    enabled: isOwner,
  });

  const usersQuery = useQuery({
    queryKey: USERS_KEY,
    queryFn: () => api.admin.listUsers(),
    enabled: isOwner,
  });

  const policyMutation = useMutation({
    mutationFn: (patch: Partial<SystemPolicySnapshot>) => api.admin.updatePolicy(patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: POLICY_KEY }),
  });

  const userPatchMutation = useMutation({
    mutationFn: (args: { id: string; disabled?: boolean; role?: "driver" | "manager" }) =>
      api.admin.patchUser(args.id, { disabled: args.disabled, role: args.role }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });

  const userDeleteMutation = useMutation({
    mutationFn: (id: string) => api.admin.deleteUser(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });

  function confirmDeleteUser(u: { id: string; email: string | null; name: string | null; role: string }) {
    const label = u.name || u.email || u.id;
    const ok = window.confirm(
      `Delete ${u.role} account "${label}"?\n\nThis removes their sign-in. Sheet history they created may remain.`
    );
    if (ok) userDeleteMutation.mutate(u.id);
  }

  function deleteUserButton(u: { id: string; email: string | null; name: string | null; role: string }) {
    if (u.id === currentUserId) return null;
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-red-600 dark:text-red-400"
        disabled={userDeleteMutation.isPending}
        onClick={() => confirmDeleteUser(u)}
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </Button>
    );
  }

  const claimMutation = useMutation({
    mutationFn: () => api.admin.claimOwner(),
    onSuccess: () => {
      window.location.reload();
    },
    onError: () => setClaimError("Could not claim owner role. Check OWNER_SEED_EMAIL matches your account."),
  });

  const policy = policyQuery.data?.policy;
  const allUsers = usersQuery.data?.users ?? [];
  const owners = allUsers.filter((u) => u.role === "owner");
  const managers = allUsers.filter((u) => u.role === "manager");
  const drivers = allUsers.filter((u) => u.role === "driver");

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className={MANAGER_PAGE_SHELL}>
          <div className="mx-auto max-w-md space-y-6">
          <PageHeader
            backHref="/manager"
            backLabel={MANAGER_EXPERIENCE.NAV_RISK_BRIEF}
            backText={MANAGER_EXPERIENCE.NAV_OVERVIEW}
            title="Owner console"
            subtitle={`${PRODUCT_NAME} — claim organisation owner access`}
            icon={<Shield className="w-5 h-5" />}
          />
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-5 space-y-4">
            <p className="text-sm text-amber-950 dark:text-amber-100 leading-relaxed">
              No organisation owner exists yet. If you are IT / fleet governance, claim owner access for{" "}
              <strong>{userEmail}</strong> (must match <code className="text-xs">OWNER_SEED_EMAIL</code> on the
              server).
            </p>
            {claimError ? (
              <p className="text-sm text-red-600 dark:text-red-400 font-medium" role="alert">
                {claimError}
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={claimMutation.isPending}
              onClick={() => claimMutation.mutate()}
            >
              {claimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Claim owner access"}
            </Button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className={`${MANAGER_PAGE_SHELL} space-y-8`}>
        <PageHeader
          backHref="/manager"
          backLabel={MANAGER_EXPERIENCE.NAV_RISK_BRIEF}
          backText={MANAGER_EXPERIENCE.NAV_OVERVIEW}
          title="Owner console"
          subtitle={`${PRODUCT_NAME} — lockdown, users, audit`}
          icon={<Shield className="w-5 h-5" />}
        />

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            System lockdown
          </h2>
          {policyQuery.isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          ) : policy ? (
            <div className="space-y-3">
              <PolicyToggle
                label="Disable new sign-ins"
                description="Blocks driver and manager login. Owners can still sign in for break-glass access."
                checked={policy.loginDisabled}
                disabled={policyMutation.isPending}
                onChange={(loginDisabled) => policyMutation.mutate({ loginDisabled })}
              />
              <PolicyToggle
                label="Freeze driver record updates"
                description="Drivers can read and produce PDFs but cannot save sheet changes."
                checked={policy.driverWritesDisabled}
                disabled={policyMutation.isPending}
                onChange={(driverWritesDisabled) => policyMutation.mutate({ driverWritesDisabled })}
              />
              <PolicyToggle
                label="Freeze manager record updates"
                description="Managers can view compliance but cannot amend sheets."
                checked={policy.managerWritesDisabled}
                disabled={policyMutation.isPending}
                onChange={(managerWritesDisabled) => policyMutation.mutate({ managerWritesDisabled })}
              />
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Enterprise addons
          </h2>
          {policyQuery.isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          ) : policy ? (
            <PolicyToggle
              label="GPS movement trail"
              description="Optional. Drivers sample movement between logs for Event Tracker trails, and Work / Break lock while moving. Same control as Test desk — leave off if your organisation does not use this addon."
              checked={policy.gpsMovementTrailEnabled}
              disabled={policyMutation.isPending}
              onChange={(gpsMovementTrailEnabled) => policyMutation.mutate({ gpsMovementTrailEnabled })}
            />
          ) : null}
        </section>

        <ChecklistDeliverySettingsPanel showOutboundStatus />
        <MaintenanceContactSettingsPanel title="WAHVA maintenance contact" showOutboundStatus />

        <TriageShiftAdminPanel />

        {owners.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Organisation owners
            </h2>
            <AccountList>
              {owners.map((u) => (
                <AccountRow
                  key={u.id}
                  name={u.name || u.email || u.id}
                  detail={`${u.email ?? ""} · owner${u.id === currentUserId ? " · you" : ""}`}
                  actions={deleteUserButton(u)}
                />
              ))}
            </AccountList>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Fleet managers
          </h2>
          <Link
            href="/manager/add-managers"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 dark:text-teal-400 hover:underline"
          >
            <UserPlus className="w-4 h-4" />
            Add manager
          </Link>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Only owners can create manager accounts. Managers cannot appoint other managers.
          </p>
          {usersQuery.isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          ) : managers.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center">
              No fleet managers yet. Add one to open the manager dashboard.
            </p>
          ) : (
            <AccountList>
              {managers.map((u) => (
                <AccountRow
                  key={u.id}
                  name={u.name || u.email || u.id}
                  detail={`${u.email ?? ""} · manager${u.disabled ? " · disabled" : ""}`}
                  actions={
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={userPatchMutation.isPending}
                        onClick={() => userPatchMutation.mutate({ id: u.id, role: "driver" })}
                      >
                        Demote
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={userPatchMutation.isPending}
                        onClick={() => userPatchMutation.mutate({ id: u.id, disabled: !u.disabled })}
                      >
                        {u.disabled ? "Enable" : "Disable"}
                      </Button>
                      {deleteUserButton(u)}
                    </>
                  }
                />
              ))}
            </AccountList>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Driver accounts
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Field sign-in and weekly records.</p>
          {usersQuery.isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          ) : drivers.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center">
              No driver accounts yet.
            </p>
          ) : (
            <AccountList>
              {drivers.map((u) => (
                <AccountRow
                  key={u.id}
                  name={u.name || u.email || u.id}
                  detail={`${u.email ?? ""} · driver${u.disabled ? " · disabled" : ""}`}
                  actions={
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={userPatchMutation.isPending}
                        onClick={() => userPatchMutation.mutate({ id: u.id, role: "manager" })}
                      >
                        Make manager
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={userPatchMutation.isPending}
                        onClick={() => userPatchMutation.mutate({ id: u.id, disabled: !u.disabled })}
                      >
                        {u.disabled ? "Enable" : "Disable"}
                      </Button>
                      {deleteUserButton(u)}
                    </>
                  }
                />
              ))}
            </AccountList>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Audit export
          </h2>
          <a
            href={api.admin.auditExportUrl()}
            download
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="w-4 h-4" />
            Download audit JSON
          </a>
        </section>

        <section className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3">
          <Link
            href="/manager"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Manager dashboard
          </Link>
          <Button
            type="button"
            variant="outline"
            className="gap-2 text-red-600 dark:text-red-400"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </section>
      </div>
    </div>
  );
}
