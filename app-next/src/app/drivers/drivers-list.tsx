"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, UserCheck, UserX, Loader2, Users, Pencil } from "lucide-react";
import { getCvdMedicalBannerKind } from "@/lib/cvd-medical";

export function DriversList() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newLicence, setNewLicence] = useState("");
  const [newCvdMedical, setNewCvdMedical] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLicence, setEditLicence] = useState("");
  const [editCvdMedical, setEditCvdMedical] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
  });

  const activeDriver = useMemo(
    () => (activeDriverId ? drivers.find((d) => d.id === activeDriverId) ?? null : null),
    [activeDriverId, drivers]
  );

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      email?: string;
      licence_number?: string;
      cvd_medical_expiry?: string | null;
      password?: string;
    }) => api.drivers.create({ ...data, is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setNewName("");
      setNewEmail("");
      setNewLicence("");
      setNewCvdMedical("");
      setNewPassword("");
    },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.drivers.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drivers"] }),
  });
  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      name: string;
      email: string;
      licence_number: string;
      cvd_medical_expiry: string | null;
      is_active: boolean;
      password?: string;
    }) =>
      api.drivers.update(payload.id, {
        name: payload.name,
        email: payload.email,
        licence_number: payload.licence_number || null,
        cvd_medical_expiry: payload.cvd_medical_expiry,
        is_active: payload.is_active,
        ...(payload.password && payload.password.trim().length > 0 ? { password: payload.password } : null),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setEditOpen(false);
      setActiveDriverId(null);
      setEditPassword("");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.drivers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setDeleteOpen(false);
      setActiveDriverId(null);
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      email: newEmail.trim() ? newEmail.trim() : undefined,
      licence_number: newLicence.trim(),
      cvd_medical_expiry: newCvdMedical.trim() ? newCvdMedical.trim() : null,
      password: newPassword.trim() ? newPassword : undefined,
    });
  }

  function openEdit(driverId: string) {
    const d = drivers.find((x) => x.id === driverId);
    if (!d) return;
    setActiveDriverId(driverId);
    setEditName(d.name ?? "");
    setEditEmail(d.email ?? "");
    setEditLicence(d.licence_number ?? "");
    setEditCvdMedical(d.cvd_medical_expiry ?? "");
    setEditActive(!!d.is_active);
    setEditPassword("");
    setEditOpen(true);
  }

  function openDelete(driverId: string) {
    setActiveDriverId(driverId);
    setDeleteOpen(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader
          backHref="/sheets"
          backLabel="Your Sheets"
          title="Approved Drivers"
          subtitle="Manage the driver roster and optional WA CVD medical expiry dates"
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
          <Input
            type="date"
            value={newCvdMedical}
            onChange={(e) => setNewCvdMedical(e.target.value)}
            className="flex-1 min-w-[11rem]"
            title="WA CVD medical certificate expiry (optional)"
          />
          <Input
            placeholder="Password (optional)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="flex-1"
            type="password"
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
                {driver.cvd_medical_expiry && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    CVD medical: {driver.cvd_medical_expiry}
                  </p>
                )}
                {getCvdMedicalBannerKind(driver.cvd_medical_expiry) === "expired" && (
                  <p className="text-[10px] font-semibold text-red-600 dark:text-red-400">CVD medical expired</p>
                )}
                {getCvdMedicalBannerKind(driver.cvd_medical_expiry) === "soon" && (
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">CVD medical renew within 30 days</p>
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
                onClick={() => openEdit(driver.id)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
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
                onClick={() => openDelete(driver.id)}
                className="text-slate-300 dark:text-slate-500 hover:text-red-400 dark:hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
              setActiveDriverId(null);
              updateMutation.reset();
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit driver</DialogTitle>
              <DialogDescription>Update the roster record (and login email/name).</DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!activeDriverId) return;
                updateMutation.mutate({
                  id: activeDriverId,
                  name: editName.trim(),
                  email: editEmail.trim(),
                  licence_number: editLicence.trim(),
                  cvd_medical_expiry: editCvdMedical.trim() ? editCvdMedical.trim() : null,
                  is_active: editActive,
                  password: editPassword.trim() ? editPassword : undefined,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Full name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Email</Label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Licence no. (optional)</Label>
                <Input value={editLicence} onChange={(e) => setEditLicence(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  WA CVD medical expiry (optional)
                </Label>
                <Input type="date" value={editCvdMedical} onChange={(e) => setEditCvdMedical(e.target.value)} />
                <p className="text-[11px] text-slate-400">Commercial Vehicle Driver medical certificate — for in-app reminders only.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Set/reset password</Label>
                <Input
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  type="password"
                  placeholder="Leave blank to keep unchanged"
                />
                <p className="text-[11px] text-slate-400">Minimum 6 characters.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                Active
              </label>

              {updateMutation.isError && (
                <p className="text-sm text-red-600 font-medium" role="alert">
                  {updateMutation.error instanceof Error ? updateMutation.error.message : "Failed to update driver."}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                  disabled={updateMutation.isPending || !editName.trim() || !editEmail.trim()}
                >
                  {updateMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            if (!open) {
              setActiveDriverId(null);
              deleteMutation.reset();
            }
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete driver?</DialogTitle>
              <DialogDescription>
                This removes the driver from the roster. It won&apos;t delete existing sheets that reference the driver name.
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">{activeDriver?.name ?? "This driver"}</span>
              {activeDriver?.email ? <span className="text-slate-500"> ({activeDriver.email})</span> : null}
            </div>

            {deleteMutation.isError && (
              <p className="text-sm text-red-600 font-medium" role="alert">
                {deleteMutation.error instanceof Error ? deleteMutation.error.message : "Failed to delete driver."}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!activeDriverId || deleteMutation.isPending}
                onClick={() => activeDriverId && deleteMutation.mutate(activeDriverId)}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
