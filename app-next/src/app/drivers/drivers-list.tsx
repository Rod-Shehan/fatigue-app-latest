"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2, UserCheck, UserX, Loader2, Users } from "lucide-react";

export function DriversList() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newLicence, setNewLicence] = useState("");
  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
  });
  const createMutation = useMutation({
    mutationFn: (data: { name: string; email?: string; licence_number?: string }) =>
      api.drivers.create({ ...data, is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setNewName("");
      setNewEmail("");
      setNewLicence("");
    },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.drivers.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drivers"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.drivers.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drivers"] }),
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      email: newEmail.trim() ? newEmail.trim() : undefined,
      licence_number: newLicence.trim(),
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader
          backHref="/sheets"
          backLabel="Your Sheets"
          title="Approved Drivers"
          subtitle="Manage the driver roster"
          icon={<Users className="w-5 h-5" />}
        />
        <form
          onSubmit={handleAdd}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mb-4 flex flex-col sm:flex-row gap-2"
        >
          <Input
            placeholder="Full name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
            required
          />
          <Input
            placeholder="Email * (for driver login)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1"
            type="email"
            required
          />
          <Input
            placeholder="Licence no. (optional)"
            value={newLicence}
            onChange={(e) => setNewLicence(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={createMutation.isPending || !newName.trim() || !newEmail.trim()}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white dark:text-slate-100 gap-1.5 shrink-0"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Driver
          </Button>
        </form>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {isLoading && (
            <div className="flex justify-center p-10">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}
          {!isLoading && drivers.length === 0 && (
            <div className="text-center py-10 px-4">
              <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">No drivers added yet</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add drivers above so they can be selected on fatigue sheets. Drivers must be in the roster before they can log shifts.
              </p>
            </div>
          )}
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{driver.name}</p>
                {driver.email && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{driver.email}</p>
                )}
                {driver.licence_number && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{driver.licence_number}</p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  driver.is_active ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                }`}
              >
                {driver.is_active ? "Active" : "Inactive"}
              </span>
              <button
                type="button"
                onClick={() => toggleMutation.mutate({ id: driver.id, is_active: !driver.is_active })}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                title={driver.is_active ? "Deactivate" : "Activate"}
              >
                {driver.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(driver.id)}
                className="text-slate-300 dark:text-slate-500 hover:text-red-400 dark:hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
