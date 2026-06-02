"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function DriverSettingsSignOut() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full justify-start gap-2 min-h-[52px] text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="w-5 h-5" />
      Log out
    </Button>
  );
}
