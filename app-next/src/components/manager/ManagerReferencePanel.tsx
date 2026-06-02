"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MANAGER_REFERENCE_CARDS,
  MANAGER_REFERENCE_LAST_REVIEWED,
} from "@/lib/manager-risk-reference";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";

export function ManagerReferencePanel() {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="mb-6 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-700 dark:bg-slate-900/80"
      aria-label={MANAGER_EXPERIENCE.REFERENCE_TITLE}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
            <BookOpen className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {MANAGER_EXPERIENCE.REFERENCE_TITLE}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Industry context · last reviewed {MANAGER_REFERENCE_LAST_REVIEWED}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? (
            <>
              <ChevronUp className="h-4 w-4" />
              {MANAGER_EXPERIENCE.REFERENCE_CLOSE}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              {MANAGER_EXPERIENCE.REFERENCE_TOGGLE}
            </>
          )}
        </Button>
      </div>
      {open ? (
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          {MANAGER_REFERENCE_CARDS.map((card) => (
            <article
              key={card.id}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{card.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {card.summary}
              </p>
              <ul className="mt-2.5 list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-400">
                {card.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
          <p className="sm:col-span-2 text-[11px] text-slate-500 dark:text-slate-500">
            {MANAGER_EXPERIENCE.HERO_DISCLAIMER}
          </p>
        </div>
      ) : null}
    </section>
  );
}
