"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import {
  ManagerMonthCalendar,
  type ManagerMonthCalendarProps,
} from "@/app/manager/manager-month-calendar";

type ManagerRiskScopeBarProps = {
  weekSelectOptions: string[];
  activeWeekStarting: string;
  onWeekChange: (week: string) => void;
  dayLabel: string;
  calendar: ManagerMonthCalendarProps;
  driverOptions: string[];
  driverValue: string;
  onDriverChange: (value: string) => void;
  regoOptions: string[];
  regoValue: string;
  onRegoChange: (value: string) => void;
  sheetsLoading: boolean;
  autoDriverLabel?: string | null;
  formatWeekLabel: (weekStarting: string) => string;
};

export function ManagerRiskScopeBar({
  weekSelectOptions,
  activeWeekStarting,
  onWeekChange,
  dayLabel,
  calendar,
  driverOptions,
  driverValue,
  onDriverChange,
  regoOptions,
  regoValue,
  onRegoChange,
  sheetsLoading,
  autoDriverLabel,
  formatWeekLabel,
}: ManagerRiskScopeBarProps) {
  const [dayOpen, setDayOpen] = useState(false);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 sm:gap-3 sm:px-4">
        <div className="flex min-w-[9rem] flex-1 flex-col gap-1 sm:max-w-[11rem]">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Work week
          </Label>
          <Select
            value={activeWeekStarting || "all"}
            onValueChange={(v) => onWeekChange(v === "all" ? "" : v)}
            disabled={sheetsLoading}
          >
            <SelectTrigger className="h-8 w-full border-slate-200 bg-transparent text-xs font-medium dark:border-slate-600">
              <SelectValue placeholder="Week…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All weeks</SelectItem>
              {weekSelectOptions.map((w) => (
                <SelectItem key={w} value={w}>
                  Week of {formatWeekLabel(w)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Work day
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-slate-200 px-2.5 text-xs font-medium dark:border-slate-600"
            onClick={() => setDayOpen(true)}
            disabled={!activeWeekStarting}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden />
            {dayLabel}
          </Button>
        </div>

        <div className="flex min-w-[9rem] flex-1 flex-col gap-1 sm:max-w-[12rem]">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Chart driver
          </Label>
          <Select
            value={driverValue}
            onValueChange={onDriverChange}
            disabled={sheetsLoading || !activeWeekStarting || driverOptions.length === 0}
          >
            <SelectTrigger className="h-8 w-full border-slate-200 bg-transparent text-xs font-medium dark:border-slate-600">
              <SelectValue placeholder="Driver…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">
                {autoDriverLabel
                  ? `Highest now · ${autoDriverLabel}`
                  : MANAGER_EXPERIENCE.SCOPE_DRIVER_AUTO}
              </SelectItem>
              {driverOptions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-[7rem] flex-1 flex-col gap-1 sm:max-w-[9rem]">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Rego
          </Label>
          <Select
            value={regoValue}
            onValueChange={onRegoChange}
            disabled={sheetsLoading || !activeWeekStarting}
          >
            <SelectTrigger className="h-8 w-full border-slate-200 bg-transparent text-xs font-medium dark:border-slate-600">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All regos</SelectItem>
              {regoOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{MANAGER_EXPERIENCE.SCOPE_DAY_DIALOG_TITLE}</DialogTitle>
            <DialogDescription>{MANAGER_EXPERIENCE.SCOPE_DAY_DIALOG_HINT}</DialogDescription>
          </DialogHeader>
          <ManagerMonthCalendar
            {...calendar}
            onSelectDate={(weekStartingYmd, dayIndex) => {
              calendar.onSelectDate(weekStartingYmd, dayIndex);
              setDayOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
