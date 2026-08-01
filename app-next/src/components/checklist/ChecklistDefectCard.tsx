"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  CHECKLIST_FAULT_MOBILITY_OPTIONS,
  normalizeDefect,
  type ChecklistDefect,
  type ChecklistFaultMobility,
} from "@/lib/checklist";

export function ChecklistDefectCard({
  defect,
  onChange,
  className,
  title = "Defect",
  descriptionLabel = "Description (required)",
  descriptionPlaceholder = "Describe the defect",
}: {
  defect: ChecklistDefect;
  onChange: (next: ChecklistDefect) => void;
  className?: string;
  title?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
}) {
  const normalized = normalizeDefect(defect);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const setMobility = (value: ChecklistFaultMobility) => {
    onChange({
      ...normalized,
      mobilityStatus: value,
      unsafeToDrive: undefined,
    });
  };

  return (
    <div
      className={cn(
        "mt-2 rounded-lg border border-ck-red/50 bg-ck-midnight/60 p-3 space-y-3",
        className
      )}
      role="region"
      aria-label={title}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-ck-red">{title}</p>
      <label className="block space-y-1">
        <span className="text-xs text-ck-steel">{descriptionLabel}</span>
        <textarea
          value={normalized.description}
          onChange={(e) => onChange({ ...normalized, description: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-ck-border bg-ck-slate px-3 py-2 text-sm text-ck-fg placeholder:text-ck-steel focus:outline-none focus:ring-2 focus:ring-ck-cobalt"
          placeholder={descriptionPlaceholder}
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-xs text-ck-steel">Vehicle status (required)</legend>
        <div className="space-y-1.5" role="radiogroup" aria-label="Vehicle status">
          {CHECKLIST_FAULT_MOBILITY_OPTIONS.map((opt) => {
            const checked = normalized.mobilityStatus === opt.value;
            return (
              <label
                key={opt.value}
                className="flex items-start gap-3 min-h-[44px] cursor-pointer rounded-md px-1 py-1"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setMobility(opt.value)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-ck-border accent-ck-red"
                />
                <span
                  className={cn(
                    "text-sm text-ck-fg",
                    opt.value === "cannot_move" && "font-semibold",
                    opt.value === "cannot_move" && checked && "text-ck-red"
                  )}
                >
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <span className="block text-xs text-ck-steel">Photo (optional)</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const url = typeof reader.result === "string" ? reader.result : "";
              if (!url) return;
              onChange({
                ...normalized,
                photoDataUrls: [...normalized.photoDataUrls, url].slice(0, 4),
              });
            };
            reader.readAsDataURL(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-ck-cobalt px-4 text-sm font-semibold text-ck-on-accent"
        >
          Take photo
        </button>
        <p className="text-[11px] text-ck-steel leading-snug">
          On a phone this opens the camera when the browser allows it. You can still pick a gallery
          photo if the device offers that.
        </p>
      </div>

      {normalized.photoDataUrls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {normalized.photoDataUrls.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Fault photo ${i + 1}`}
                className="h-16 w-16 rounded object-cover border border-ck-border"
              />
              <button
                type="button"
                className="absolute -right-1 -top-1 rounded-full bg-ck-red px-1.5 text-[10px] font-bold text-ck-on-accent"
                onClick={() =>
                  onChange({
                    ...normalized,
                    photoDataUrls: normalized.photoDataUrls.filter((_, j) => j !== i),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
