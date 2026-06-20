"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { interventionForKind, type RiskLineKind } from "@/lib/manager-risk-scoring";

export type AttentionItem = {
  sheetId: string;
  driver: string;
  kind: RiskLineKind;
  detail: string;
};

export function ManagerAttentionPanel({ items }: { items: AttentionItem[] }) {
  return (
    <div className="rounded-xl border border-teal-200/60 bg-teal-50/30 p-4 dark:border-teal-900/50 dark:bg-teal-950/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {MANAGER_EXPERIENCE.ATTENTION_PANEL_TITLE}
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {MANAGER_EXPERIENCE.ATTENTION_PANEL_SUBTITLE}
          </p>
        </div>
        <Link href="/manager/messages">
          <Button variant="outline" size="sm" className="gap-2 border-teal-300/80 dark:border-teal-800">
            <ExternalLink className="h-4 w-4" />
            {MANAGER_EXPERIENCE.NAV_MESSAGES}
          </Button>
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-3 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <span>{MANAGER_EXPERIENCE.ATTENTION_EMPTY}</span>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-teal-200/50 dark:divide-teal-900/40">
          {items.slice(0, 12).map((r, idx) => {
            const guide = interventionForKind(r.kind);
            return (
              <li key={`${r.sheetId}-${r.kind}-${idx}`} className="py-4 first:pt-2">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/sheets/${r.sheetId}`}
                        className="text-sm font-bold text-teal-900 underline-offset-2 hover:underline dark:text-teal-100"
                      >
                        {r.driver}
                      </Link>
                      <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{r.detail}</p>
                      <p className="mt-1 text-xs font-medium text-teal-800 dark:text-teal-300">
                        Suggested focus: {guide.action}
                      </p>
                    </div>
                    <Link href={`/sheets/${r.sheetId}`}>
                      <Button type="button" size="sm" variant="outline" className="shrink-0">
                        {MANAGER_EXPERIENCE.ACTION_OPEN_SHEET}
                      </Button>
                    </Link>
                  </div>
                  <ol className="list-decimal space-y-0.5 pl-4 text-xs text-slate-600 dark:text-slate-400">
                    {guide.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <div className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {MANAGER_EXPERIENCE.MESSAGE_STARTER_LABEL}
                    </p>
                    <p className="mt-1 text-xs italic text-slate-700 dark:text-slate-300">
                      &ldquo;{guide.messageStarter}&rdquo;
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(guide.messageStarter);
                          } catch {
                            window.prompt("Copy:", guide.messageStarter);
                          }
                        }}
                      >
                        Copy starter
                      </Button>
                      <Link href={`/manager/messages?driver=${encodeURIComponent(r.driver)}`}>
                        <Button type="button" size="sm" className="h-8 gap-1.5 text-xs">
                          {MANAGER_EXPERIENCE.ACTION_OPEN_INBOX}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 12 ? (
        <p className="mt-2 text-xs text-slate-500">Showing first 12 — narrow filters to focus.</p>
      ) : null}
    </div>
  );
}
