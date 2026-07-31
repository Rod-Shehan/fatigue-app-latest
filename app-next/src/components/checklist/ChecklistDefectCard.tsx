"use client";

import { cn } from "@/lib/utils";
import type { ChecklistDefect } from "@/lib/checklist";

export function ChecklistDefectCard({
  defect,
  onChange,
  className,
}: {
  defect: ChecklistDefect;
  onChange: (next: ChecklistDefect) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-2 rounded-lg border border-ck-red/50 bg-ck-midnight/60 p-3 space-y-3",
        className
      )}
      role="region"
      aria-label="Defect details"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-ck-red">Defect</p>
      <label className="block space-y-1">
        <span className="text-xs text-ck-steel">Description (required)</span>
        <textarea
          value={defect.description}
          onChange={(e) => onChange({ ...defect, description: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-ck-border bg-ck-slate px-3 py-2 text-sm text-slate-100 placeholder:text-ck-steel focus:outline-none focus:ring-2 focus:ring-ck-cobalt"
          placeholder="Describe the defect"
        />
      </label>
      <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
        <input
          type="checkbox"
          checked={defect.unsafeToDrive}
          onChange={(e) => onChange({ ...defect, unsafeToDrive: e.target.checked })}
          className="mt-1 h-5 w-5 rounded border-ck-border accent-ck-red"
        />
        <span className="text-sm text-slate-200">
          Vehicle is <strong className="text-ck-red">unsafe to drive</strong>
        </span>
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-ck-steel">Photo (optional)</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="block w-full text-xs text-ck-steel file:mr-3 file:rounded-md file:border-0 file:bg-ck-cobalt file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const url = typeof reader.result === "string" ? reader.result : "";
              if (!url) return;
              onChange({
                ...defect,
                photoDataUrls: [...defect.photoDataUrls, url].slice(0, 4),
              });
            };
            reader.readAsDataURL(file);
            e.target.value = "";
          }}
        />
      </label>
      {defect.photoDataUrls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {defect.photoDataUrls.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Defect photo ${i + 1}`}
                className="h-16 w-16 rounded object-cover border border-ck-border"
              />
              <button
                type="button"
                className="absolute -right-1 -top-1 rounded-full bg-ck-red px-1.5 text-[10px] font-bold text-white"
                onClick={() =>
                  onChange({
                    ...defect,
                    photoDataUrls: defect.photoDataUrls.filter((_, j) => j !== i),
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
