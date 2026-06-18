"use client";

import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const driverToggleClass = (active: boolean, readOnly: boolean) =>
  cn(
    "px-3 py-1.5 text-sm font-semibold min-h-[40px] min-w-[4.25rem] transition-colors",
    readOnly
      ? active
        ? "bg-slate-200 text-slate-800 dark:bg-slate-800/80 dark:text-slate-100 cursor-not-allowed"
        : "bg-slate-100 text-slate-400 dark:bg-slate-900/40 dark:text-slate-500 cursor-not-allowed"
      : active
        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:shadow-md dark:ring-1 dark:ring-white/30"
        : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900/40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
  );

export function DriverTypeFields({
  driverType,
  secondDriver,
  onDriverTypeChange,
  onSecondDriverChange,
  readOnly = false,
}: {
  driverType: string;
  secondDriver?: string;
  onDriverTypeChange: (type: "solo" | "two_up") => void;
  onSecondDriverChange: (name: string) => void;
  readOnly?: boolean;
}) {
  const type = driverType === "two_up" ? "two_up" : "solo";

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
    enabled: type === "two_up",
  });
  const activeDrivers = drivers.filter((d) => d.is_active);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Crew for this shift</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
          Solo or Two-Up for this day. Two-Up needs the relief driver&apos;s name only — each driver keeps
          their own record; you do not log the other driver&apos;s times here.
        </p>
      </div>
      <div
        className="inline-flex rounded-lg border border-slate-200 overflow-hidden shrink-0 dark:border-slate-500 dark:bg-slate-950 dark:p-0.5 dark:gap-0.5"
        role="group"
        aria-label="Driver type"
      >
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onDriverTypeChange("solo")}
          className={cn(driverToggleClass(type === "solo", readOnly), "rounded-none dark:rounded-md")}
        >
          Solo
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onDriverTypeChange("two_up")}
          className={cn(
            driverToggleClass(type === "two_up", readOnly),
            "border-l border-slate-200 dark:border-0 rounded-none dark:rounded-md"
          )}
        >
          Two-Up
        </button>
      </div>
      {type === "two_up" && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Relief driver (name only)
          </Label>
          {activeDrivers.length > 0 ? (
            <Select
              value={secondDriver === "" || secondDriver == null ? "__none__" : secondDriver}
              onValueChange={(val) => onSecondDriverChange(val === "__none__" ? "" : val)}
              disabled={readOnly}
            >
              <SelectTrigger className="h-11 border-amber-300 dark:border-amber-700">
                <SelectValue placeholder="Required for Two-Up" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {activeDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={secondDriver || ""}
              onChange={(e) => onSecondDriverChange(e.target.value)}
              placeholder="Required for Two-Up"
              className="h-11 border-amber-300 text-sm font-medium focus:border-amber-400"
              disabled={readOnly}
            />
          )}
        </div>
      )}
    </div>
  );
}
