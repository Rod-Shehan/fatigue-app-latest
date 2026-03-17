"use client";

import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { User, Users, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

function formatLast24hBreakDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

type SheetData = {
  driver_name?: string;
  second_driver?: string;
  driver_type?: string;
  last_24h_break?: string;
  week_starting?: string;
};

export default function SheetHeader({
  sheetData,
  onChange,
  readOnly = false,
}: {
  sheetData: SheetData;
  onChange: (s: SheetData) => void;
  readOnly?: boolean;
}) {
  const last24hDateInputRef = useRef<HTMLInputElement>(null);
  const [confirmLast24hOpen, setConfirmLast24hOpen] = useState(false);
  const [pendingLast24hDate, setPendingLast24hDate] = useState<string>("");
  const [confirmLast24hChecked, setConfirmLast24hChecked] = useState(false);
  const [last24hPickerValue, setLast24hPickerValue] = useState("");
  const [last24hPickerResetKey, setLast24hPickerResetKey] = useState(0);

  const handleChange = (field: string, value: unknown) => {
    onChange({ ...sheetData, [field]: value });
  };
  const driverType = sheetData.driver_type || "solo";
  const last24hSet = !!sheetData.last_24h_break?.trim();

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
  });
  const activeDrivers = drivers.filter((d) => d.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-2">Driver Type</Label>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => handleChange("driver_type", "solo")}
            className={`px-4 py-1.5 text-xs font-bold transition-colors ${
              driverType === "solo"
                ? "bg-slate-900 dark:bg-slate-600 text-white dark:text-slate-100"
                : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600"
            }`}
          >
            Solo
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => handleChange("driver_type", "two_up")}
            className={`px-4 py-1.5 text-xs font-bold transition-colors border-l border-slate-200 dark:border-slate-600 ${
              driverType === "two_up"
                ? "bg-slate-900 dark:bg-slate-600 text-white dark:text-slate-100"
                : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600"
            }`}
          >
            Two-Up
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
            <User className="w-3 h-3" /> Driver Name
          </Label>
          {activeDrivers.length > 0 ? (
            <Select
              value={sheetData.driver_name || ""}
              onValueChange={(val) => handleChange("driver_name", val)}
              disabled={readOnly}
            >
              <SelectTrigger className="h-9 font-medium">
                <SelectValue placeholder="Select driver…" />
              </SelectTrigger>
              <SelectContent>
                {activeDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={sheetData.driver_name || ""}
              onChange={(e) => handleChange("driver_name", e.target.value)}
              placeholder="Full name (no drivers added yet)"
              className="h-9 font-medium"
              disabled={readOnly}
            />
          )}
        </div>
        {driverType === "two_up" && (
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Second Driver *
            </Label>
            {activeDrivers.length > 0 ? (
              <Select
                value={sheetData.second_driver === "" || sheetData.second_driver == null ? "__none__" : sheetData.second_driver}
                onValueChange={(val) => handleChange("second_driver", val === "__none__" ? "" : val)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-9 border-amber-300">
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
                value={sheetData.second_driver || ""}
                onChange={(e) => handleChange("second_driver", e.target.value)}
                placeholder="Required for Two-Up"
                className="h-9 border-amber-300 focus:border-amber-400"
                disabled={readOnly}
              />
            )}
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Last 24 Hour Break</Label>
          {last24hSet ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="h-9 w-full justify-start gap-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium opacity-100 cursor-not-allowed"
            >
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="font-mono">{formatLast24hBreakDate(sheetData.last_24h_break!)}</span>
              <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">Locked</span>
            </Button>
          ) : (
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600" />
              <input
                key={last24hPickerResetKey}
                ref={last24hDateInputRef}
                type="date"
                value={last24hPickerValue}
                placeholder="Set last 24h break"
                disabled={readOnly}
                onChange={(e) => {
                  const v = e.target.value;
                  setLast24hPickerValue(v);
                  if (v) {
                    setPendingLast24hDate(v);
                    setConfirmLast24hChecked(false);
                    setConfirmLast24hOpen(true);
                  }
                }}
                className="h-9 w-full rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 pl-10 pr-3 font-medium text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300"
                aria-label="Set last 24 hour break date"
              />
              <Dialog
                open={confirmLast24hOpen}
                onOpenChange={(open) => {
                  setConfirmLast24hOpen(open);
                  if (!open) {
                    setPendingLast24hDate("");
                    setConfirmLast24hChecked(false);
                    setLast24hPickerValue("");
                    setLast24hPickerResetKey((k) => k + 1);
                  }
                }}
              >
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Confirm last 24 hour break</DialogTitle>
                    <DialogDescription>
                      Set this date as your last 24 hour break? Once set, it will be locked for this sheet (manager amendment required to change).
                    </DialogDescription>
                  </DialogHeader>
                  {pendingLast24hDate && (
                    <p className="text-sm font-medium text-slate-800 font-mono">
                      {formatLast24hBreakDate(pendingLast24hDate)}
                    </p>
                  )}
                  <label className="flex items-start gap-2 pt-1 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={confirmLast24hChecked}
                      onChange={(e) => setConfirmLast24hChecked(e.target.checked)}
                    />
                    <span>I confirm this date is correct.</span>
                  </label>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setConfirmLast24hOpen(false);
                        setPendingLast24hDate("");
                        setConfirmLast24hChecked(false);
                        setLast24hPickerValue("");
                        setLast24hPickerResetKey((k) => k + 1);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!confirmLast24hChecked}
                      onClick={() => {
                        handleChange("last_24h_break", pendingLast24hDate);
                        setConfirmLast24hOpen(false);
                        setPendingLast24hDate("");
                        setConfirmLast24hChecked(false);
                        setLast24hPickerValue("");
                        setLast24hPickerResetKey((k) => k + 1);
                      }}
                      className="min-w-24 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40"
                    >
                      Confirm
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Week Starting</Label>
          <Input
            type="date"
            value={sheetData.week_starting || ""}
            onChange={(e) => handleChange("week_starting", e.target.value)}
            className="h-9 font-mono"
            disabled={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
