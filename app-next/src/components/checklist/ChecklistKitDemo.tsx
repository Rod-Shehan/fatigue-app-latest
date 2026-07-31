"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  emptyAcknowledgeItem,
  emptyPassFailItem,
  FFW_SCHEMA_STUB,
  isAcknowledgeItemComplete,
  isPassFailItemComplete,
  LOAD_SCHEMA_STUB,
  PRESTART_SCHEMA_STUB,
  type ChecklistAcknowledgeItemState,
  type ChecklistPassFailItemState,
  type ChecklistSignatureCapture,
} from "@/lib/checklist";
import { ChecklistAcknowledgeItem } from "./ChecklistAcknowledgeItem";
import { ChecklistItemControl } from "./ChecklistItemControl";
import { ChecklistKitSurface } from "./ChecklistKitSurface";
import { ChecklistModalShell } from "./ChecklistModalShell";
import { ChecklistSignaturePanel } from "./ChecklistSignaturePanel";

type DemoKind = "ffw" | "prestart" | "load" | null;

function initAckMap() {
  const m: Record<string, ChecklistAcknowledgeItemState> = {};
  for (const item of FFW_SCHEMA_STUB) m[item.code] = emptyAcknowledgeItem();
  return m;
}

function initPassFailMap(codes: string[]) {
  const m: Record<string, ChecklistPassFailItemState> = {};
  for (const code of codes) m[code] = emptyPassFailItem();
  return m;
}

export function ChecklistKitDemo({ backHref = "/manager/alerts" }: { backHref?: string }) {
  const [open, setOpen] = useState<DemoKind>(null);
  const [ffw, setFfw] = useState(initAckMap);
  const [prestart, setPrestart] = useState(() =>
    initPassFailMap(PRESTART_SCHEMA_STUB.map((g) => g.code))
  );
  const [load, setLoad] = useState(() => initPassFailMap(LOAD_SCHEMA_STUB.map((i) => i.code)));
  const [sig, setSig] = useState<ChecklistSignatureCapture | null>(null);

  const ffwDone = useMemo(
    () => FFW_SCHEMA_STUB.every((i) => isAcknowledgeItemComplete(ffw[i.code]!)),
    [ffw]
  );
  const prestartDone = useMemo(
    () => Object.values(prestart).every(isPassFailItemComplete),
    [prestart]
  );
  const loadDone = useMemo(() => Object.values(load).every(isPassFailItemComplete), [load]);

  const openDemo = (kind: DemoKind) => {
    setSig(null);
    setOpen(kind);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Phase 1 kit</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Compliance checklist UI
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-xl">
            Fixture demo only — no persistence, gates, or PDF. Schema stubs are placeholders until
            legal copy is locked.
          </p>
        </div>
        <Link
          href={backHref}
          className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
        >
          Back
        </Link>
      </div>

      <ChecklistKitSurface className="rounded-2xl border border-ck-border p-4 space-y-3">
        <p className="text-sm text-ck-steel">Open a stub form in the modal shell:</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["ffw", "Fitness for Work"],
              ["prestart", "Prestart"],
              ["load", "Dimension & Load"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => openDemo(id)}
              className="min-h-[52px] rounded-xl bg-ck-cobalt px-3 text-sm font-bold text-white"
            >
              {label}
            </button>
          ))}
        </div>
      </ChecklistKitSurface>

      <ChecklistModalShell
        open={open === "ffw"}
        onClose={() => setOpen(null)}
        title="Fitness for Work"
        subtitle="Acknowledge / declare · demo stub"
        footer={
          <p className="text-center text-xs text-ck-steel">
            {ffwDone && sig ? "Demo complete (not saved)" : "Complete all points + signature"}
          </p>
        }
      >
        <div className="space-y-2">
          {FFW_SCHEMA_STUB.map((item) => (
            <ChecklistAcknowledgeItem
              key={item.code}
              label={item.label}
              state={ffw[item.code]!}
              onChange={(next) => setFfw((s) => ({ ...s, [item.code]: next }))}
            />
          ))}
          <ChecklistSignaturePanel
            title="Driver signature"
            roleLabel="As driver"
            onConfirmed={setSig}
          />
        </div>
      </ChecklistModalShell>

      <ChecklistModalShell
        open={open === "prestart"}
        onClose={() => setOpen(null)}
        title="Prestart inspection"
        subtitle="Pass / Fail / N/A · demo stub"
        footer={
          <p className="text-center text-xs text-ck-steel">
            {prestartDone && sig ? "Demo complete (not saved)" : "Complete items + signature"}
          </p>
        }
      >
        <div className="space-y-3">
          {PRESTART_SCHEMA_STUB.map((group) => (
            <ChecklistItemControl
              key={group.code}
              label={group.label}
              notes={group.notes}
              state={prestart[group.code]!}
              onChange={(next) => setPrestart((s) => ({ ...s, [group.code]: next }))}
            />
          ))}
          <ChecklistSignaturePanel
            title="Driver signature"
            roleLabel="As driver"
            onConfirmed={setSig}
          />
        </div>
      </ChecklistModalShell>

      <ChecklistModalShell
        open={open === "load"}
        onClose={() => setOpen(null)}
        title="Dimension & Load"
        subtitle="Driver check · demo stub (loader CoR paths in Phase 5)"
        footer={
          <p className="text-center text-xs text-ck-steel">
            {loadDone && sig ? "Demo complete (not saved)" : "Complete items + signature"}
          </p>
        }
      >
        <div className="space-y-2">
          {LOAD_SCHEMA_STUB.map((item) => (
            <ChecklistItemControl
              key={item.code}
              label={item.label}
              state={load[item.code]!}
              onChange={(next) => setLoad((s) => ({ ...s, [item.code]: next }))}
            />
          ))}
          <ChecklistSignaturePanel
            title="Driver signature"
            roleLabel="As driver"
            onConfirmed={setSig}
          />
        </div>
      </ChecklistModalShell>
    </div>
  );
}
