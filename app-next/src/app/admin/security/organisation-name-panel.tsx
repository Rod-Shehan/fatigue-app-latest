"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const ORG_KEY = ["admin", "organisation"] as const;

/**
 * Organisation legal name printed as OPERATOR on weekly trip sheet PDFs.
 * One name for the fleet — owners set it here, not drivers.
 */
export function OrganisationNamePanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ORG_KEY,
    queryFn: () => api.admin.getOrganisation(),
  });

  const [legalName, setLegalName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (typeof query.data?.legal_name === "string") {
      setLegalName(query.data.legal_name);
    }
  }, [query.data?.legal_name]);

  const mutation = useMutation({
    mutationFn: () => api.admin.updateOrganisation({ legal_name: legalName }),
    onSuccess: (data) => {
      setFormError(null);
      setLegalName(data.legal_name);
      setSavedFlash(true);
      void queryClient.invalidateQueries({ queryKey: ORG_KEY });
      window.setTimeout(() => setSavedFlash(false), 2500);
    },
    onError: (e: Error) => {
      setFormError(e.message || "Could not save operator name");
    },
  });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <Building2 className="w-4 h-4" aria-hidden />
        Operator name
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Printed as <strong className="font-semibold text-slate-600 dark:text-slate-300">OPERATOR</strong> on
        weekly trip sheet PDFs (Export and roadside). This is the organisation name for the whole fleet — not a
        per-driver field, so it is not on Drive home.
      </p>
      {query.isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="org-legal-name"
              className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
            >
              Organisation / operator
            </Label>
            <Input
              id="org-legal-name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Acme Haulage Pty Ltd"
              autoComplete="organization"
              maxLength={160}
            />
          </div>
          {formError ? <p className="text-xs text-red-600 dark:text-red-400">{formError}</p> : null}
          {savedFlash ? (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Saved</p>
          ) : null}
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="min-h-11 w-full sm:w-auto"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving
              </>
            ) : (
              "Save operator name"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
