"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DRIVER_ALERTNESS_LEVELS,
  alertnessItemClass,
  alertnessTriggerClass,
  getDriverAlertnessOption,
  type DriverAlertnessLevel,
} from "@/lib/driver-alertness";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "Select how you feel…";

export function AlertnessLevelSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: DriverAlertnessLevel | null | undefined;
  onChange: (level: DriverAlertnessLevel) => void;
  disabled?: boolean;
  className?: string;
}) {
  const selected = getDriverAlertnessOption(value);
  const selectValue = selected ? String(selected.level) : "";

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onChange(Number(v) as DriverAlertnessLevel)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "h-auto min-h-12 py-2.5 text-left font-medium transition-colors",
          selected ? alertnessTriggerClass(selected.tone) : "",
          className
        )}
      >
        <SelectValue placeholder={PLACEHOLDER}>
          {selected ? (
            <span className="flex items-center gap-2">
              <span className="text-lg leading-none" aria-hidden>
                {selected.emoji}
              </span>
              <span>{selected.shortLabel}</span>
            </span>
          ) : (
            PLACEHOLDER
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
        {DRIVER_ALERTNESS_LEVELS.map((opt) => (
          <SelectItem
            key={opt.level}
            value={String(opt.level)}
            className={cn("items-start py-3", alertnessItemClass(opt.tone))}
          >
            <div className="flex gap-2.5 pr-2">
              <span className="text-xl leading-none shrink-0 pt-0.5" aria-hidden>
                {opt.emoji}
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold leading-tight">{opt.title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">{opt.description}</p>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
