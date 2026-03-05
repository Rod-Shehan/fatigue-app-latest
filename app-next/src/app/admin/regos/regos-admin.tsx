"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, type Rego } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, Plus, Trash2, Truck } from "lucide-react";
import { useState } from "react";

export function RegosAdmin() {
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("");

  const { data: regos = [], isLoading } = useQuery({
    queryKey: ["regos"],
    queryFn: () => api.regos.list(),
  });

  const createMutation = useMutation({
    mutationFn: (label: string) => api.regos.create({ label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regos"] });
      setNewLabel("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.regos.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["regos"] }),
  });

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    createMutation.mutate(label);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <PageHeader
          backHref="/manager"
          backLabel="Manager dashboard"
          title="Truck Rego List"
          subtitle="Manage regos for the sheet dropdown (admin)"
          icon={<Truck className="w-5 h-5" />}
        />

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Add rego</h2>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. 1ABC 234"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1 font-mono"
            />
            <Button
              onClick={handleAdd}
              disabled={!newLabel.trim() || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </Button>
          </div>
        </div>

        <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            Current regos ({regos.length})
          </h2>
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
          {!isLoading && regos.length === 0 && (
            <div className="text-center py-8 px-4">
              <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">No regos yet</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                Regos appear in the truck dropdown on each day card. Add vehicle regos above so drivers can select them when logging.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Use the &quot;Add rego&quot; form above to add your first rego.</p>
            </div>
          )}
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {regos.map((rego) => (
              <li key={rego.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-mono text-slate-800 dark:text-slate-200">{rego.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/50"
                  onClick={() => deleteMutation.mutate(rego.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
