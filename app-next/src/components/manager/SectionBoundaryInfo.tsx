"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";

type SectionBoundaryInfoProps = {
  sectionTitle: string;
  body: string;
  triggerClassName?: string;
};

/** Inline (i) control — opens accessible dialog with legal boundary copy. */
export function SectionBoundaryInfo({ sectionTitle, body, triggerClassName }: SectionBoundaryInfoProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const bodyId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-500 transition-colors",
          "hover:border-current/25 hover:bg-white/60 hover:text-slate-800",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400",
          "dark:text-slate-400 dark:hover:bg-slate-900/50 dark:hover:text-slate-100 dark:focus-visible:ring-slate-500",
          triggerClassName
        )}
        aria-label={`${MANAGER_EXPERIENCE.SECTION_BOUNDARY_TOOLTIP_LABEL} for ${sectionTitle}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" aria-describedby={bodyId}>
          <DialogHeader>
            <DialogTitle id={titleId}>{MANAGER_EXPERIENCE.SECTION_BOUNDARY_TOOLTIP_LABEL}</DialogTitle>
            <DialogDescription className="sr-only">{sectionTitle}</DialogDescription>
          </DialogHeader>
          <p id={bodyId} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {body}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
