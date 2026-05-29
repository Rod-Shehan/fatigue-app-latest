"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Save,
  ScrollText,
  Loader2,
} from "lucide-react";
import { signOut } from "next-auth/react";

const MANAGER_LOGIN_HREF = `/login?callbackUrl=${encodeURIComponent("/manager")}&managerLogin=1`;

export function DriverMoreMenu({
  sheetId,
  sheetStatus,
  canAccessManager = false,
  onSave,
  savePending = false,
  onMarkComplete,
  onExportPdf,
}: {
  sheetId?: string;
  sheetStatus?: string;
  canAccessManager?: boolean;
  onSave?: () => void;
  savePending?: boolean;
  onMarkComplete?: () => void;
  onExportPdf?: () => void;
}) {
  const onSheet = Boolean(sheetId);
  const isCompleted = sheetStatus === "completed";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-9 sm:h-8 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shrink-0 min-h-[44px] sm:min-h-0"
          aria-label="More options"
        >
          <Menu className="w-4 h-4" aria-hidden />
          More
          <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13rem]">
        {onSheet && (
          <>
            <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              This week
            </p>
            {onSave && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onSave();
                }}
                disabled={savePending}
                className="text-xs gap-2"
              >
                {savePending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Save className="w-3.5 h-3.5 shrink-0" />
                )}
                Save
              </DropdownMenuItem>
            )}
            {!isCompleted && onMarkComplete && (
              <DropdownMenuItem onSelect={onMarkComplete} className="text-xs gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Mark complete
              </DropdownMenuItem>
            )}
            {onExportPdf && (
              <DropdownMenuItem onSelect={onExportPdf} className="text-xs gap-2">
                <Download className="w-3.5 h-3.5 shrink-0" />
                Export PDF
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild className="text-xs gap-2">
              <Link href={`/sheets/${sheetId}/shift-log`}>
                <ScrollText className="w-3.5 h-3.5 shrink-0" />
                Shift log
              </Link>
            </DropdownMenuItem>
            <div className="my-1 h-px bg-slate-200 dark:bg-slate-600" role="separator" />
          </>
        )}

        <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Records
        </p>
        <DropdownMenuItem asChild className="text-xs gap-2">
          <Link href="/sheets">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            Your weeks
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-xs gap-2">
          <Link href="/driver/help">
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            How your record works
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-xs gap-2">
          <Link href="/driver/more">
            <Menu className="w-3.5 h-3.5 shrink-0" />
            All options
          </Link>
        </DropdownMenuItem>

        <div className="my-1 h-px bg-slate-200 dark:bg-slate-600" role="separator" />
        <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Connect
        </p>
        <DropdownMenuItem asChild className="text-xs gap-2">
          <Link href="/driver/messages">
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            Messages
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-xs gap-2">
          <Link href={canAccessManager ? "/manager" : MANAGER_LOGIN_HREF}>
            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
            Manager
          </Link>
        </DropdownMenuItem>

        <div className="my-1 h-px bg-slate-200 dark:bg-slate-600" role="separator" />
        <DropdownMenuItem
          onSelect={() => signOut({ callbackUrl: "/login" })}
          className="text-xs gap-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
