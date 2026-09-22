"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTruckRegoSelectLabel, platesForFormRegoRole, recordFromApiRego, type FormRegoListRole } from "@/lib/truck-rego";
import { regoKey } from "@/lib/rego-kms-validation";
import { cn } from "@/lib/utils";

const NONE = "__none__";
const TYPE_PLATE = "__type_plate__";

const triggerClass =
  "w-full min-h-[44px] h-auto border-ck-border bg-ck-midnight font-semibold uppercase text-ck-fg dark:border-ck-border dark:bg-ck-midnight dark:text-ck-fg";

export type ChecklistRegoOption = {
  label: string;
  vehicle_type?: string | null;
  gvm_tonnes?: number | null;
  gcm_tonnes?: number | null;
  atm_tonnes?: number | null;
  tare_tonnes?: number | null;
};

export function ChecklistRegoSelect({
  id,
  label,
  placeholder,
  value,
  onChange,
  regos = [],
  role,
  extraPlates = [],
  showLabel = true,
}: {
  id?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  regos?: ChecklistRegoOption[];
  role: FormRegoListRole;
  extraPlates?: Array<string | null | undefined>;
  showLabel?: boolean;
}) {
  const plates = useMemo(
    () => platesForFormRegoRole(regos, role, extraPlates),
    [regos, role, extraPlates]
  );
  const current = value.trim();
  const currentKey = regoKey(current);
  const inList = plates.some((p) => regoKey(p) === currentKey);
  const [typing, setTyping] = useState(false);
  const showType = typing || (Boolean(current) && !inList);
  const selectValue = showType ? TYPE_PLATE : current || NONE;

  return (
    <div className="space-y-1">
      {showLabel ? <span className="text-xs font-semibold text-ck-steel">{label}</span> : null}
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === NONE) {
            setTyping(false);
            onChange("");
            return;
          }
          if (v === TYPE_PLATE) {
            setTyping(true);
            if (inList) onChange("");
            return;
          }
          setTyping(false);
          onChange(v);
        }}
      >
        <SelectTrigger id={id} className={triggerClass}>
          <SelectValue placeholder={placeholder || "Select rego"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— Select rego —</SelectItem>
          {plates.map((plate) => {
            const meta = regos.find((r) => regoKey(r.label) === regoKey(plate));
            return (
              <SelectItem key={plate} value={plate} className="whitespace-normal font-mono text-sm leading-snug py-2">
                {formatTruckRegoSelectLabel(plate, meta ? recordFromApiRego(meta) : null)}
              </SelectItem>
            );
          })}
          <SelectItem value={TYPE_PLATE}>Type a plate…</SelectItem>
        </SelectContent>
      </Select>
      {showType ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoCapitalize="characters"
          placeholder={placeholder}
          className={cn(
            "w-full min-h-[44px] rounded-lg border border-ck-border bg-ck-midnight px-3 text-sm font-semibold uppercase text-ck-fg"
          )}
        />
      ) : null}
    </div>
  );
}
