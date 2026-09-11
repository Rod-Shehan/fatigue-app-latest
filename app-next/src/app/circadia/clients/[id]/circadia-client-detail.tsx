"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { MANAGER_PAGE_SHELL } from "@/lib/manager-experience";
import {
  ENTITLEMENT_LABELS,
  type ClientEntitlements,
} from "@/lib/tenant";
import { CIRCADIA_DRIVE_GMAIL } from "@/lib/pdf-drop/mailbox";

type TenantDetail = {
  id: string;
  legal_name: string;
  slug: string;
  status: string;
  records_inbox: string | null;
  entitlements: ClientEntitlements;
  users: number;
  drivers: number;
  sheets: number;
};

const ENFORCEMENT_NOTE: Partial<Record<keyof ClientEntitlements, string>> = {
  gpsTrail: "Stored now. GPS trail still reads the global system flag until it is per-client.",
  camera: "Stored now. Camera alerts still read the global system flag until they are per-client.",
  command: "Stored now. Command desk is not switched from this pack yet.",
  frms: "Stored now. FRMS heatmap is not switched from this pack yet.",
};

export function CircadiaClientDetail({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const detailKey = ["circadia", "tenant", clientId] as const;
  const [legalName, setLegalName] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [inbox, setInbox] = useState<string | null>(null);
  const [dropWeek, setDropWeek] = useState("");
  const [dropMessage, setDropMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: detailKey,
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenants/${clientId}`);
      const json = (await res.json()) as { tenant?: TenantDetail; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load client");
      if (!json.tenant) throw new Error("Client not found");
      return json.tenant;
    },
  });

  const dropQuery = useQuery({
    queryKey: ["circadia", "tenant", clientId, "pdf-drop"],
    enabled: Boolean(detailQuery.data),
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenants/${clientId}/pdf-drop`);
      const json = (await res.json()) as {
        drop?: {
          provider: string;
          configured: boolean;
          folderPath: string;
          shareEmail: string | null;
          mailbox: string;
          missing: string[];
        };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load PDF drop");
      if (!json.drop) throw new Error("PDF drop status missing");
      return json.drop;
    },
  });

  const dropMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/tenants/${clientId}/pdf-drop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; detail?: string; dropped?: number; skippedUnsigned?: number };
      if (!res.ok) throw new Error(json.error || "PDF drop failed");
      return json;
    },
    onSuccess: (json) => {
      setFormError(null);
      if (typeof json.dropped === "number") {
        setDropMessage(
          `Dropped ${json.dropped} signed week PDF${json.dropped === 1 ? "" : "s"}${
            json.skippedUnsigned ? ` (${json.skippedUnsigned} unsigned skipped)` : ""
          }.`
        );
      } else {
        setDropMessage(json.detail || "Invite sent.");
      }
      void queryClient.invalidateQueries({ queryKey: ["circadia", "tenant", clientId, "pdf-drop"] });
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : "Failed"),
  });

  const tenant = detailQuery.data;
  const nameValue = legalName ?? tenant?.legal_name ?? "";
  const slugValue = slug ?? tenant?.slug ?? "";
  const inboxValue = inbox ?? tenant?.records_inbox ?? "";

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/tenants/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to update client");
      return json;
    },
    onSuccess: () => {
      setFormError(null);
      setLegalName(null);
      setSlug(null);
      setInbox(null);
      void queryClient.invalidateQueries({ queryKey: detailKey });
      void queryClient.invalidateQueries({ queryKey: ["circadia", "tenants"] });
      void queryClient.invalidateQueries({ queryKey: ["circadia", "tenant", clientId, "pdf-drop"] });
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : "Failed"),
  });

  return (
    <div className={`${MANAGER_PAGE_SHELL} space-y-8`}>
        <PageHeader
          backHref="/circadia"
          backLabel="Circadia client manager"
          backText="Clients"
          title={tenant?.legal_name ?? "Client"}
          subtitle="Identity, pause, filing inbox, Google Drive PDF drop, product pack"
          icon={<Building2 className="w-5 h-5" />}
        />

        {detailQuery.isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        ) : detailQuery.isError ? (
          <p className="text-sm text-red-600">{detailQuery.error.message}</p>
        ) : tenant ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <UsageCard label="Users" value={tenant.users} />
              <UsageCard label="Drivers" value={tenant.drivers} />
              <UsageCard label="Sheets" value={tenant.sheets} />
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Identity
              </h2>
              <input
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
                value={nameValue}
                onChange={(e) => setLegalName(e.target.value)}
              />
              <input
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
                value={slugValue}
                onChange={(e) => setSlug(e.target.value)}
              />
              <Button
                type="button"
                disabled={patchMutation.isPending}
                onClick={() =>
                  patchMutation.mutate({
                    legal_name: nameValue,
                    slug: slugValue,
                  })
                }
              >
                Save name and slug
              </Button>
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Access
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {tenant.status === "paused"
                  ? "Paused. Drivers and managers of this organisation cannot sign in. Circadia staff still can."
                  : "Active. This organisation’s people can sign in as usual."}
              </p>
              <Button
                type="button"
                variant={tenant.status === "paused" ? "default" : "outline"}
                disabled={patchMutation.isPending}
                onClick={() => {
                  const next = tenant.status === "paused" ? "active" : "paused";
                  const ok =
                    next === "active" ||
                    window.confirm(
                      "Pause this organisation? Their drivers and managers will not be able to sign in. Circadia staff can still sign in."
                    );
                  if (!ok) return;
                  patchMutation.mutate({ status: next });
                }}
              >
                {tenant.status === "paused" ? "Resume client" : "Pause client"}
              </Button>
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Filing inbox
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Operator records inbox for forced weekly PDF delivery. Delivery address only — not
                the source of record.
              </p>
              <input
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
                type="email"
                placeholder="records@operator.example"
                value={inboxValue}
                onChange={(e) => setInbox(e.target.value)}
              />
              <Button
                type="button"
                disabled={patchMutation.isPending}
                onClick={() => patchMutation.mutate({ records_inbox: inboxValue })}
              >
                Save inbox
              </Button>
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                PDF drop
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                PDFs land in {CIRCADIA_DRIVE_GMAIL} My Drive, in a folder named after this client.
                You invite their filing inbox. They open Shared with me, see a normal folder of
                files, and copy them out. This is a transfer dock, not their archive.
              </p>
              {dropQuery.isLoading ? (
                <p className="text-sm text-slate-500">Checking Google Drive…</p>
              ) : dropQuery.isError ? (
                <p className="text-sm text-red-600">{dropQuery.error.message}</p>
              ) : dropQuery.data ? (
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  <p>
                    Provider: <strong>{dropQuery.data.provider}</strong>
                    {dropQuery.data.configured ? " — ready" : " — not ready"}
                  </p>
                  <p>
                    Drive mailbox: <strong>{dropQuery.data.mailbox}</strong>
                  </p>
                  <p>
                    Folder: <code className="text-xs">{dropQuery.data.folderPath}</code>
                  </p>
                  {dropQuery.data.missing.length > 0 ? (
                    <p className="text-amber-700 dark:text-amber-300">
                      Missing: {dropQuery.data.missing.join(", ")}
                    </p>
                  ) : null}
                  {!dropQuery.data.shareEmail ? (
                    <p className="text-amber-700 dark:text-amber-300">
                      Save a filing inbox email above before inviting.
                    </p>
                  ) : (
                    <p>Invite goes to {dropQuery.data.shareEmail}.</p>
                  )}
                </div>
              ) : null}
              <Button
                type="button"
                disabled={dropMutation.isPending || !dropQuery.data?.configured || !dropQuery.data.shareEmail}
                onClick={() => dropMutation.mutate({ action: "invite" })}
              >
                Invite inbox to this folder
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block text-xs text-slate-500 dark:text-slate-400 flex-1">
                  Week starting (YYYY-MM-DD)
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
                    type="date"
                    value={dropWeek}
                    onChange={(e) => setDropWeek(e.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  disabled={dropMutation.isPending || !dropQuery.data?.configured || !dropWeek}
                  onClick={() => dropMutation.mutate({ action: "drop_week", week_starting: dropWeek })}
                >
                  Drop signed week PDFs
                </Button>
              </div>
              {dropMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{dropMessage}</p> : null}
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Product pack
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Toggles are stored on this client. EWD and Enterprise isolation already follow the
                named container. GPS, camera, Command, and FRMS still use global flags until those
                paths are wired per client.
              </p>
              <ul className="space-y-3">
                {(Object.keys(ENTITLEMENT_LABELS) as (keyof ClientEntitlements)[]).map((key) => (
                  <li key={key}>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={tenant.entitlements[key]}
                        disabled={patchMutation.isPending}
                        onChange={(e) =>
                          patchMutation.mutate({ entitlements: { [key]: e.target.checked } })
                        }
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {ENTITLEMENT_LABELS[key]}
                        </span>
                        {ENFORCEMENT_NOTE[key] ? (
                          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {ENFORCEMENT_NOTE[key]}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
    </div>
  );
}

function UsageCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
    </div>
  );
}
