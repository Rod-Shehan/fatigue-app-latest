"use client";

import { useState } from "react";
import Link from "next/link";
import { FileBadge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { driverActionBtn } from "@/components/driver/driver-ui-classes";
import { ROADSIDE_PRODUCE_BUTTON_LABEL } from "@/lib/roadside-pdf";

type Variant = "primary" | "strip" | "stacked";

export function DriverRoadsideProduceButton({
  variant = "primary",
  className,
  onNavigate,
}: {
  variant?: Variant;
  className?: string;
  /** Close gear drawer before opening PDF. */
  onNavigate?: () => void;
}) {
  const [pending, setPending] = useState(false);

  const openPdf = () => {
    onNavigate?.();
    setPending(true);
    window.open(api.driver.roadsideProducePdfUrl(), "_blank");
    window.setTimeout(() => setPending(false), 2000);
  };

  if (variant === "strip") {
    return (
      <Link
        href="/driver/roadside"
        onClick={onNavigate}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border-2 border-amber-400 dark:border-amber-600",
          "bg-amber-50 dark:bg-amber-950/50 px-4 py-3 min-h-[56px]",
          "text-amber-950 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40",
          "active:bg-amber-200/80 dark:active:bg-amber-900/60 transition-colors",
          className
        )}
      >
        <FileBadge className="w-6 h-6 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <span className="flex-1 text-left text-base font-bold leading-tight">
          {ROADSIDE_PRODUCE_BUTTON_LABEL}
        </span>
      </Link>
    );
  }

  const stacked = variant === "stacked";

  return (
    <Button
      type="button"
      variant={stacked ? "outline" : "default"}
      size="default"
      className={cn(
        stacked
          ? cn(
              driverActionBtn,
              "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 hover:bg-amber-100"
            )
          : "w-full h-14 text-base font-bold gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-md border-0",
        className
      )}
      disabled={pending}
      onClick={openPdf}
    >
      {pending ? (
        <Loader2 className="w-5 h-5 animate-spin shrink-0" />
      ) : (
        <FileBadge className="w-5 h-5 shrink-0" />
      )}
      {ROADSIDE_PRODUCE_BUTTON_LABEL}
    </Button>
  );
}
