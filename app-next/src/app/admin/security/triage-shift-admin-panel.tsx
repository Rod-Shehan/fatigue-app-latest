"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type TriageShiftAdminSnapshot, type TriageShiftPublic } from "@/lib/api";
import {
  TRIAGE_SHIFT_ROLES,
  toPerthDatetimeLocalValue,
  type TriageShiftAssignees,
  type TriageShiftRole,
} from "@/lib/triage-shift";
import { TriageShiftBanner } from "@/components/manager/TriageShiftBanner";

const SHIFT_KEY = ["admin", "triage-shift"] as const;
const CURRENT_KEY = ["triage-shift", "current"] as const;

const ROLE_LABELS: Record<TriageShiftRole, string> = {
  manager: "All managers (role)",
  owner: "All owners (role)",
  command_operator: "All command operators (role)",
};

function defaultWindowLocal(): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return {
    start: toPerthDatetimeLocalValue(now),
    end: toPerthDatetimeLocalValue(end),
  };
}

function emptyAssignees(): TriageShiftAssignees {
  return { userIds: [], operatorIds: [], roles: [] };
}

export function TriageShiftAdminPanel() {
  const queryClient = useQueryClient();
  const defaults = useMemo(() => defaultWindowLocal(), []);
  const [startsAtLocal, setStartsAtLocal] = useState(defaults.start);
  const [endsAtLocal, setEndsAtLocal] = useState(defaults.end);
  const [assignees, setAssignees] = useState<TriageShiftAssignees>(emptyAssignees);
  const [handoffNote, setHandoffNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const adminQuery = useQuery({
    queryKey: SHIFT_KEY,
    queryFn: () => api.admin.listTriageShifts(),
  });

  const currentQuery = useQuery({
    queryKey: CURRENT_KEY,
    queryFn: () => api.triageShiftCurrent(),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? api.admin.updateTriageShift(editingId, {
            startsAtLocal,
            endsAtLocal,
            assignees,
            handoffNote,
          })
        : api.admin.createTriageShift({
            startsAtLocal,
            endsAtLocal,
            assignees,
            handoffNote,
          }),
    onSuccess: () => {
      setFormError(null);
      setEditingId(null);
      setAssignees(emptyAssignees());
      setHandoffNote("");
      void queryClient.invalidateQueries({ queryKey: SHIFT_KEY });
      void queryClient.invalidateQueries({ queryKey: CURRENT_KEY });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.admin.deleteTriageShift(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHIFT_KEY });
      void queryClient.invalidateQueries({ queryKey: CURRENT_KEY });
    },
  });

  function loadShiftForEdit(shift: TriageShiftPublic) {
    setEditingId(shift.id);
    setStartsAtLocal(toPerthDatetimeLocalValue(shift.startsAt));
    setEndsAtLocal(toPerthDatetimeLocalValue(shift.endsAt));
    setAssignees(shift.assignees);
    setHandoffNote(shift.handoffNote ?? "");
    setFormError(null);
  }

  function toggleRole(role: TriageShiftRole) {
    setAssignees((prev) => {
      const has = prev.roles.includes(role);
      return {
        ...prev,
        roles: has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role],
      };
    });
  }

  function toggleUserId(id: string) {
    setAssignees((prev) => {
      const has = prev.userIds.includes(id);
      return {
        ...prev,
        userIds: has ? prev.userIds.filter((x) => x !== id) : [...prev.userIds, id],
      };
    });
  }

  function toggleOperatorId(id: string) {
    setAssignees((prev) => {
      const has = prev.operatorIds.includes(id);
      return {
        ...prev,
        operatorIds: has ? prev.operatorIds.filter((x) => x !== id) : [...prev.operatorIds, id],
      };
    });
  }

  const data: TriageShiftAdminSnapshot | undefined = adminQuery.data;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Triage shift</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Who may claim and confirm fatigue events on Live alerts and Command. Times are{" "}
          <strong>AWST (Perth)</strong>.
        </p>
      </div>

      {currentQuery.data ? (
        <TriageShiftBanner
          snapshot={currentQuery.data.snapshot}
          onShift={currentQuery.data.viewer.onShift}
        />
      ) : null}

      <form
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {editingId ? "Edit shift" : "Add shift"}
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Starts (AWST)</span>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
              value={startsAtLocal}
              onChange={(e) => setStartsAtLocal(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Ends (AWST)</span>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
              value={endsAtLocal}
              onChange={(e) => setEndsAtLocal(e.target.value)}
              required
            />
          </label>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Roles on shift</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {TRIAGE_SHIFT_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={assignees.roles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
        </div>

        {data?.managerUsers.length ? (
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Managers / owners</p>
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
              {data.managerUsers.map((u) => (
                <li key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={assignees.userIds.includes(u.id)}
                    onChange={() => toggleUserId(u.id)}
                  />
                  <span>
                    {u.name || u.email} <span className="text-slate-500">({u.role})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {data?.commandOperators.length ? (
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Command operators</p>
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
              {data.commandOperators.map((o) => (
                <li key={o.operatorId} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={assignees.operatorIds.includes(o.operatorId)}
                    onChange={() => toggleOperatorId(o.operatorId)}
                  />
                  <span>{o.fullName}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Handoff note (optional)</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 min-h-[72px]"
            value={handoffNote}
            onChange={(e) => setHandoffNote(e.target.value)}
            placeholder="e.g. Night desk → call Rod if confirmed fatigue"
          />
        </label>

        {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingId ? (
              "Save shift"
            ) : (
              "Add shift"
            )}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setAssignees(emptyAssignees());
                setHandoffNote("");
                setFormError(null);
              }}
            >
              Cancel edit
            </Button>
          ) : null}
        </div>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Upcoming & active</h3>
        {adminQuery.isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : !data?.shifts.length ? (
          <p className="mt-2 text-sm text-slate-500">No shifts scheduled.</p>
        ) : (
          <ul className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {data.shifts.map((shift) => (
              <li
                key={shift.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {shift.startsAtLabel} → {shift.endsAtLabel} AWST
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{shift.handoffNote || "—"}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => loadShiftForEdit(shift)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-rose-700"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm("Delete this shift?")) deleteMutation.mutate(shift.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
