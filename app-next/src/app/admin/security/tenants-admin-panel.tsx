"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type TenantRow = {
  id: string;
  legal_name: string;
  slug: string;
  users: number;
  drivers: number;
  sheets: number;
};

const TENANTS_KEY = ["admin", "tenants"] as const;

export function TenantsAdminPanel() {
  const queryClient = useQueryClient();
  const [legalName, setLegalName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: TENANTS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/admin/tenants");
      const json = (await res.json()) as { tenants?: TenantRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load clients");
      return json.tenants ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_name: legalName,
          slug: slug || undefined,
          owner_email: ownerEmail,
          owner_name: ownerName || undefined,
          owner_password: ownerPassword || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to create client");
      return json;
    },
    onSuccess: () => {
      setLegalName("");
      setSlug("");
      setOwnerEmail("");
      setOwnerName("");
      setOwnerPassword("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: TENANTS_KEY });
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : "Failed"),
  });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <Building2 className="w-4 h-4" />
        Clients (EWD containers)
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Each paying operator is a separate client. Their drivers, sheets, and PDFs stay in that
        container. Sign in as that client’s owner to add their people — this console login stays on
        your home client.
      </p>
      {listQuery.isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      ) : (
        <ul className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
          {(listQuery.data ?? []).map((t) => (
            <li key={t.id} className="px-4 py-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.legal_name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.slug} · {t.users} users · {t.drivers} drivers · {t.sheets} sheets
              </p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add a client</p>
        <input
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
          placeholder="Legal name"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          required
        />
        <input
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
          placeholder="Slug (optional, e.g. acme)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
          type="email"
          placeholder="First owner email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
          placeholder="Owner display name (optional)"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
          type="password"
          placeholder="Owner password (optional if shared login is on)"
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.target.value)}
        />
        {formError ? <p className="text-xs text-red-600">{formError}</p> : null}
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create client"}
        </Button>
      </form>
    </section>
  );
}
